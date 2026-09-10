begin;

select plan(20);

-- Contrato -------------------------------------------------------------------
select has_function('public', 'open_season', array['integer', 'date', 'uuid'], 'open_season command exists');
select has_function('public', 'close_season', array['uuid', 'date', 'uuid'], 'close_season command exists');
select has_column('public', 'seasons', 'starts_on', 'seasons gained starts_on');
select has_column('public', 'seasons', 'ends_on', 'seasons gained ends_on');
select has_column('public', 'seasons', 'status', 'seasons gained status');

-- Backfill da linha semeada -----------------------------------------------------
select is(
  (select status::text from public.seasons where id = '30000000-0000-4000-8000-000000000001'),
  'ACTIVE', 'seeded season backfilled to ACTIVE'
);
select is(
  (select starts_on from public.seasons where id = '30000000-0000-4000-8000-000000000001'),
  date '2026-01-01', 'seeded season keeps its start date'
);
select is(
  (select is_active from public.seasons where id = '30000000-0000-4000-8000-000000000001'),
  true, 'is_active stays synced with ACTIVE status'
);

-- Atores de teste -------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000019001', 'season-president@example.test'),
  ('00000000-0000-4000-8000-000000019002', 'season-coach@example.test'),
  ('00000000-0000-4000-8000-000000019003', 'season-athlete@example.test');
insert into public.profiles (id)
  select id from auth.users where id::text like '00000000-0000-4000-8000-00000001900%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('00000000-0000-4000-8000-000000019001', 'PRESIDENT', '00000000-0000-4000-8000-000000019001'),
  ('00000000-0000-4000-8000-000000019002', 'COACH', '00000000-0000-4000-8000-000000019001'),
  ('00000000-0000-4000-8000-000000019003', 'ATHLETE', '00000000-0000-4000-8000-000000019001');

-- RBAC / AAL2 ---------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000019003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000019003","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.open_season(2099, '2099-01-01', gen_random_uuid())$$,
  '42501', 'FORBIDDEN', 'athletes cannot open a season'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000019002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000019002","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.open_season(2099, '2099-01-01', gen_random_uuid())$$,
  '42501', 'MFA_REQUIRED', 'opening a season requires AAL2'
);
reset role;

-- Uma ativa por vez -------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000019002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000019002","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.open_season(2027, '2027-01-01', gen_random_uuid())$$,
  'P0001', 'SEASON_ALREADY_ACTIVE', 'cannot open a second active season'
);
reset role;

-- Fecha a temporada semeada e abre a próxima --------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000019001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000019001","role":"authenticated","aal":"aal2"}', true);

select lives_ok(
  $$select public.close_season('30000000-0000-4000-8000-000000000001', '2026-12-31', gen_random_uuid())$$,
  'president closes the active season'
);
select throws_ok(
  $$select public.close_season('30000000-0000-4000-8000-000000000001', '2026-12-31', gen_random_uuid())$$,
  'P0001', 'SEASON_NOT_ACTIVE', 'a closed season cannot be closed again'
);

-- Idempotência do open ------------------------------------------------------
select public.open_season(2027, '2027-01-01', '00000000-0000-4000-8000-0000000190aa');
select public.open_season(2027, '2027-01-01', '00000000-0000-4000-8000-0000000190aa');
reset role;

select is(
  (select count(*)::integer from public.seasons where year = 2027),
  1, 'open_season is idempotent per key — one 2027 row'
);
select is(
  (select status::text from public.seasons where year = 2027),
  'ACTIVE', 'newly opened season is ACTIVE'
);
select is(
  (select is_active from public.seasons where year = 2027),
  true, 'newly opened season is_active flag is synced'
);
select is(
  (select ends_on from public.seasons where year = 2027),
  null, 'an ACTIVE season has no end date'
);
select is(
  (select count(*)::integer from public.seasons where status = 'ACTIVE'),
  1, 'still exactly one active season after the roll-over'
);
select is(
  (select status::text from public.seasons where id = '30000000-0000-4000-8000-000000000001'),
  'CLOSED', 'the prior season stays CLOSED after a new one opens'
);
select is(
  (select ends_on from public.seasons where id = '30000000-0000-4000-8000-000000000001'),
  date '2026-12-31', 'the prior season keeps its recorded end date'
);

select * from finish();
rollback;
