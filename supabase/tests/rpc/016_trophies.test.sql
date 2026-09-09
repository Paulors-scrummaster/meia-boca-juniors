begin;

select plan(26);

select has_function('private', 'evaluate_trophies', array['uuid', 'uuid[]'],
  'evaluate_trophies(uuid, uuid[]) exists');

-- Atores -----------------------------------------------------------------------
insert into auth.users (id, email) values
  ('d0000000-0000-4000-8000-000000000001', 'tr-pres@example.test'),
  ('d0000000-0000-4000-8000-000000000002', 'tr-a@example.test'),
  ('d0000000-0000-4000-8000-000000000003', 'tr-b@example.test'),
  ('d0000000-0000-4000-8000-000000000004', 'tr-c@example.test'),
  ('d0000000-0000-4000-8000-000000000005', 'tr-d@example.test'),
  ('d0000000-0000-4000-8000-000000000006', 'tr-e@example.test'),
  ('d0000000-0000-4000-8000-000000000007', 'tr-f@example.test');
insert into public.profiles (id) select id from auth.users where id::text like 'd0000000-%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('d0000000-0000-4000-8000-000000000001', 'PRESIDENT', 'd0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000002', 'ATHLETE', 'd0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000003', 'ATHLETE', 'd0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000004', 'ATHLETE', 'd0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000005', 'ATHLETE', 'd0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000006', 'ATHLETE', 'd0000000-0000-4000-8000-000000000001'),
  ('d0000000-0000-4000-8000-000000000007', 'ATHLETE', 'd0000000-0000-4000-8000-000000000001');
insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position) values
  ('da000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'TR Ace', 'Ace', 71, 'Ataque'),
  ('da000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003', 'TR Bee', 'Bee', 72, 'Meio'),
  ('da000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004', 'TR Cee', 'Cee', 73, 'Goleiro'),
  ('da000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000005', 'TR Dee', 'Dee', 74, 'Defesa'),
  ('da000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000006', 'TR Eff', 'Eff', 75, 'Meio'),
  ('da000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000007', 'TR Gee', 'Gee', 76, 'Ataque');

update public.seasons set is_active = false;
insert into public.seasons (id, year, is_active, starts_on, status)
values ('d5000000-0000-4000-8000-000000000001', 2100, false, '2100-01-01', 'CLOSED');
update public.seasons set ends_on = '2100-12-31' where id = 'd5000000-0000-4000-8000-000000000001';

-- 10 partidas COMPLETED, cada uma com lineup PUBLISHED e consolidação VALID -------
insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, status, created_by, updated_by)
select ('a0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       'd5000000-0000-4000-8000-000000000001', 'TR Rival ' || i,
       now() - (60 - i) * interval '1 day', now() - (61 - i) * interval '1 day', 'COMPLETED',
       'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001'
from generate_series(1, 10) i;

insert into public.lineups (id, match_id, revision, formation_code, created_by)
select ('a1000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       ('a0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       1, '4-3-3', 'd0000000-0000-4000-8000-000000000001'
from generate_series(1, 10) i;

-- 6 titulares (A..F) com posições distintas por lineup (enquanto DRAFT).
insert into public.lineup_players (lineup_id, athlete_id, assignment, tactical_position, position_x, position_y, display_order)
select ('a1000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       p.aid, 'STARTER', p.pos, 50, p.y, p.ord
from generate_series(1, 10) i
cross join (values
  ('da000000-0000-4000-8000-000000000001'::uuid, 'ATA', 85, 0),
  ('da000000-0000-4000-8000-000000000002'::uuid, 'MEI', 55, 1),
  ('da000000-0000-4000-8000-000000000003'::uuid, 'GOL', 5, 2),
  ('da000000-0000-4000-8000-000000000004'::uuid, 'VOL', 45, 3),
  ('da000000-0000-4000-8000-000000000005'::uuid, 'PON', 75, 4),
  ('da000000-0000-4000-8000-000000000006'::uuid, 'SEG', 25, 5)
) p(aid, pos, y, ord);
update public.lineups set status = 'PUBLISHED',
       published_by = 'd0000000-0000-4000-8000-000000000001', published_at = now()
where id::text like 'a1000000-%';

insert into public.match_consolidations (id, match_id, lineup_id, revision, mbj_score, opponent_score, status, idempotency_key, consolidated_by)
select ('a2000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       ('a0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       ('a1000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       1,
       case when i = 1 then 5 when i between 2 and 9 then 2 else 1 end,
       case when i <= 6 then 0 else 2 end,
       'VALID', gen_random_uuid(), 'd0000000-0000-4000-8000-000000000001'
from generate_series(1, 10) i;
update public.matches m set current_consolidation_id = c.id
from public.match_consolidations c where c.match_id = m.id and m.id::text like 'a0000000-%';

-- Ace: 1 gol (assist Bee) em cada partida → 10 gols, 10 assistências para Bee.
insert into public.match_goals (consolidation_id, scorer_athlete_id, assistant_athlete_id, sequence_number, created_by)
select ('a2000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       'da000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000002', 1,
       'd0000000-0000-4000-8000-000000000001'
from generate_series(1, 10) i;
-- Gee: 1 gol em M1..M9 → 9 gols (quase-Artilheiro).
insert into public.match_goals (consolidation_id, scorer_athlete_id, assistant_athlete_id, sequence_number, created_by)
select ('a2000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       'da000000-0000-4000-8000-000000000006', null, 2, 'd0000000-0000-4000-8000-000000000001'
from generate_series(1, 9) i;
-- Eff: 3 gols em M1 → hat-trick (e só 3 no total).
insert into public.match_goals (consolidation_id, scorer_athlete_id, assistant_athlete_id, sequence_number, created_by) values
  ('a2000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000005', null, 3, 'd0000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000005', null, 4, 'd0000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000001', 'da000000-0000-4000-8000-000000000005', null, 5, 'd0000000-0000-4000-8000-000000000001');

-- Cee cobre a partida inteira em M1..M5 e M7..M10; M6 tem troca de goleiro.
insert into public.match_goalkeeper_assignments (consolidation_id, athlete_id, from_minute, to_minute)
select ('a2000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       'da000000-0000-4000-8000-000000000003', 0, null
from generate_series(1, 10) i where i <> 6;
insert into public.match_goalkeeper_assignments (consolidation_id, athlete_id, from_minute, to_minute) values
  ('a2000000-0000-4000-8000-000000000006', 'da000000-0000-4000-8000-000000000003', 0, 60),
  ('a2000000-0000-4000-8000-000000000006', 'da000000-0000-4000-8000-000000000004', 60, null);

-- Avaliação --------------------------------------------------------------------
select lives_ok(
  $$select private.evaluate_trophies('d5000000-0000-4000-8000-000000000001',
      array['da000000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000002',
            'da000000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000004',
            'da000000-0000-4000-8000-000000000005','da000000-0000-4000-8000-000000000006']::uuid[])$$,
  'evaluate_trophies runs for the six athletes');

select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000001' and trophy_code = 'ARTILHEIRO'
     and season_id = 'd5000000-0000-4000-8000-000000000001'),
  1, 'Ace (10 goals) earns ARTILHEIRO');
select is(
  (select trigger_context ->> 'metric' from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000001' and trophy_code = 'ARTILHEIRO'),
  '10', 'ARTILHEIRO trigger context records the metric');
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000006' and trophy_code = 'ARTILHEIRO'),
  0, 'Gee (9 goals) does not earn ARTILHEIRO');
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000002' and trophy_code = 'GARCOM'),
  1, 'Bee (10 assists) earns GARCOM');
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000005' and trophy_code = 'HAT_TRICK'),
  1, 'Eff (3 goals in one match) earns HAT_TRICK');
select is(
  (select trigger_context ->> 'goalsInMatch' from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000005' and trophy_code = 'HAT_TRICK'),
  '3', 'HAT_TRICK context records goals in the match');
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000005' and trophy_code = 'ARTILHEIRO'),
  0, 'Eff (3 goals total) does not earn ARTILHEIRO');
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000006' and trophy_code = 'HAT_TRICK'),
  0, 'HAT_TRICK is per single match — 9 goals across matches is not one');
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000003' and trophy_code = 'MURALHA'),
  1, 'Cee (5 clean sheets) earns MURALHA');
select is(
  (select trigger_context ->> 'metric' from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000003' and trophy_code = 'MURALHA'),
  '5', 'MURALHA metric is exactly 5 — the M6 keeper substitution voided that clean sheet');
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000004' and trophy_code = 'VETERANO'),
  1, 'Dee (10 finalized matches played) earns VETERANO');
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000001' and trophy_code = 'VETERANO'),
  1, 'Ace also earns VETERANO (played all 10)');
select is(
  (select count(*)::integer from public.athlete_trophies where season_id = 'd5000000-0000-4000-8000-000000000001'),
  10, 'exactly 10 trophy rows across the six athletes');

-- Idempotência: rodar de novo não duplica nada.
select private.evaluate_trophies('d5000000-0000-4000-8000-000000000001',
  array['da000000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000002',
        'da000000-0000-4000-8000-000000000003','da000000-0000-4000-8000-000000000004',
        'da000000-0000-4000-8000-000000000005','da000000-0000-4000-8000-000000000006']::uuid[]);
select is(
  (select count(*)::integer from public.athlete_trophies where season_id = 'd5000000-0000-4000-8000-000000000001'),
  10, 'a second run creates no duplicates (on conflict do nothing)');

-- Concorda com season_trophy_progress.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
select is(
  (select achieved from public.season_trophy_progress(
     'da000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001')
   where trophy_code = 'ARTILHEIRO'),
  true, 'season_trophy_progress agrees: Ace achieved ARTILHEIRO');
select is(
  (select current_value from public.season_trophy_progress(
     'da000000-0000-4000-8000-000000000006', 'd5000000-0000-4000-8000-000000000001')
   where trophy_code = 'ARTILHEIRO'),
  9, 'season_trophy_progress agrees: Gee is at 9');
select is(
  (select achieved from public.season_trophy_progress(
     'da000000-0000-4000-8000-000000000006', 'd5000000-0000-4000-8000-000000000001')
   where trophy_code = 'ARTILHEIRO'),
  false, 'season_trophy_progress agrees: Gee has not achieved ARTILHEIRO');
reset role;

-- Nunca revoga: avaliar outra temporada não toca nos troféus de S1.
select private.evaluate_trophies('d5000000-0000-4000-8000-0000000000ff',
  array['da000000-0000-4000-8000-000000000001']::uuid[]);
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000001' and season_id = 'd5000000-0000-4000-8000-000000000001'),
  2, 'evaluating a different season leaves the S1 trophies intact');

