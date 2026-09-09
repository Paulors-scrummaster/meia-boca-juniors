begin;

select plan(14);

-- Cenário: uma partida é finalizada; `reopen_match_statistics` invalida a
-- consolidação; uma nova revisão corrigida empurra o atleta acima de um gatilho;
-- então `private.evaluate_trophies` concede o troféu recém-qualificado SEM
-- duplicar nada e SEM tocar nos troféus já concedidos (Edge Case "Trophy trigger
-- met retroactively after a súmula edit"; contracts/live-match.md "Correção
-- pós-finalização").

insert into auth.users (id, email) values
  ('d1000000-0000-4000-8000-000000000001', 'rx-pres@example.test'),
  ('d1000000-0000-4000-8000-000000000002', 'rx-ace@example.test'),
  ('d1000000-0000-4000-8000-000000000003', 'rx-bob@example.test');
insert into public.profiles (id) select id from auth.users where id::text like 'd1000000-%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('d1000000-0000-4000-8000-000000000001', 'PRESIDENT', 'd1000000-0000-4000-8000-000000000001'),
  ('d1000000-0000-4000-8000-000000000002', 'ATHLETE', 'd1000000-0000-4000-8000-000000000001'),
  ('d1000000-0000-4000-8000-000000000003', 'ATHLETE', 'd1000000-0000-4000-8000-000000000001');
insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position) values
  ('db000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002', 'RX Ace', 'RXAce', 77, 'Ataque'),
  ('db000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000003', 'RX Bob', 'RXBob', 78, 'Meio');

update public.seasons set is_active = false;
insert into public.seasons (id, year, is_active, starts_on, status, ends_on)
values ('d6000000-0000-4000-8000-000000000001', 2100, false, '2100-01-01', 'CLOSED', '2100-12-31');

-- 10 partidas COMPLETED; Ace titular em todas (→ VETERANO), 1 gol em M1..M9 (=9).
insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, status, created_by, updated_by)
select ('b0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       'd6000000-0000-4000-8000-000000000001', 'RX Rival ' || i,
       now() - (40 - i) * interval '1 day', now() - (41 - i) * interval '1 day', 'COMPLETED',
       'd1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001'
from generate_series(1, 10) i;
insert into public.lineups (id, match_id, revision, formation_code, created_by)
select ('b1000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       ('b0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       1, '4-3-3', 'd1000000-0000-4000-8000-000000000001'
from generate_series(1, 10) i;
insert into public.lineup_players (lineup_id, athlete_id, assignment, tactical_position, position_x, position_y, display_order)
select ('b1000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       'db000000-0000-4000-8000-000000000001', 'STARTER', 'ATA', 50, 85, 0
from generate_series(1, 10) i;
update public.lineups set status = 'PUBLISHED',
       published_by = 'd1000000-0000-4000-8000-000000000001', published_at = now()
where id::text like 'b1000000-%';
insert into public.match_consolidations (id, match_id, lineup_id, revision, mbj_score, opponent_score, status, idempotency_key, consolidated_by)
select ('b2000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       ('b0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       ('b1000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       1, 1, 0, 'VALID', gen_random_uuid(), 'd1000000-0000-4000-8000-000000000001'
from generate_series(1, 10) i;
update public.matches m set current_consolidation_id = c.id
from public.match_consolidations c where c.match_id = m.id and m.id::text like 'b0000000-%';
-- Ace marca em M1..M9 (9). M10: quem marca é o Bob → Ace continua com 9 na temporada.
insert into public.match_goals (consolidation_id, scorer_athlete_id, assistant_athlete_id, sequence_number, created_by)
select ('b2000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       'db000000-0000-4000-8000-000000000001', null, 1, 'd1000000-0000-4000-8000-000000000001'
from generate_series(1, 9) i;
insert into public.match_goals (consolidation_id, scorer_athlete_id, assistant_athlete_id, sequence_number, created_by)
values ('b2000000-0000-4000-8000-000000000010', 'db000000-0000-4000-8000-000000000002', null, 1, 'd1000000-0000-4000-8000-000000000001');

-- Avaliação #1 -----------------------------------------------------------------
select private.evaluate_trophies('d6000000-0000-4000-8000-000000000001',
  array['db000000-0000-4000-8000-000000000001']::uuid[]);
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'db000000-0000-4000-8000-000000000001' and trophy_code = 'VETERANO'),
  1, 'run #1: Ace earns VETERANO (10 finalized matches)');
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'db000000-0000-4000-8000-000000000001' and trophy_code = 'ARTILHEIRO'),
  0, 'run #1: Ace does not yet have ARTILHEIRO (9 goals)');

-- Reabre M10 e grava uma revisão corrigida em que o Ace marca (→ 10 gols) --------
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$select public.reopen_match_statistics('b0000000-0000-4000-8000-000000000010', 'gol do Bob era do Ace', gen_random_uuid())$$,
  'president reopens M10 statistics');
reset role;

select is(
  (select status::text from public.match_consolidations where id = 'b2000000-0000-4000-8000-000000000010'),
  'INVALIDATED', 'the M10 rev-1 consolidation is INVALIDATED');
select is(
  (select current_consolidation_id from public.matches where id = 'b0000000-0000-4000-8000-000000000010'),
  null, 'M10 has no current consolidation after the reopen');

-- Nova revisão VALID de M10 com o gol atribuído ao Ace.
insert into public.match_consolidations (id, match_id, lineup_id, revision, mbj_score, opponent_score, status, idempotency_key, consolidated_by)
values ('b2000000-0000-4000-8000-0000000000a2', 'b0000000-0000-4000-8000-000000000010',
        'b1000000-0000-4000-8000-000000000010', 2, 1, 0, 'VALID', gen_random_uuid(),
        'd1000000-0000-4000-8000-000000000001');
update public.matches set current_consolidation_id = 'b2000000-0000-4000-8000-0000000000a2'
where id = 'b0000000-0000-4000-8000-000000000010';
insert into public.match_goals (consolidation_id, scorer_athlete_id, assistant_athlete_id, sequence_number, created_by)
values ('b2000000-0000-4000-8000-0000000000a2', 'db000000-0000-4000-8000-000000000001', null, 1,
        'd1000000-0000-4000-8000-000000000001');

-- Avaliação #2: o troféu recém-qualificado é concedido ------------------------
select private.evaluate_trophies('d6000000-0000-4000-8000-000000000001',
  array['db000000-0000-4000-8000-000000000001']::uuid[]);
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'db000000-0000-4000-8000-000000000001' and trophy_code = 'ARTILHEIRO'),
  1, 'run #2: Ace now earns ARTILHEIRO (corrected revision → 10 goals)');
