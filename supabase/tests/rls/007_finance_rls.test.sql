begin;

select plan(11);

-- Prepara dados: valor padrão + duas cobranças automáticas.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
select public.set_default_dues_amount(40, gen_random_uuid());
select public.run_monthly_dues_generation('2026-09', gen_random_uuid());
reset role;

select is(
  (select count(*)::integer from public.athlete_charges),
  2, 'two charges exist for the test'
);

-- Presidente enxerga todas as cobranças e o panorama completo.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::integer from public.athlete_charges), 2, 'PRESIDENT reads every charge');
select is(
  (select sum(pending_count)::integer from public.finance_overview),
  2, 'PRESIDENT sees every athlete pending count in finance_overview'
);
reset role;

-- Atleta enxerga apenas as próprias cobranças.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}', true);
select is(
  (select count(*)::integer from public.athlete_charges),
  1, 'ATHLETE reads only their own charge'
);
select is(
  (select count(distinct athlete_id)::integer from public.athlete_charges),
  1, 'ATHLETE never sees another athlete row'
);
select is(
  (select athlete_id from public.athlete_charges),
  '20000000-0000-4000-8000-000000000003'::uuid, 'the visible charge is the caller''s own'
);
select is(
  (select coalesce(sum(pending_count), 0)::integer from public.finance_overview),
  1, 'finance_overview via security_invoker scopes aggregates to the caller'
);
select throws_ok(
  $$insert into public.athlete_charges (athlete_id, season_id, amount, due_date, type)
    values ('20000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 1, current_date, 'MANUAL_OVERRIDE')$$,
  '42501', null, 'authenticated has no direct INSERT on athlete_charges'
);
select throws_ok(
  $$update public.athlete_charges set amount = 0$$,
  '42501', null, 'authenticated has no direct UPDATE on athlete_charges'
);
reset role;

-- Badge é puramente visual e reflete o pior status pendente.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
select is(
  public.athlete_delinquency_badge('20000000-0000-4000-8000-000000000003'),
  'PENDING', 'an athlete with a PENDING charge shows the Pendente badge'
);
select is(
  public.athlete_delinquency_badge('20000000-0000-4000-8000-000000000005'),
  'NONE', 'an athlete with no charges shows no badge'
);
reset role;

select * from finish();
rollback;
