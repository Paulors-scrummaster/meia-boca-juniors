begin;

select plan(37);

select has_function('public', 'finalize_sumula', array['uuid', 'jsonb', 'uuid'],
  'finalize_sumula exists with the contract signature');

-- Atores ------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000fa001', 'fin-president@example.test'),
  ('00000000-0000-4000-8000-0000000fa002', 'fin-coach@example.test'),
  ('00000000-0000-4000-8000-0000000fa003', 'fin-recorder@example.test');
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000fa00%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('00000000-0000-4000-8000-0000000fa001', 'PRESIDENT', '00000000-0000-4000-8000-0000000fa001'),
  ('00000000-0000-4000-8000-0000000fa002', 'COACH', '00000000-0000-4000-8000-0000000fa001'),
  ('00000000-0000-4000-8000-0000000fa003', 'ATHLETE', '00000000-0000-4000-8000-0000000fa001');

-- Elenco (sem user vinculado — só precisam existir no lineup) ------------------
insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position) values
  ('00000000-0000-4000-8000-0000000fa101', null, 'Fin GK',  'FGK',  87, 'Goleiro'),
  ('00000000-0000-4000-8000-0000000fa102', null, 'Fin Nine', 'F9',  88, 'Ataque'),
  ('00000000-0000-4000-8000-0000000fa103', null, 'Fin Ten',  'F10', 89, 'Meio'),
  ('00000000-0000-4000-8000-0000000fa104', null, 'Fin Zag',  'FZ',  90, 'Defesa'),
  ('00000000-0000-4000-8000-0000000fa105', null, 'Fin Res',  'FR',  91, 'Meio'),
  ('00000000-0000-4000-8000-0000000fa106', null, 'Fin GK2',  'FG2', 92, 'Goleiro');

update public.seasons set is_active = false;
insert into public.seasons (id, year, is_active, starts_on, status)
values ('00000000-0000-4000-8000-0000000fa201', 2045, true, '2045-01-01', 'ACTIVE');
insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, created_by, updated_by)
values ('00000000-0000-4000-8000-0000000fa301', '00000000-0000-4000-8000-0000000fa201', 'Finalize FC',
        statement_timestamp() - interval '2 hours', statement_timestamp() - interval '1 day',
        '00000000-0000-4000-8000-0000000fa001', '00000000-0000-4000-8000-0000000fa001');
insert into public.lineups (id, match_id, revision, formation_code, created_by)
values ('00000000-0000-4000-8000-0000000fa401', '00000000-0000-4000-8000-0000000fa301', 1, '4-3-3', '00000000-0000-4000-8000-0000000fa001');
insert into public.lineup_players (lineup_id, athlete_id, assignment, tactical_position, position_x, position_y, display_order) values
  ('00000000-0000-4000-8000-0000000fa401', '00000000-0000-4000-8000-0000000fa101', 'STARTER', 'GOL', 50, 5, 0),
  ('00000000-0000-4000-8000-0000000fa401', '00000000-0000-4000-8000-0000000fa102', 'STARTER', 'ATA', 50, 85, 1),
  ('00000000-0000-4000-8000-0000000fa401', '00000000-0000-4000-8000-0000000fa103', 'STARTER', 'MEI', 50, 55, 2),
  ('00000000-0000-4000-8000-0000000fa401', '00000000-0000-4000-8000-0000000fa104', 'STARTER', 'ZAG', 50, 25, 3);
insert into public.lineup_players (lineup_id, athlete_id, assignment, display_order) values
  ('00000000-0000-4000-8000-0000000fa401', '00000000-0000-4000-8000-0000000fa105', 'RESERVE', 0),
  ('00000000-0000-4000-8000-0000000fa401', '00000000-0000-4000-8000-0000000fa106', 'RESERVE', 1);
update public.lineups set status = 'PUBLISHED', published_by = '00000000-0000-4000-8000-0000000fa001', published_at = statement_timestamp()
where id = '00000000-0000-4000-8000-0000000fa401';

