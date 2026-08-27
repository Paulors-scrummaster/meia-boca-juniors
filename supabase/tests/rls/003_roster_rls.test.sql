begin;

select plan(20);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000004001', 'president-roster@example.test'),
  ('00000000-0000-4000-8000-000000004002', 'coach-roster@example.test'),
  ('00000000-0000-4000-8000-000000004003', 'athlete-roster@example.test'),
  ('00000000-0000-4000-8000-000000004004', 'multi-roster@example.test'),
  ('00000000-0000-4000-8000-000000004005', 'disabled-roster@example.test');

insert into public.profiles (id)
values
  ('00000000-0000-4000-8000-000000004001'),
  ('00000000-0000-4000-8000-000000004002'),
  ('00000000-0000-4000-8000-000000004003'),
  ('00000000-0000-4000-8000-000000004004');

insert into public.profiles (id, account_status, disabled_at)
values ('00000000-0000-4000-8000-000000004005', 'DISABLED', statement_timestamp());

insert into public.user_roles (user_id, role, assigned_by)
values
  ('00000000-0000-4000-8000-000000004001', 'PRESIDENT', '00000000-0000-4000-8000-000000004001'),
  ('00000000-0000-4000-8000-000000004002', 'COACH', '00000000-0000-4000-8000-000000004001'),
  ('00000000-0000-4000-8000-000000004003', 'ATHLETE', '00000000-0000-4000-8000-000000004001'),
  ('00000000-0000-4000-8000-000000004004', 'PRESIDENT', '00000000-0000-4000-8000-000000004001'),
  ('00000000-0000-4000-8000-000000004004', 'COACH', '00000000-0000-4000-8000-000000004001'),
  ('00000000-0000-4000-8000-000000004004', 'ATHLETE', '00000000-0000-4000-8000-000000004001'),
  ('00000000-0000-4000-8000-000000004005', 'PRESIDENT', '00000000-0000-4000-8000-000000004001');

insert into public.athletes (
  id, user_id, full_name, shirt_name, shirt_number, primary_position, photo_path
) values
  ('00000000-0000-4000-8000-000000004101', '00000000-0000-4000-8000-000000004003', 'Atleta Visível', 'Visível', 31, 'Ataque', 'athletes/00000000-0000-4000-8000-000000004101/avatar.webp'),
  ('00000000-0000-4000-8000-000000004102', '00000000-0000-4000-8000-000000004004', 'Atleta Multi', 'Multi', 32, 'Defesa', null);

select is((select public from storage.buckets where id = 'athlete-avatars'), false, 'avatar bucket is private');
select is((select file_size_limit::bigint from storage.buckets where id = 'athlete-avatars'), 1048576::bigint, 'avatar bucket enforces one megabyte');

set local role anon;
select throws_ok($$select count(*) from public.athletes$$, '42501', null, 'visitor cannot read roster');
select is((select count(*)::integer from storage.objects where bucket_id = 'athlete-avatars'), 0, 'visitor cannot read private avatar objects');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000004003","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::integer from public.athletes where id in ('00000000-0000-4000-8000-000000004101', '00000000-0000-4000-8000-000000004102')), 2, 'active Athlete reads roster');
select throws_ok(
  $$select public.create_athlete('Negado', 'Negado', 33::smallint, 'Ataque', 'ACTIVE', null, '00000000-0000-4000-8000-000000004290')$$,
  '42501', 'President with AAL2 required', 'Athlete cannot create roster records'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('athlete-avatars', 'athletes/00000000-0000-4000-8000-000000004101/avatar.webp', auth.uid())$$,
  '42501', null, 'Athlete cannot upload avatar objects'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000004002","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::integer from public.athletes where id in ('00000000-0000-4000-8000-000000004101', '00000000-0000-4000-8000-000000004102')), 2, 'active Coach reads roster');
select throws_ok(
  $$select public.set_athlete_status('00000000-0000-4000-8000-000000004101', 'INJURED', null, '00000000-0000-4000-8000-000000004291')$$,
  '42501', 'President with AAL2 required', 'Coach cannot mutate athlete status'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000004001","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.create_athlete('Sem AAL2', 'Sem AAL2', 33::smallint, 'Ataque', 'ACTIVE', null, '00000000-0000-4000-8000-000000004292')$$,
  '42501', 'President with AAL2 required', 'President without AAL2 cannot mutate roster'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004005', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000004005","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::integer from public.athletes), 0, 'disabled President cannot read roster');
select throws_ok(
  $$select public.create_athlete('Desativado', 'Desativado', 33::smallint, 'Ataque', 'ACTIVE', null, '00000000-0000-4000-8000-000000004293')$$,
  '42501', 'President with AAL2 required', 'disabled President cannot mutate roster'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000004001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000004001","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$select public.create_athlete('Novo Atleta', 'Novo', 33::smallint, 'Meio-campo', 'ACTIVE', null, '00000000-0000-4000-8000-000000004294')$$,
  'President with AAL2 creates an athlete through audited RPC'
);
select throws_ok(
  $$update public.athletes set shirt_name = 'Direto' where id = '00000000-0000-4000-8000-000000004101'$$,
  '42501', null, 'even President cannot bypass audited mutation RPCs'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id)
    values ('athlete-avatars', 'athletes/00000000-0000-4000-8000-000000004101/avatar.webp', auth.uid())$$,
  'President with AAL2 can write a canonical private avatar object'
);
select is((select count(*)::integer from storage.objects where bucket_id = 'athlete-avatars'), 1, 'active authenticated users can read linked avatar objects');
select lives_ok(
  $$select public.set_athlete_status(
    '00000000-0000-4000-8000-000000004102', 'INACTIVE', null,
    '00000000-0000-4000-8000-000000004295'
  )$$,
  'President inactivates a multi-role athlete atomically'
);
reset role;

select is((select count(*)::integer from public.user_roles where user_id = '00000000-0000-4000-8000-000000004004' and role = 'ATHLETE'), 0, 'inactivation removes only Athlete role');
select is((select count(*)::integer from public.user_roles where user_id = '00000000-0000-4000-8000-000000004004' and role in ('PRESIDENT', 'COACH')), 2, 'inactivation preserves President and Coach roles');
select is((select count(*)::integer from public.audit_logs where resource_id = '00000000-0000-4000-8000-000000004102' and action = 'ATHLETE_INACTIVATED'), 1, 'inactivation is audited once');

select * from finish();
rollback;
