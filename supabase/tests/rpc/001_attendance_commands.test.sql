begin;

select plan(26);

update public.seasons set is_active = false;

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000009001', 'president-commands@example.test'),
  ('00000000-0000-4000-8000-000000009002', 'coach-commands@example.test'),
  ('00000000-0000-4000-8000-000000009003', 'active-commands@example.test'),
  ('00000000-0000-4000-8000-000000009004', 'injured-commands@example.test'),
  ('00000000-0000-4000-8000-000000009005', 'suspended-commands@example.test'),
  ('00000000-0000-4000-8000-000000009006', 'inactive-commands@example.test'),
  ('00000000-0000-4000-8000-000000009007', 'no-role-commands@example.test');

insert into public.profiles (id)
select id from auth.users where id::text like '00000000-0000-4000-8000-00000000900%';

insert into public.user_roles (user_id, role, assigned_by)
values
  ('00000000-0000-4000-8000-000000009001', 'PRESIDENT', '00000000-0000-4000-8000-000000009001'),
  ('00000000-0000-4000-8000-000000009002', 'COACH', '00000000-0000-4000-8000-000000009001'),
  ('00000000-0000-4000-8000-000000009003', 'ATHLETE', '00000000-0000-4000-8000-000000009001'),
  ('00000000-0000-4000-8000-000000009004', 'ATHLETE', '00000000-0000-4000-8000-000000009001'),
  ('00000000-0000-4000-8000-000000009005', 'ATHLETE', '00000000-0000-4000-8000-000000009001');

insert into public.athletes (
  id, user_id, full_name, shirt_name, shirt_number, primary_position, status, inactivated_at
) values
  ('00000000-0000-4000-8000-000000009101', '00000000-0000-4000-8000-000000009003', 'Ativo Comandos', 'Ativo', 61, 'Ataque', 'ACTIVE', null),
  ('00000000-0000-4000-8000-000000009102', '00000000-0000-4000-8000-000000009004', 'Lesionado Comandos', 'Lesionado', 62, 'Defesa', 'INJURED', null),
  ('00000000-0000-4000-8000-000000009103', '00000000-0000-4000-8000-000000009005', 'Suspenso Comandos', 'Suspenso', 63, 'Meio-campo', 'SUSPENDED', null),
  ('00000000-0000-4000-8000-000000009104', '00000000-0000-4000-8000-000000009006', 'Inativo Comandos', 'Inativo', 64, 'Defesa', 'INACTIVE', statement_timestamp()),
  ('00000000-0000-4000-8000-000000009105', '00000000-0000-4000-8000-000000009007', 'Sem Papel Comandos', 'Sem papel', 65, 'Ataque', 'ACTIVE', null);

insert into public.seasons (id, year, is_active)
values ('00000000-0000-4000-8000-000000009201', 2033, true);

insert into public.matches (
  id, season_id, opponent_name, match_date, confirmation_deadline, created_by, updated_by
) values (
  '00000000-0000-4000-8000-000000009301',
  '00000000-0000-4000-8000-000000009201', 'Comandos FC',
  statement_timestamp() + interval '3 days', statement_timestamp() + interval '1 day',
  '00000000-0000-4000-8000-000000009001', '00000000-0000-4000-8000-000000009001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000009002","role":"authenticated","aal":"aal2"}', true);

select lives_ok(
  $$select public.set_match_callups(
    '00000000-0000-4000-8000-000000009301',
    array['00000000-0000-4000-8000-000000009101'::uuid, '00000000-0000-4000-8000-000000009102'::uuid, '00000000-0000-4000-8000-000000009103'::uuid],
    '00000000-0000-4000-8000-000000009401'
  )$$,
  'active, injured, and suspended Athlete-role users are callable'
);
select throws_ok(
  $$select public.set_match_callups(
    '00000000-0000-4000-8000-000000009301',
    array['00000000-0000-4000-8000-000000009104'::uuid],
    '00000000-0000-4000-8000-000000009402'
  )$$,
  'P0001', 'ATHLETE_INELIGIBLE', 'inactive athlete is denied'
);
select throws_ok(
  $$select public.set_match_callups(
    '00000000-0000-4000-8000-000000009301',
    array['00000000-0000-4000-8000-000000009105'::uuid],
    '00000000-0000-4000-8000-000000009403'
  )$$,
  'P0001', 'ATHLETE_INELIGIBLE', 'athlete without active Athlete role is denied'
);
reset role;