-- Imutabilidade: os troféus não podem ser apagados nem alterados.
select throws_ok(
  $$delete from public.athlete_trophies where trophy_code = 'ARTILHEIRO'$$,
  '55000', 'statistics history is immutable', 'awarded trophies cannot be deleted');

-- Reset de temporada via open_season: contadores recomeçam; o mesmo troféu pode
-- ser reconquistado na nova temporada.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
select public.open_season(2101, '2101-01-01', gen_random_uuid());
reset role;

insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, status, created_by, updated_by)
select ('a3000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       (select id from public.seasons where year = 2101), 'S2 Rival ' || i,
       now() - i * interval '1 day', now() - (i + 1) * interval '1 day', 'COMPLETED',
       'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001'
from generate_series(1, 5) i;
insert into public.lineups (id, match_id, revision, formation_code, created_by)
select ('a4000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       ('a3000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       1, '4-3-3', 'd0000000-0000-4000-8000-000000000001'
from generate_series(1, 5) i;
insert into public.lineup_players (lineup_id, athlete_id, assignment, tactical_position, position_x, position_y, display_order)
select ('a4000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       'da000000-0000-4000-8000-000000000001', 'STARTER', 'ATA', 50, 85, 0
from generate_series(1, 5) i;
update public.lineups set status = 'PUBLISHED',
       published_by = 'd0000000-0000-4000-8000-000000000001', published_at = now()
where id::text like 'a4000000-%';
insert into public.match_consolidations (id, match_id, lineup_id, revision, mbj_score, opponent_score, status, idempotency_key, consolidated_by)
select ('a5000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       ('a3000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       ('a4000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       1, 2, 1, 'VALID', gen_random_uuid(), 'd0000000-0000-4000-8000-000000000001'
from generate_series(1, 5) i;
update public.matches m set current_consolidation_id = c.id
from public.match_consolidations c where c.match_id = m.id and m.id::text like 'a3000000-%';
insert into public.match_goals (consolidation_id, scorer_athlete_id, assistant_athlete_id, sequence_number, created_by)
select ('a5000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
       'da000000-0000-4000-8000-000000000001', null, s.n, 'd0000000-0000-4000-8000-000000000001'
from generate_series(1, 5) i cross join generate_series(1, 2) s(n);

select private.evaluate_trophies(
  (select id from public.seasons where year = 2101),
  array['da000000-0000-4000-8000-000000000001']::uuid[]);
select is(
  (select count(*)::integer from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000001' and trophy_code = 'ARTILHEIRO'),
  2, 'Ace earns ARTILHEIRO again in the new season (season counters reset)');
select is(
  (select count(distinct season_id)::integer from public.athlete_trophies
   where athlete_id = 'da000000-0000-4000-8000-000000000001' and trophy_code = 'ARTILHEIRO'),
  2, 'the two ARTILHEIRO rows belong to different seasons');

-- Guardas de entrada.
select lives_ok(
  $$select private.evaluate_trophies('d5000000-0000-4000-8000-000000000001', null)$$,
  'null athlete list is a no-op');
select lives_ok(
  $$select private.evaluate_trophies('d5000000-0000-4000-8000-000000000001', '{}'::uuid[])$$,
  'empty athlete list is a no-op');
select is(
  (select count(*)::integer from public.athlete_trophies),
  11, 'no-op calls did not add rows (10 in S1 + 1 in S2)');

select * from finish();
rollback;