-- Coach + AAL2 habilita o ao vivo (Registrador = atleta fa003).
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000fa002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000fa002","role":"authenticated","aal":"aal2"}', true);
select public.enable_live_recording(
  '00000000-0000-4000-8000-0000000fa301', '00000000-0000-4000-8000-0000000fa003',
  '00000000-0000-4000-8000-0000000fa101', '00000000-0000-4000-8000-0000000faf01');
reset role;

-- Registrador computa os eventos.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000fa003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000fa003","role":"authenticated","aal":"aal1"}', true);
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000fa301', '00000000-0000-4000-8000-0000000fc001',
     10, 'GOAL', '00000000-0000-4000-8000-0000000fa102', '00000000-0000-4000-8000-0000000fa103', 'MBJ',
     '00000000-0000-4000-8000-0000000fe001') ->> 'deduped'),
  'false', 'goal 1 (F9, assist F10) logged');
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000fa301', '00000000-0000-4000-8000-0000000fc002',
     20, 'GOAL', '00000000-0000-4000-8000-0000000fa103', null, 'MBJ',
     '00000000-0000-4000-8000-0000000fe002') ->> 'deduped'),
  'false', 'goal 2 (F10, no assist) logged');
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000fa301', '00000000-0000-4000-8000-0000000fc003',
     25, 'GOAL', '00000000-0000-4000-8000-0000000fa101', null, 'OPPONENT',
     '00000000-0000-4000-8000-0000000fe003') ->> 'deduped'),
  'false', 'opponent goal logged');
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000fa301', '00000000-0000-4000-8000-0000000fc004',
     30, 'YELLOW_CARD', '00000000-0000-4000-8000-0000000fa104', null, 'MBJ',
     '00000000-0000-4000-8000-0000000fe004') ->> 'deduped'),
  'false', 'yellow card for FZ logged');
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000fa301', '00000000-0000-4000-8000-0000000fc005',
     40, 'GOAL', '00000000-0000-4000-8000-0000000fa102', null, 'MBJ',
     '00000000-0000-4000-8000-0000000fe005') ->> 'deduped'),
  'false', 'a third MBJ goal is logged...');
select is(
  (select public.undo_live_event('00000000-0000-4000-8000-0000000fa301', '00000000-0000-4000-8000-0000000fb001') ->> 'eventType'),
  'GOAL', '...then undone — it must not reach consolidation');
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000fa301', '00000000-0000-4000-8000-0000000fc006',
     60, 'SUBSTITUTION', '00000000-0000-4000-8000-0000000fa105', '00000000-0000-4000-8000-0000000fa103', 'MBJ',
     '00000000-0000-4000-8000-0000000fe006') ->> 'deduped'),
  'false', 'substitution: FR in for F10 at 60');
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000fa301', '00000000-0000-4000-8000-0000000fc007',
     70, 'SUBSTITUTION', '00000000-0000-4000-8000-0000000fa106', '00000000-0000-4000-8000-0000000fa101', 'MBJ',
     '00000000-0000-4000-8000-0000000fe007') ->> 'deduped'),
  'false', 'substitution: FG2 in for the keeper at 70');
select is(
  (select public.end_live_recording('00000000-0000-4000-8000-0000000fa301', '00000000-0000-4000-8000-0000000faf02') ->> 'status'),
  'IN_REVIEW', 'recorder ends the recording phase');
reset role;

-- Um Registrador sem papel de comissão não finaliza (FR-034, cenário 9, SC-013).
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000fa003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000fa003","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.finalize_sumula('00000000-0000-4000-8000-0000000fa301', '{}'::jsonb, gen_random_uuid())$$,
  '42501', 'FORBIDDEN', 'a non-committee recorder cannot finalize the sumula');
reset role;

