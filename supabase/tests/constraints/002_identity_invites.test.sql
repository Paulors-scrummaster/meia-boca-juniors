begin;

select plan(15);

select has_table('public', 'athlete_invites', 'athlete invites exist');
select hasnt_column('public', 'athlete_invites', 'token', 'raw invitation tokens are not stored');
select hasnt_column('public', 'athlete_invites', 'action_link', 'action links are not stored');

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000001001', 'president-invites@example.test'),
  ('00000000-0000-4000-8000-000000001002', 'pending-one@example.test'),
  ('00000000-0000-4000-8000-000000001003', 'pending-two@example.test'),
  ('00000000-0000-4000-8000-000000001004', 'redeemer@example.test');

insert into public.profiles (id)
values ('00000000-0000-4000-8000-000000001001');

insert into public.user_roles (user_id, role, assigned_by)
values (
  '00000000-0000-4000-8000-000000001001',
  'PRESIDENT',
  '00000000-0000-4000-8000-000000001001'
);

insert into public.athletes (id, full_name, shirt_name, shirt_number, primary_position)
values
  ('00000000-0000-4000-8000-000000001101', 'Primeiro Convite', 'Primeiro', 21, 'Ataque'),
  ('00000000-0000-4000-8000-000000001102', 'Segundo Convite', 'Segundo', 22, 'Defesa'),
  ('00000000-0000-4000-8000-000000001103', 'Ativação Única', 'Única', 23, 'Meio-campo');

insert into public.athlete_invites (
  id,
  athlete_id,
  auth_user_id,
  email_normalized,
  created_by
) values (
  '00000000-0000-4000-8000-000000001201',
  '00000000-0000-4000-8000-000000001101',
  '00000000-0000-4000-8000-000000001002',
  'pending-one@example.test',
  '00000000-0000-4000-8000-000000001001'
);

select throws_ok(
  $$
    insert into public.athlete_invites (
      athlete_id, auth_user_id, email_normalized, created_by
    ) values (
      '00000000-0000-4000-8000-000000001101',
      '00000000-0000-4000-8000-000000001003',
      'pending-two@example.test',
      '00000000-0000-4000-8000-000000001001'
    )
  $$,
  '23505',
  null,
  'an athlete has at most one active logical invite'
);

update public.athlete_invites
set revoked_at = statement_timestamp()
where id = '00000000-0000-4000-8000-000000001201';

select lives_ok(
  $$
    insert into public.athlete_invites (
      athlete_id, auth_user_id, email_normalized, created_by
    ) values (
      '00000000-0000-4000-8000-000000001101',
      '00000000-0000-4000-8000-000000001003',
      'pending-two@example.test',
      '00000000-0000-4000-8000-000000001001'
    )
  $$,
  'revocation permits a new logical invite'
);

select throws_ok(
  $$
    update public.athlete_invites
    set redeemed_at = statement_timestamp(),
        redeemed_by = '00000000-0000-4000-8000-000000001001'
    where id = '00000000-0000-4000-8000-000000001201'
  $$,
  '23514',
  null,
  'an invite cannot be both revoked and redeemed'
);

select throws_ok(
  $$
    insert into public.athlete_invites (
      athlete_id, auth_user_id, email_normalized, created_by, redeemed_at
    ) values (
      '00000000-0000-4000-8000-000000001102',
      '00000000-0000-4000-8000-000000001002',
      'pending-one@example.test',
      '00000000-0000-4000-8000-000000001001',
      statement_timestamp()
    )
  $$,
  '23514',
  null,
  'redemption timestamp and actor must be recorded together'
);

select throws_ok(
  $$
    insert into public.athlete_invites (
      athlete_id, auth_user_id, email_normalized, created_by
    ) values (
      '00000000-0000-4000-8000-000000001102',
      '00000000-0000-4000-8000-000000001002',
      ' Pending-One@Example.Test ',
      '00000000-0000-4000-8000-000000001001'
    )
  $$,
  '23514',
  null,
  'invite e-mail must already be normalized'
);

select throws_ok(
  $$
    insert into public.athlete_invites (
      athlete_id, auth_user_id, email_normalized, created_by
    ) values (
      '00000000-0000-4000-8000-000000001102',
      '00000000-0000-4000-8000-000000001003',
      'another@example.test',
      '00000000-0000-4000-8000-000000001001'
    )
  $$,
  '23505',
  null,
  'one Auth identity cannot back two logical invites'
);

insert into public.athlete_invites (
  id,
  athlete_id,
  auth_user_id,
  email_normalized,
  created_by
) values (
  '00000000-0000-4000-8000-000000001203',
  '00000000-0000-4000-8000-000000001103',
  '00000000-0000-4000-8000-000000001004',
  'redeemer@example.test',
  '00000000-0000-4000-8000-000000001001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000001004","role":"authenticated","aal":"aal1"}',
  true
);

select lives_ok(
  $$select public.accept_athlete_invitation(
    '00000000-0000-4000-8000-000000001203',
    '00000000-0000-4000-8000-000000001299'
  )$$,
  'the expected authenticated identity can redeem once'
);

reset role;

select is(
  (select user_id from public.athletes where id = '00000000-0000-4000-8000-000000001103'),
  '00000000-0000-4000-8000-000000001004'::uuid,
  'redemption links the athlete atomically'
);

select is(
  (select count(*)::integer from public.user_roles
   where user_id = '00000000-0000-4000-8000-000000001004' and role = 'ATHLETE'),
  1,
  'redemption assigns the Athlete role once'
);

select is(
  (select redeemed_by from public.athlete_invites where id = '00000000-0000-4000-8000-000000001203'),
  '00000000-0000-4000-8000-000000001004'::uuid,
  'redemption records the authenticated actor'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001004', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000001004","role":"authenticated","aal":"aal1"}',
  true
);

select throws_ok(
  $$select public.accept_athlete_invitation(
    '00000000-0000-4000-8000-000000001203',
    '00000000-0000-4000-8000-000000001298'
  )$$,
  'P0001',
  'invitation is not pending',
  'a redeemed invite cannot be reused'
);

reset role;

select ok(
  private.payload_is_safe(
    (select after_state from public.audit_logs where action = 'INVITATION_REDEEMED')
  ),
  'invitation audit data remains sanitized'
);

select * from finish();
rollback;
