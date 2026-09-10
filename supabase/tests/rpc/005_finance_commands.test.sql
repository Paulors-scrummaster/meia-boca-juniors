begin;

select plan(34);

-- Contrato -------------------------------------------------------------------
select has_table('public', 'dues_settings', 'dues_settings table exists');
select has_table('public', 'dues_exemptions', 'dues_exemptions table exists');
select has_table('public', 'athlete_charges', 'athlete_charges table exists');
select has_function('public', 'set_default_dues_amount', array['numeric', 'uuid'], 'set_default_dues_amount exists');
select has_function('public', 'create_manual_charge', array['uuid', 'numeric', 'date', 'text', 'uuid'], 'create_manual_charge exists');
select has_function('public', 'adjust_charge_amount', array['uuid', 'numeric', 'text', 'uuid'], 'adjust_charge_amount exists');
select has_function('public', 'settle_charge', array['uuid', 'text', 'uuid'], 'settle_charge exists');
select has_function('public', 'reverse_charge_settlement', array['uuid', 'text', 'uuid'], 'reverse_charge_settlement exists');
select has_function('public', 'cancel_charge', array['uuid', 'text', 'uuid'], 'cancel_charge exists');
select has_function('public', 'grant_dues_exemption', array['uuid', 'text', 'text', 'uuid'], 'grant_dues_exemption exists');
select has_function('public', 'run_monthly_dues_generation', array['text', 'uuid'], 'run_monthly_dues_generation exists');

-- RBAC / AAL2 ---------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.set_default_dues_amount(40, gen_random_uuid())$$,
  '42501', 'FORBIDDEN', 'athletes cannot configure dues'
);
select throws_ok(
  $$select public.settle_charge(gen_random_uuid(), 'x', gen_random_uuid())$$,
  '42501', 'FORBIDDEN', 'athletes cannot settle charges'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.set_default_dues_amount(40, gen_random_uuid())$$,
  '42501', 'MFA_REQUIRED', 'configuring dues requires AAL2'
);
reset role;

-- Presidente + AAL2 ---------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);

select throws_ok(
  $$select public.set_default_dues_amount(0, gen_random_uuid())$$,
  '22023', 'VALIDATION_ERROR', 'default amount must be positive'
);
select lives_ok(
  $$select public.set_default_dues_amount(40, gen_random_uuid())$$,
  'president sets the default amount'
);

-- Geração mensal + idempotência
select is(
  (public.run_monthly_dues_generation('2026-09', gen_random_uuid()) ->> 'created'),
  '2', 'generation creates one charge per active athlete'
);
select is(
  (public.run_monthly_dues_generation('2026-09', gen_random_uuid()) ->> 'created'),
  '0', 're-running the same period creates no duplicates'
);
reset role;
select is(
  (select count(*)::integer from public.athlete_charges where type = 'MONTHLY_AUTOMATIC' and period = '2026-09'),
  2, 'exactly two automatic charges for 2026-09'
);
select is(
  (select distinct due_date from public.athlete_charges where period = '2026-09'),
  date '2026-09-10', 'automatic charges are due on the 10th'
);

-- Isenção: pula o atleta na geração do mês seguinte
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$select public.grant_dues_exemption('20000000-0000-4000-8000-000000000004', '2026-10', 'bolsista', gen_random_uuid())$$,
  'president grants a period exemption'
);
select is(
  (public.run_monthly_dues_generation('2026-10', gen_random_uuid()) ->> 'created'),
  '1', 'the exempted athlete is skipped'
);
select is(
  (public.run_monthly_dues_generation('2026-10', gen_random_uuid()) ->> 'skippedExempt'),
  '1', 'the skip is reported as an exemption'
);

-- create_manual_charge
select throws_ok(
  $$select public.create_manual_charge('20000000-0000-4000-8000-000000000003', 25, current_date, 'MONTHLY_AUTOMATIC', gen_random_uuid())$$,
  '22023', 'VALIDATION_ERROR', 'manual charges cannot be typed MONTHLY_AUTOMATIC'
);
select is(
  (public.create_manual_charge('20000000-0000-4000-8000-000000000003', 25, current_date + 5, 'MANUAL_OVERRIDE', gen_random_uuid()) ->> 'status'),
  'PENDING', 'a manual charge starts PENDING'
);

-- Máquina de estados (a cobrança automática de 2026-09 do atleta ...003).
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);

select is(
  (public.settle_charge(
    (select id from public.athlete_charges where athlete_id = '20000000-0000-4000-8000-000000000003' and type = 'MONTHLY_AUTOMATIC' and period = '2026-09'),
    'PIX conferido', gen_random_uuid()) ->> 'status'),
  'PAID', 'settle moves PENDING -> PAID'
);
select throws_ok(
  $$select public.settle_charge(
      (select id from public.athlete_charges where athlete_id = '20000000-0000-4000-8000-000000000003' and type = 'MONTHLY_AUTOMATIC' and period = '2026-09'),
      'de novo', gen_random_uuid())$$,
  'P0001', 'CHARGE_LOCKED', 'a PAID charge cannot be settled again'
);
select is(
  (public.reverse_charge_settlement(
    (select id from public.athlete_charges where athlete_id = '20000000-0000-4000-8000-000000000003' and type = 'MONTHLY_AUTOMATIC' and period = '2026-09'),
    'engano', gen_random_uuid()) ->> 'status'),
  'PENDING', 'reverse restores PENDING when the due date has not passed'
);
select is(
  (public.cancel_charge(
    (select id from public.athlete_charges where athlete_id = '20000000-0000-4000-8000-000000000003' and type = 'MONTHLY_AUTOMATIC' and period = '2026-09'),
    'acordo verbal', gen_random_uuid()) ->> 'status'),
  'CANCELLED', 'cancel voids the charge'
);
select throws_ok(
  $$select public.cancel_charge(
      (select id from public.athlete_charges where athlete_id = '20000000-0000-4000-8000-000000000003' and type = 'MONTHLY_AUTOMATIC' and period = '2026-09'),
      'x', gen_random_uuid())$$,
  'P0001', 'CHARGE_LOCKED', 'a CANCELLED charge is a final state'
);
select throws_ok(
  $$select public.adjust_charge_amount(
      (select id from public.athlete_charges where athlete_id = '20000000-0000-4000-8000-000000000003' and type = 'MONTHLY_AUTOMATIC' and period = '2026-09'),
      99, 'x', gen_random_uuid())$$,
  'P0001', 'CHARGE_LOCKED', 'a CANCELLED charge cannot be adjusted'
);
reset role;

select is(
  (select settled_by from public.athlete_charges
   where athlete_id = '20000000-0000-4000-8000-000000000003' and type = 'MONTHLY_AUTOMATIC' and period = '2026-09'),
  null::uuid, 'reversing then cancelling clears the settlement metadata'
);
select ok(
  (select count(*) from public.audit_logs where action in
    ('CHARGE_SETTLED', 'CHARGE_SETTLEMENT_REVERSED', 'CHARGE_CANCELLED', 'MONTHLY_DUES_GENERATED', 'DUES_EXEMPTION_GRANTED')) >= 5,
  'every finance transition writes an audit entry'
);

-- Sem temporada ativa
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
select public.close_season('30000000-0000-4000-8000-000000000001', '2026-12-31', gen_random_uuid());
select throws_ok(
  $$select public.run_monthly_dues_generation('2026-11', gen_random_uuid())$$,
  'P0001', 'NO_ACTIVE_SEASON', 'generation needs an active season'
);
reset role;

select * from finish();
rollback;