-- Fila offline pendente bloqueia o fecho.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000fa002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000fa002","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.finalize_sumula('00000000-0000-4000-8000-0000000fa301', '{"pendingOfflineEvents": 2}'::jsonb, gen_random_uuid())$$,
  'P0001', 'PENDING_OFFLINE_EVENTS', 'a declared offline backlog (count) blocks finalize');
select throws_ok(
  $$select public.finalize_sumula('00000000-0000-4000-8000-0000000fa301', '{"pendingOfflineEvents": true}'::jsonb, gen_random_uuid())$$,
  'P0001', 'PENDING_OFFLINE_EVENTS', 'a declared offline backlog (bool) blocks finalize');
reset role;

-- Fecho válido -------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000fa002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000fa002","role":"authenticated","aal":"aal2"}', true);
select is(
  (select public.finalize_sumula('00000000-0000-4000-8000-0000000fa301', '{}'::jsonb,
     '00000000-0000-4000-8000-0000000fd001') ->> 'mbjScore'),
  '2', 'MBJ score is derived from the two non-undone MBJ goals');
select is(
  (select public.finalize_sumula('00000000-0000-4000-8000-0000000fa301', '{}'::jsonb,
     '00000000-0000-4000-8000-0000000fd001') ->> 'opponentScore'),
  '1', 'opponent score is the single OPPONENT goal (idempotent replay)');
select is(
  (select public.finalize_sumula('00000000-0000-4000-8000-0000000fa301', '{}'::jsonb,
     '00000000-0000-4000-8000-0000000fd001') ->> 'revision'),
  '1', 'first consolidation revision');
reset role;

select is(
  (select count(*)::integer from public.match_consolidations where match_id = '00000000-0000-4000-8000-0000000fa301'),
  1, 'exactly one consolidation revision was written');
select is(
  (select mbj_score || '-' || opponent_score from public.match_consolidations where match_id = '00000000-0000-4000-8000-0000000fa301'),
  '2-1', 'scores stored verbatim on the consolidation');
select is(
  (select count(*)::integer from public.match_goals gg
   join public.match_consolidations c on c.id = gg.consolidation_id
   where c.match_id = '00000000-0000-4000-8000-0000000fa301'),
  2, 'two match_goals rows — the undone goal is excluded');
select is(
  (select gg.scorer_athlete_id || '/' || coalesce(gg.assistant_athlete_id::text, 'none')
   from public.match_goals gg join public.match_consolidations c on c.id = gg.consolidation_id
   where c.match_id = '00000000-0000-4000-8000-0000000fa301' and gg.sequence_number = 1),
  '00000000-0000-4000-8000-0000000fa102/00000000-0000-4000-8000-0000000fa103', 'goal 1: scorer F9, assist F10');
select is(
  (select gg.scorer_athlete_id || '/' || coalesce(gg.assistant_athlete_id::text, 'none')
   from public.match_goals gg join public.match_consolidations c on c.id = gg.consolidation_id
   where c.match_id = '00000000-0000-4000-8000-0000000fa301' and gg.sequence_number = 2),
  '00000000-0000-4000-8000-0000000fa103/none', 'goal 2: scorer F10, no assist');

select is(
  (select ca.athlete_id || '/' || ca.card_type::text || '/' || ca.minute::text
   from public.match_cards ca join public.match_consolidations c on c.id = ca.consolidation_id
   where c.match_id = '00000000-0000-4000-8000-0000000fa301'),
  '00000000-0000-4000-8000-0000000fa104/YELLOW/30', 'one YELLOW card, FZ, minute 30');
select is(
  (select count(*)::integer from public.match_substitutions su
   join public.match_consolidations c on c.id = su.consolidation_id
   where c.match_id = '00000000-0000-4000-8000-0000000fa301'),
  2, 'two substitutions recorded');
select is(
  (select su.out_athlete_id || '->' || su.in_athlete_id
   from public.match_substitutions su join public.match_consolidations c on c.id = su.consolidation_id
   where c.match_id = '00000000-0000-4000-8000-0000000fa301' and su.minute = 60),
  '00000000-0000-4000-8000-0000000fa103->00000000-0000-4000-8000-0000000fa105', 'sub at 60: F10 off, FR on');