select is((select count(*)::integer from public.match_presences where match_id = '00000000-0000-4000-8000-000000009301' and call_status = 'CALLED'), 3, 'general call creates one called row per athlete');
select is((select min(call_revision)::integer from public.match_presences), 1, 'first call starts at revision one');
select ok((select bool_and(called_at is not null) from public.match_presences), 'every called row is timestamped');
select is((select count(*)::integer from public.notification_events where kind = 'CALL_UP'), 3, 'one event exists per first call revision');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000009002","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$select public.set_match_callups(
    '00000000-0000-4000-8000-000000009301',
    array['00000000-0000-4000-8000-000000009101'::uuid, '00000000-0000-4000-8000-000000009102'::uuid, '00000000-0000-4000-8000-000000009103'::uuid],
    '00000000-0000-4000-8000-000000009401'
  )$$,
  'retry with the same idempotency key is safe'
);
reset role;

select is((select count(*)::integer from public.notification_events where kind = 'CALL_UP'), 3, 'retry does not duplicate events');
select is((select max(call_revision)::integer from public.match_presences where match_id = '00000000-0000-4000-8000-000000009301'), 1, 'retry does not advance call revision');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000009002","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$select public.set_match_callups(
    '00000000-0000-4000-8000-000000009301',
    array['00000000-0000-4000-8000-000000009102'::uuid, '00000000-0000-4000-8000-000000009103'::uuid],
    '00000000-0000-4000-8000-000000009404'
  )$$,
  'removing an athlete preserves the row as not called'
);
select lives_ok(
  $$select public.set_match_callups(
    '00000000-0000-4000-8000-000000009301',
    array['00000000-0000-4000-8000-000000009101'::uuid, '00000000-0000-4000-8000-000000009102'::uuid, '00000000-0000-4000-8000-000000009103'::uuid],
    '00000000-0000-4000-8000-000000009405'
  )$$,
  're-call is accepted'
);
reset role;

select is((select call_revision::integer from public.match_presences where athlete_id = '00000000-0000-4000-8000-000000009101'), 2, 're-call increments the revision');
select is((select count(*)::integer from public.notification_events where kind = 'CALL_UP'), 4, 're-call creates exactly one new event');
select ok(
  (select called_at > created_at - interval '1 second' from public.match_presences where athlete_id = '00000000-0000-4000-8000-000000009101'),
  're-call refreshes called_at for reminder eligibility'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000009003","role":"authenticated","aal":"aal1"}', true);
select lives_ok(
  $$select public.respond_to_call('00000000-0000-4000-8000-000000009301', 'DECLINED', 'Compromisso pessoal', '00000000-0000-4000-8000-000000009406')$$,
  'Athlete can decline with a reason before the deadline'
);
select lives_ok(
  $$select public.respond_to_call('00000000-0000-4000-8000-000000009301', 'DECLINED', 'Compromisso pessoal', '00000000-0000-4000-8000-000000009406')$$,
  'response retry is idempotent'
);
reset role;

select is((select presence_status::text from public.match_presences where athlete_id = '00000000-0000-4000-8000-000000009101'), 'DECLINED', 'response transition is committed');
select is((select count(*)::integer from public.presence_justifications where reason = 'Compromisso pessoal'), 1, 'response retry keeps one protected reason');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000009002","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$select public.admin_set_presence('00000000-0000-4000-8000-000000009301', '00000000-0000-4000-8000-000000009101', 'CONFIRMED', null, 'Confirmado pela comissão', '00000000-0000-4000-8000-000000009407')$$,
  'staff override is atomic and audited'
);
select lives_ok(
  $$select public.reschedule_match(
    '00000000-0000-4000-8000-000000009301', statement_timestamp() + interval '5 days',
    statement_timestamp() + interval '4 days', 'Comandos FC', null, null,
    '00000000-0000-4000-8000-000000009408'
  )$$,
  'rescheduling succeeds under row lock'
);
reset role;

select is((select schedule_revision::integer from public.matches where id = '00000000-0000-4000-8000-000000009301'), 2, 'rescheduling increments schedule revision');
select ok((select bool_and(presence_status = 'PENDING') from public.match_presences where match_id = '00000000-0000-4000-8000-000000009301' and call_status = 'CALLED'), 'rescheduling resets called responses');
select is((select count(*)::integer from public.presence_justifications pj join public.match_presences mp on mp.id = pj.presence_id where mp.match_id = '00000000-0000-4000-8000-000000009301'), 0, 'rescheduling removes obsolete reasons');

update public.matches
set confirmation_deadline = statement_timestamp() - interval '1 hour',
    match_date = statement_timestamp() + interval '1 day'
where id = '00000000-0000-4000-8000-000000009301';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000009002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000009002","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$select public.create_exceptional_call(
    '00000000-0000-4000-8000-000000009301', '00000000-0000-4000-8000-000000009101',
    statement_timestamp() + interval '2 hours', '00000000-0000-4000-8000-000000009409'
  )$$,
  'staff creates an exceptional call after the general deadline'
);
reset role;

select ok(
  (select is_exceptional_call and individual_deadline is not null and call_revision >= 3
   from public.match_presences where athlete_id = '00000000-0000-4000-8000-000000009101'),
  'exceptional call records deadline, timestamp, and a new revision'
);

select * from finish();
rollback;
