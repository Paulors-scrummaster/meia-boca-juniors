begin;

select plan(19);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000002001', 'president-identity@example.test'),
  ('00000000-0000-4000-8000-000000002002', 'coach-identity@example.test'),
  ('00000000-0000-4000-8000-000000002003', 'athlete-identity@example.test'),
  ('00000000-0000-4000-8000-000000002004', 'disabled-president@example.test'),
  ('00000000-0000-4000-8000-000000002005', 'role-target@example.test'),
  ('00000000-0000-4000-8000-000000002006', 'invited-identity@example.test'),
  ('00000000-0000-4000-8000-000000002007', 'service-invite@example.test');

insert into public.profiles (id)
values
  ('00000000-0000-4000-8000-000000002001'),
  ('00000000-0000-4000-8000-000000002002'),
  ('00000000-0000-4000-8000-000000002003'),
  ('00000000-0000-4000-8000-000000002005');

insert into public.profiles (id, account_status, disabled_at)
values ('00000000-0000-4000-8000-000000002004', 'DISABLED', statement_timestamp());

insert into public.user_roles (user_id, role, assigned_by)
values
  ('00000000-0000-4000-8000-000000002001', 'PRESIDENT', '00000000-0000-4000-8000-000000002001'),
  ('00000000-0000-4000-8000-000000002002', 'COACH', '00000000-0000-4000-8000-000000002001'),
  ('00000000-0000-4000-8000-000000002003', 'ATHLETE', '00000000-0000-4000-8000-000000002001'),
  ('00000000-0000-4000-8000-000000002004', 'PRESIDENT', '00000000-0000-4000-8000-000000002001');

insert into public.athletes (id, full_name, shirt_name, shirt_number, primary_position)
values
  ('00000000-0000-4000-8000-000000002101', 'Atleta Convidado', 'Convidado', 31, 'Ataque'),
  ('00000000-0000-4000-8000-000000002102', 'Atleta Matriz', 'Matriz', 32, 'Defesa'),
  ('00000000-0000-4000-8000-000000002103', 'Atleta Server', 'Server', 33, 'Meio-campo');

insert into public.athlete_invites (
  id, athlete_id, auth_user_id, email_normalized, created_by
) values (
  '00000000-0000-4000-8000-000000002201',
  '00000000-0000-4000-8000-000000002101',
  '00000000-0000-4000-8000-000000002006',
  'invited-identity@example.test',
  '00000000-0000-4000-8000-000000002001'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.athlete_invites$$,
  '42501',
  null,
  'visitors cannot read invitations'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002003","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::integer from public.athlete_invites), 0, 'Athletes cannot read invitations');
select throws_ok(
  $$select public.set_user_role(
    '00000000-0000-4000-8000-000000002005', 'COACH', true,
    '00000000-0000-4000-8000-000000002299'
  )$$,
  '42501',
  'President with AAL2 required',
  'Athletes cannot assign roles by direct RPC'
);
select throws_ok(
  $$select public.accept_athlete_invitation(
    '00000000-0000-4000-8000-000000002201',
    '00000000-0000-4000-8000-000000002298'
  )$$,
  '42501',
  'invitation does not belong to authenticated user',
  'Athletes cannot redeem another identity invitation'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002002","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::integer from public.athlete_invites), 0, 'Coach cannot read invitations');
select throws_ok(
  $$select public.set_user_role(
    '00000000-0000-4000-8000-000000002005', 'COACH', true,
    '00000000-0000-4000-8000-000000002297'
  )$$,
  '42501',
  'President with AAL2 required',
  'Coach cannot assign roles'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002001","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::integer from public.athlete_invites), 0, 'President without AAL2 cannot read invitations');
select throws_ok(
  $$select public.set_user_role(
    '00000000-0000-4000-8000-000000002005', 'COACH', true,
    '00000000-0000-4000-8000-000000002296'
  )$$,
  '42501',
  'President with AAL2 required',
  'President without AAL2 cannot assign roles'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002004","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::integer from public.athlete_invites), 0, 'disabled President cannot read invitations');
select throws_ok(
  $$select public.set_user_role(
    '00000000-0000-4000-8000-000000002005', 'COACH', true,
    '00000000-0000-4000-8000-000000002295'
  )$$,
  '42501',
  'President with AAL2 required',
  'disabled President cannot assign roles'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002001","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::integer from public.athlete_invites), 1, 'President with AAL2 reads invitations');
select lives_ok(
  $$select public.set_user_role(
    '00000000-0000-4000-8000-000000002005', 'COACH', true,
    '00000000-0000-4000-8000-000000002294'
  )$$,
  'President with AAL2 assigns a role'
);
reset role;

select is(
  (select count(*)::integer from public.user_roles
   where user_id = '00000000-0000-4000-8000-000000002005' and role = 'COACH'),
  1,
  'role assignment is persisted once'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000002001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000002001","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$select public.set_user_role(
    '00000000-0000-4000-8000-000000002005', 'COACH', false,
    '00000000-0000-4000-8000-000000002293'
  )$$,
  'President with AAL2 removes a role'
);
reset role;

select is(
  (select count(*)::integer from public.user_roles
   where user_id = '00000000-0000-4000-8000-000000002005' and role = 'COACH'),
  0,
  'role removal is persisted'
);

set local role service_role;
select lives_ok(
  $$select public.create_identity_invite(
    '00000000-0000-4000-8000-000000002001',
    '00000000-0000-4000-8000-000000002103',
    '00000000-0000-4000-8000-000000002007',
    'service-invite@example.test',
    '00000000-0000-4000-8000-000000002291',
    '00000000-0000-4000-8000-000000002292'
  )$$,
  'service role creates the audited logical invite through the server RPC'
);
reset role;

select is(
  (select count(*)::integer from public.athlete_invites
   where athlete_id = '00000000-0000-4000-8000-000000002103'
     and redeemed_at is null and revoked_at is null),
  1,
  'server invitation RPC creates one pending logical invite'
);

set local role service_role;
select lives_ok(
  $$select public.complete_admin_password_reset(
    '00000000-0000-4000-8000-000000002001',
    '00000000-0000-4000-8000-000000002005',
    '00000000-0000-4000-8000-000000002289',
    '00000000-0000-4000-8000-000000002290'
  )$$,
  'service role completes the forced-change flag, session handling, and safe audit'
);

select lives_ok(
  $$select * from public.consume_identity_rate_limit(
    'identity:test',
    '00000000-0000-4000-8000-000000002001',
    1,
    3600
  )$$,
  'service role consumes the private rate limit through the narrow wrapper'
);
reset role;

select * from finish();
rollback;