select is(
  (select count(*)::integer from public.match_goalkeeper_assignments ga
   join public.match_consolidations c on c.id = ga.consolidation_id
   where c.match_id = '00000000-0000-4000-8000-0000000fa301'),
  2, 'the keeper timeline has two windows');
select is(
  (select ga.from_minute || '-' || coalesce(ga.to_minute::text, 'end')
   from public.match_goalkeeper_assignments ga join public.match_consolidations c on c.id = ga.consolidation_id
   where c.match_id = '00000000-0000-4000-8000-0000000fa301' and ga.athlete_id = '00000000-0000-4000-8000-0000000fa101'),
  '0-70', 'starting keeper FGK covers minute 0 to 70');
select is(
  (select ga.from_minute || '-' || coalesce(ga.to_minute::text, 'end')
   from public.match_goalkeeper_assignments ga join public.match_consolidations c on c.id = ga.consolidation_id
   where c.match_id = '00000000-0000-4000-8000-0000000fa301' and ga.athlete_id = '00000000-0000-4000-8000-0000000fa106'),
  '70-end', 'substitute keeper FG2 covers 70 to the end (open window)');

select is(
  (select status::text from public.live_match_setups where match_id = '00000000-0000-4000-8000-0000000fa301'),
  'FINALIZED', 'the live setup lands in FINALIZED');
select is(
  (select status::text from public.matches where id = '00000000-0000-4000-8000-0000000fa301'),
  'COMPLETED', 'the match is marked COMPLETED by the consolidation chain');
select isnt(
  (select current_consolidation_id from public.matches where id = '00000000-0000-4000-8000-0000000fa301'),
  null, 'the match points at its consolidation');
select is(
  (select r.closes_at - r.opens_at
   from public.mvp_voting_rounds r join public.match_consolidations c on c.id = r.consolidation_id
   where c.match_id = '00000000-0000-4000-8000-0000000fa301'),
  interval '24 hours', 'finalize opens the 24 h MVP voting round');
select is(
  (select count(*)::integer from public.notification_events e
   where e.kind = 'VOTING_OPENED'
     and e.resource_id in (
       select r.id from public.mvp_voting_rounds r
       join public.match_consolidations c on c.id = r.consolidation_id
       where c.match_id = '00000000-0000-4000-8000-0000000fa301')),
  1, 'a VOTING_OPENED notification is enqueued');
select is(
  (select count(*)::integer from public.audit_logs
   where action = 'SUMULA_FINALIZED' and resource_id = '00000000-0000-4000-8000-0000000fa301'),
  1, 'a SUMULA_FINALIZED audit entry is written');
select is(
  (select count(*)::integer from private.command_results
   where command_name = 'finalize_sumula' and idempotency_key = '00000000-0000-4000-8000-0000000fd001'),
  1, 'the result is cached under finalize_sumula');

-- Idempotência + trava --------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000fa002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000fa002","role":"authenticated","aal":"aal2"}', true);
select is(
  (select public.finalize_sumula('00000000-0000-4000-8000-0000000fa301', '{}'::jsonb,
     '00000000-0000-4000-8000-0000000fd001') ->> 'consolidationId'),
  (select current_consolidation_id::text from public.matches where id = '00000000-0000-4000-8000-0000000fa301'),
  'replaying the same idempotency key returns the same consolidation');
select throws_ok(
  $$select public.finalize_sumula('00000000-0000-4000-8000-0000000fa301', '{}'::jsonb, gen_random_uuid())$$,
  'P0001', 'SUMULA_NOT_IN_REVIEW', 'a fresh key cannot re-finalize — the setup already left IN_REVIEW');
reset role;

select is(
  (select count(*)::integer from public.match_consolidations where match_id = '00000000-0000-4000-8000-0000000fa301'),
  1, 'still exactly one consolidation revision after the replays');

select * from finish();
rollback;