select is(
  (select trigger_context ->> 'metric' from public.athlete_trophies
   where athlete_id = 'db000000-0000-4000-8000-000000000001' and trophy_code = 'ARTILHEIRO'),
  '10', 'ARTILHEIRO metric counts only the VALID revision (10, not 11)');
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'db000000-0000-4000-8000-000000000001'),
  2, 'Ace holds exactly two trophies — VETERANO + the new ARTILHEIRO');
select cmp_ok(
  (select awarded_at from public.athlete_trophies
   where athlete_id = 'db000000-0000-4000-8000-000000000001' and trophy_code = 'VETERANO'),
  '<',
  (select awarded_at from public.athlete_trophies
   where athlete_id = 'db000000-0000-4000-8000-000000000001' and trophy_code = 'ARTILHEIRO'),
  'VETERANO keeps its original award time — it was not re-inserted');
select is(
  (select jsonb_typeof(trigger_context) from public.athlete_trophies
   where athlete_id = 'db000000-0000-4000-8000-000000000001' and trophy_code = 'VETERANO'),
  'object', 'the previously awarded VETERANO row is intact');

-- Avaliação #3: idempotente ---------------------------------------------------
select private.evaluate_trophies('d6000000-0000-4000-8000-000000000001',
  array['db000000-0000-4000-8000-000000000001']::uuid[]);
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'db000000-0000-4000-8000-000000000001'),
  2, 'run #3 adds nothing — still exactly two trophies');

-- Concorda com season_trophy_progress.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd1000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
select is(
  (select current_value from public.season_trophy_progress(
     'db000000-0000-4000-8000-000000000001', 'd6000000-0000-4000-8000-000000000001')
   where trophy_code = 'ARTILHEIRO'),
  10, 'season_trophy_progress counts the corrected revision only');
select is(
  (select achieved from public.season_trophy_progress(
     'db000000-0000-4000-8000-000000000001', 'd6000000-0000-4000-8000-000000000001')
   where trophy_code = 'ARTILHEIRO'),
  true, 'season_trophy_progress agrees the trophy is achieved');
reset role;

select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'db000000-0000-4000-8000-000000000002'),
  0, 'Bob (not in the evaluated set) receives nothing');

select * from finish();
rollback;
