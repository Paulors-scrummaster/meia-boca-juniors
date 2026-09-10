begin;

select plan(24);

-- Contrato -------------------------------------------------------------------
select has_table('public', 'athlete_card_attributes', 'athlete_card_attributes table exists');
select has_column('public', 'athlete_card_attributes', 'overall', 'overall generated column exists');
select has_function('public', 'set_athlete_attributes',
  array['uuid', 'integer', 'integer', 'integer', 'integer', 'integer', 'integer', 'uuid'],
  'set_athlete_attributes exists with the contract signature');
select has_function('public', 'athlete_card', array['uuid'], 'athlete_card read function exists');

-- Coluna gerada: média aritmética dos seis, arredondada; null se algum for null.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000ca01', 'card-president@example.test'),
  ('00000000-0000-4000-8000-00000000ca02', 'card-coach@example.test'),
  ('00000000-0000-4000-8000-00000000ca03', 'card-athlete@example.test');
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-00000000ca0%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('00000000-0000-4000-8000-00000000ca01', 'PRESIDENT', '00000000-0000-4000-8000-00000000ca01'),
  ('00000000-0000-4000-8000-00000000ca02', 'COACH', '00000000-0000-4000-8000-00000000ca01'),
  ('00000000-0000-4000-8000-00000000ca03', 'ATHLETE', '00000000-0000-4000-8000-00000000ca01');
insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position) values
  ('00000000-0000-4000-8000-00000000cb01', '00000000-0000-4000-8000-00000000ca03', 'Card Um', 'CUm', 61, 'Ataque'),
  ('00000000-0000-4000-8000-00000000cb02', null, 'Card Dois', 'CDois', 62, 'Meio');

-- Insert direto (superuser) para exercitar só a coluna gerada.
insert into public.athlete_card_attributes (athlete_id, pace, shooting, passing, dribbling, defending, physical, updated_by)
values ('00000000-0000-4000-8000-00000000cb01', 80, 80, 80, 80, 80, 80, '00000000-0000-4000-8000-00000000ca01');
select is(
  (select overall from public.athlete_card_attributes where athlete_id = '00000000-0000-4000-8000-00000000cb01'),
  80::smallint, 'overall = round(mean) for a flat 80 profile');

update public.athlete_card_attributes
set pace = 70, shooting = 75, passing = 80, dribbling = 85, defending = 90, physical = 60
where athlete_id = '00000000-0000-4000-8000-00000000cb01';
select is(
  (select overall from public.athlete_card_attributes where athlete_id = '00000000-0000-4000-8000-00000000cb01'),
  77::smallint, 'overall rounds 460/6 = 76.67 up to 77');

update public.athlete_card_attributes set defending = null
where athlete_id = '00000000-0000-4000-8000-00000000cb01';
select is(
  (select overall from public.athlete_card_attributes where athlete_id = '00000000-0000-4000-8000-00000000cb01'),
  null, 'overall is null when any attribute is null');

-- RBAC do comando -----------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000ca03', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ca03","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.set_athlete_attributes('00000000-0000-4000-8000-00000000cb02', 50, 50, 50, 50, 50, 50, gen_random_uuid())$$,
  '42501', 'FORBIDDEN', 'an athlete cannot set card attributes');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000ca02', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ca02","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.set_athlete_attributes('00000000-0000-4000-8000-00000000cb02', 50, 50, 50, 50, 50, 50, gen_random_uuid())$$,
  '42501', 'MFA_REQUIRED', 'setting card attributes needs AAL2');
reset role;

-- Comando válido (COACH + AAL2) --------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000ca02', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ca02","role":"authenticated","aal":"aal2"}', true);

select is(
  (select public.set_athlete_attributes('00000000-0000-4000-8000-00000000cb02',
     90, 84, 78, 88, 40, 82, '00000000-0000-4000-8000-00000000cd01') ->> 'overall'),
  '77', 'command returns the derived overall (462/6 = 77)');

select throws_ok(
  $$select public.set_athlete_attributes('00000000-0000-4000-8000-00000000cb02', 0, 50, 50, 50, 50, 50, gen_random_uuid())$$,
  '22023', 'VALIDATION_ERROR', 'a value below 1 is rejected');
select throws_ok(
  $$select public.set_athlete_attributes('00000000-0000-4000-8000-00000000cb02', 100, 50, 50, 50, 50, 50, gen_random_uuid())$$,
  '22023', 'VALIDATION_ERROR', 'a value above 99 is rejected');
select throws_ok(
  $$select public.set_athlete_attributes('00000000-0000-4000-8000-0000000000ff', 50, 50, 50, 50, 50, 50, gen_random_uuid())$$,
  'P0002', 'NOT_FOUND', 'an unknown athlete is rejected');

-- null é permitido e zera o overall.
select is(
  (select public.set_athlete_attributes('00000000-0000-4000-8000-00000000cb02',
     90, 84, null, 88, 40, 82, '00000000-0000-4000-8000-00000000cd02') ->> 'overall'),
  null, 'a null attribute clears overall');

-- Idempotência por chave.
select is(
  (select public.set_athlete_attributes('00000000-0000-4000-8000-00000000cb02',
     90, 84, 78, 88, 40, 82, '00000000-0000-4000-8000-00000000cd01') ->> 'overall'),
  '77', 'replaying the same key returns the cached result (overall unchanged)');
reset role;

select is(
  (select pace || '/' || coalesce(passing::text, 'null')
   from public.athlete_card_attributes where athlete_id = '00000000-0000-4000-8000-00000000cb02'),
  '90/null', 'the last non-cached command persisted (passing cleared)');
select is(
  (select count(*)::integer from public.audit_logs
   where action = 'ATHLETE_ATTRIBUTES_SET' and resource_id = '00000000-0000-4000-8000-00000000cb02'),
  2, 'each non-cached command wrote an audit entry');
select is(
  (select count(*)::integer from private.command_results
   where command_name = 'set_athlete_attributes' and idempotency_key = '00000000-0000-4000-8000-00000000cd01'),
  1, 'the result is cached under set_athlete_attributes');

-- athlete_card ------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000ca03', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000ca03","role":"authenticated","aal":"aal2"}', true);
select is(
  (select incomplete from public.athlete_card('00000000-0000-4000-8000-00000000cb02')),
  true, 'athlete_card marks the card incomplete while overall is null');
select is(
  (select shirt_number from public.athlete_card('00000000-0000-4000-8000-00000000cb02')),
  62::smallint, 'athlete_card carries the shirt number');
select is(
  (select primary_position from public.athlete_card('00000000-0000-4000-8000-00000000cb02')),
  'Meio', 'athlete_card carries the free-text primary position');
select is(
  (select count(*)::integer from public.athlete_card('00000000-0000-4000-8000-0000000000ff')),
  0, 'athlete_card returns nothing for an unknown athlete');
reset role;

-- RLS: contas ativas leem os atributos; anon não.
select is(
  (select has_table_privilege('authenticated', 'public.athlete_card_attributes', 'select')),
  true, 'authenticated may select athlete_card_attributes');
select is(
  (select has_table_privilege('authenticated', 'public.athlete_card_attributes', 'insert')),
  false, 'authenticated may not insert athlete_card_attributes directly');

select * from finish();
rollback;
