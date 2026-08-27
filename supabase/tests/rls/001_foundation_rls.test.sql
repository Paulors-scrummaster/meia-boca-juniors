begin;

select plan(15);

insert into auth.users (id, email)
values
  ('00000000-0000-0000-0000-000000000501', 'president-rls@example.test'),
  ('00000000-0000-0000-0000-000000000502', 'multi-role-rls@example.test'),
  ('00000000-0000-0000-0000-000000000503', 'disabled-rls@example.test');

insert into public.profiles (id)
values
  ('00000000-0000-0000-0000-000000000501'),
  ('00000000-0000-0000-0000-000000000502');

insert into public.profiles (id, account_status, disabled_at)
values ('00000000-0000-0000-0000-000000000503', 'DISABLED', statement_timestamp());

insert into public.user_roles (user_id, role, assigned_by)
values
  ('00000000-0000-0000-0000-000000000501', 'PRESIDENT', '00000000-0000-0000-0000-000000000501'),
  ('00000000-0000-0000-0000-000000000502', 'ATHLETE', '00000000-0000-0000-0000-000000000501'),
  ('00000000-0000-0000-0000-000000000502', 'COACH', '00000000-0000-0000-0000-000000000501'),
  ('00000000-0000-0000-0000-000000000503', 'ATHLETE', '00000000-0000-0000-0000-000000000501');

insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position)
values (
  '00000000-0000-0000-0000-000000000601',
  '00000000-0000-0000-0000-000000000502',
  'Atleta RLS',
  'RLS',
  11,
  'Meia'
);

insert into public.audit_logs (actor_user_id, action, resource_type, trace_id)
values (
  '00000000-0000-0000-0000-000000000501',
  'RLS_TEST',
  'profile',
  '00000000-0000-0000-0000-000000000699'
);

insert into public.notification_events (
  id,
  kind,
  resource_type,
  resource_id,
  deduplication_key
) values (
  '00000000-0000-0000-0000-000000000701',
  'NOTICE_PUBLISHED',
  'notice',
  '00000000-0000-0000-0000-000000000799',
  'notice:799:published'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000502', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000502","role":"authenticated","aal":"aal1"}', true);

select is((select count(*)::integer from public.profiles), 1, 'an active user reads only their profile');
select is((select count(*)::integer from public.user_roles), 2, 'an active user reads their additive role union');
select ok(private.has_role('ATHLETE'), 'role helper finds the Athlete role');
select ok(private.has_role('COACH'), 'role helper finds the Coach role');
select ok(not private.has_role('PRESIDENT'), 'role helper denies an absent role');
select ok(private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[]), 'role union helper accepts any assigned role');
select ok(not private.current_session_is_aal2(), 'AAL2 helper rejects an AAL1 session');
select is((select count(*)::integer from public.athletes), 1, 'active accounts can read the core roster');
select is((select count(*)::integer from public.audit_logs), 0, 'non-President cannot read audit logs');

select throws_ok(
  $$select count(*) from private.rate_limit_counters$$,
  '42501',
  null,
  'authenticated clients cannot read private rate counters'
);

select throws_ok(
  $$select count(*) from public.notification_events$$,
  '42501',
  null,
  'authenticated clients cannot read notification events'
);

select throws_ok(
  $$insert into public.notification_deliveries (event_id, user_id)
    values ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000502')$$,
  '42501',
  null,
  'authenticated clients cannot write notification deliveries'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000503', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000503","role":"authenticated","aal":"aal2"}', true);
select ok(not private.current_user_is_active(), 'disabled accounts fail the active-account helper');
select is((select count(*)::integer from public.athletes), 0, 'disabled accounts cannot read the roster');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000501', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000501","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::integer from public.audit_logs), 1, 'President with AAL2 can read audit logs');

select * from finish();
rollback;
