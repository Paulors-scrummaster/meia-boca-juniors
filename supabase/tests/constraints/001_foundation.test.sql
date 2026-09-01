begin;

select plan(21);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'user_roles', 'user_roles exists');
select has_table('public', 'athletes', 'athletes exists');
select has_table('public', 'audit_logs', 'audit_logs exists');
select has_table('private', 'rate_limit_counters', 'private rate counters exist');
select has_table('public', 'notification_events', 'notification events exist');
select has_table('public', 'notification_deliveries', 'notification deliveries exist');

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000101', 'president-foundation@example.test'),
  ('00000000-0000-0000-0000-000000000102', 'athlete-foundation@example.test');

insert into public.profiles (id)
values
  ('00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000102');

select throws_ok(
  $$
    insert into public.profiles (id)
    values ('00000000-0000-0000-0000-000000000103')
  $$,
  '23503',
  null,
  'profiles preserve the auth.users foreign key'
);

select throws_ok(
  $$
    update public.profiles
    set account_status = 'DISABLED'
    where id = '00000000-0000-0000-0000-000000000102'
  $$,
  '23514',
  null,
  'disabled profiles require disabled_at'
);

insert into public.user_roles (user_id, role, assigned_by)
values
  ('00000000-0000-0000-0000-000000000102', 'ATHLETE', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000102', 'COACH', '00000000-0000-0000-0000-000000000101');

select is(
  (select count(*)::integer from public.user_roles where user_id = '00000000-0000-0000-0000-000000000102'),
  2,
  'roles are additive for one user'
);

insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position)
values (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000102',
  'Atleta Teste',
  'Teste',
  42,
  'Meia'
);

select throws_ok(
  $$
    insert into public.athletes (full_name, shirt_name, shirt_number, primary_position)
    values ('Outro Atleta', 'Outro', 42, 'Ataque')
  $$,
  '23505',
  null,
  'active shirt numbers are unique'
);

select lives_ok(
  $$
    insert into public.athletes (
      full_name,
      shirt_name,
      shirt_number,
      primary_position,
      status,
      inactivated_at
    ) values ('Atleta Inativo', 'Inativo', 42, 'Defesa', 'INACTIVE', statement_timestamp())
  $$,
  'inactive athletes release their shirt number'
);

select throws_ok(
  $$
    insert into private.rate_limit_counters (scope, subject_hash, window_started_at, attempt_count)
    values ('auth:login', '203.0.113.7', statement_timestamp(), 1)
  $$,
  '23514',
  null,
  'rate counters reject raw IP values'
);

select throws_ok(
  $$
    select *
    from private.consume_rate_limit('identity:invite', '203.0.113.7', 2, 3600)
  $$,
  '22023',
  null,
  'rate helper rejects a raw IP subject'
);

select lives_ok(
  $$
    select *
    from private.consume_rate_limit(
      'identity:invite',
      '00000000-0000-4000-8000-000000000102',
      2,
      3600
    )
  $$,
  'rate helper accepts a technical UUID subject'
);

select is(
  (select count(*)::integer from private.rate_limit_counters where subject_hash = '203.0.113.7'),
  0,
  'rate helper stores only a SHA-256 subject hash'
);

insert into public.audit_logs (
  id,
  actor_user_id,
  action,
  resource_type,
  resource_id,
  before_state,
  after_state,
  trace_id
) values (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000101',
  'FOUNDATION_TEST',
  'profile',
  '00000000-0000-0000-0000-000000000102',
  '{"status":"before"}',
  '{"status":"after"}',
  '00000000-0000-0000-0000-000000000399'
);

select throws_ok(
  $$
    update public.audit_logs
    set action = 'FOUNDATION_CHANGED'
    where id = '00000000-0000-0000-0000-000000000301'
  $$,
  '55000',
  'audit logs are immutable',
  'audit rows cannot be updated'
);

select throws_ok(
  $$
    delete from public.audit_logs
    where id = '00000000-0000-0000-0000-000000000301'
  $$,
  '55000',
  'audit logs are immutable',
  'audit rows cannot be deleted'
);

select throws_ok(
  $$
    insert into public.audit_logs (
      actor_user_id,
      action,
      resource_type,
      before_state,
      trace_id
    ) values (
      '00000000-0000-0000-0000-000000000101',
      'UNSAFE_AUDIT',
      'profile',
      '{"temporaryPassword":"never-log-this"}',
      '00000000-0000-0000-0000-000000000398'
    )
  $$,
  '23514',
  null,
  'audit payloads reject sensitive fields'
);

insert into public.notification_events (
  id,
  kind,
  resource_type,
  resource_id,
  deduplication_key,
  payload
) values (
  '00000000-0000-0000-0000-000000000401',
  'CALL_UP',
  'match',
  '00000000-0000-0000-0000-000000000499',
  'match:499:call-up:athlete:102:revision:1',
  '{"route":"/matches/499"}'
);

select throws_ok(
  $$
    insert into public.notification_events (
      kind,
      resource_type,
      resource_id,
      deduplication_key,
      payload
    ) values (
      'CALL_UP',
      'match',
      '00000000-0000-0000-0000-000000000499',
      'match:499:call-up:athlete:102:revision:1',
      '{}'
    )
  $$,
  '23505',
  null,
  'notification event deduplication keys are unique'
);

insert into public.notification_deliveries (event_id, user_id)
values (
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000102'
);

select throws_ok(
  $$
    insert into public.notification_deliveries (event_id, user_id)
    values (
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000102'
    )
  $$,
  '23505',
  null,
  'notification deliveries are unique per event and user'
);

select * from finish();
rollback;
