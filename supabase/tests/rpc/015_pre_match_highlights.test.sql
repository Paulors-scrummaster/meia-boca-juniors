begin;

select plan(17);

select has_function('private', 'generate_pre_match_highlights', array['uuid'],
  'generate_pre_match_highlights(uuid) exists');

-- Atores + temporada ativa --------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000e1001', 'pm-pres@example.test'),
  ('00000000-0000-4000-8000-0000000e1002', 'pm-a1@example.test'),
  ('00000000-0000-4000-8000-0000000e1003', 'pm-a2@example.test'),
  ('00000000-0000-4000-8000-0000000e1004', 'pm-a3@example.test');
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000e100%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('00000000-0000-4000-8000-0000000e1001', 'PRESIDENT', '00000000-0000-4000-8000-0000000e1001'),
  ('00000000-0000-4000-8000-0000000e1002', 'ATHLETE', '00000000-0000-4000-8000-0000000e1001'),
  ('00000000-0000-4000-8000-0000000e1003', 'ATHLETE', '00000000-0000-4000-8000-0000000e1001'),
  ('00000000-0000-4000-8000-0000000e1004', 'ATHLETE', '00000000-0000-4000-8000-0000000e1001');
insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position) values
  ('00000000-0000-4000-8000-0000000ea001', '00000000-0000-4000-8000-0000000e1002', 'PM Ace', 'Ace', 51, 'Ataque'),
  ('00000000-0000-4000-8000-0000000ea002', '00000000-0000-4000-8000-0000000e1003', 'PM Two', 'Two', 52, 'Meio'),
  ('00000000-0000-4000-8000-0000000ea003', '00000000-0000-4000-8000-0000000e1004', 'PM Three', 'Three', 53, 'Defesa');

update public.seasons set is_active = false;
insert into public.seasons (id, year, is_active, starts_on, status)
values ('00000000-0000-4000-8000-0000000e5001', 2099, true, '2099-01-01', 'ACTIVE');

-- Duas partidas concluídas vs. "Historico FC": 3-1 (V) e 1-2 (D).
insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, status, created_by, updated_by) values
  ('00000000-0000-4000-8000-0000000ec001', '00000000-0000-4000-8000-0000000e5001', 'Historico FC', now() - interval '40 days', now() - interval '41 days', 'COMPLETED', '00000000-0000-4000-8000-0000000e1001', '00000000-0000-4000-8000-0000000e1001'),
  ('00000000-0000-4000-8000-0000000ec002', '00000000-0000-4000-8000-0000000e5001', 'Historico FC', now() - interval '20 days', now() - interval '21 days', 'COMPLETED', '00000000-0000-4000-8000-0000000e1001', '00000000-0000-4000-8000-0000000e1001');
insert into public.lineups (id, match_id, revision, formation_code, status, created_by, published_by, published_at) values
  ('00000000-0000-4000-8000-0000000e0b01', '00000000-0000-4000-8000-0000000ec001', 1, '4-3-3', 'PUBLISHED', '00000000-0000-4000-8000-0000000e1001', '00000000-0000-4000-8000-0000000e1001', now()),
  ('00000000-0000-4000-8000-0000000e0b02', '00000000-0000-4000-8000-0000000ec002', 1, '4-3-3', 'PUBLISHED', '00000000-0000-4000-8000-0000000e1001', '00000000-0000-4000-8000-0000000e1001', now());
insert into public.match_consolidations (id, match_id, lineup_id, revision, mbj_score, opponent_score, status, idempotency_key, consolidated_by) values
  ('00000000-0000-4000-8000-0000000ed001', '00000000-0000-4000-8000-0000000ec001', '00000000-0000-4000-8000-0000000e0b01', 1, 3, 1, 'VALID', gen_random_uuid(), '00000000-0000-4000-8000-0000000e1001'),
  ('00000000-0000-4000-8000-0000000ed002', '00000000-0000-4000-8000-0000000ec002', '00000000-0000-4000-8000-0000000e0b02', 1, 1, 2, 'VALID', gen_random_uuid(), '00000000-0000-4000-8000-0000000e1001');
update public.matches set current_consolidation_id = '00000000-0000-4000-8000-0000000ed001' where id = '00000000-0000-4000-8000-0000000ec001';
update public.matches set current_consolidation_id = '00000000-0000-4000-8000-0000000ed002' where id = '00000000-0000-4000-8000-0000000ec002';

-- Ace: 3 gols na temporada; Two: 1. (líder claro de artilharia)
insert into public.match_goals (consolidation_id, scorer_athlete_id, assistant_athlete_id, sequence_number, created_by) values
  ('00000000-0000-4000-8000-0000000ed001', '00000000-0000-4000-8000-0000000ea001', null, 1, '00000000-0000-4000-8000-0000000e1001'),
  ('00000000-0000-4000-8000-0000000ed001', '00000000-0000-4000-8000-0000000ea001', null, 2, '00000000-0000-4000-8000-0000000e1001'),
  ('00000000-0000-4000-8000-0000000ed001', '00000000-0000-4000-8000-0000000ea002', null, 3, '00000000-0000-4000-8000-0000000e1001'),
  ('00000000-0000-4000-8000-0000000ed002', '00000000-0000-4000-8000-0000000ea001', null, 1, '00000000-0000-4000-8000-0000000e1001');

-- Partidas agendadas: uma vs. adversário inédito, uma vs. "Historico FC".
insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, status, created_by, updated_by) values
  ('00000000-0000-4000-8000-0000000e5f01', '00000000-0000-4000-8000-0000000e5001', 'Novo FC', now() + interval '2 days', now() + interval '1 day', 'SCHEDULED', '00000000-0000-4000-8000-0000000e1001', '00000000-0000-4000-8000-0000000e1001'),
  ('00000000-0000-4000-8000-0000000e5f02', '00000000-0000-4000-8000-0000000e5001', 'Historico FC', now() + interval '5 days', now() + interval '4 days', 'SCHEDULED', '00000000-0000-4000-8000-0000000e1001', '00000000-0000-4000-8000-0000000e1001');

-- Cenário 1: adversário inédito -------------------------------------------------
select is(
  (select private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000e5f01') ->> 'enqueued'),
  'true', 'pre-match highlights enqueue for a scheduled match');
select is(
  (select private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000e5f01') #>> '{payload,route}'),
  '/app/partidas/00000000-0000-4000-8000-0000000e5f01', 'route points at the match detail');
select is(
  (select private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000e5f01') #>> '{payload,headToHead,hasHistory}'),
  'false', 'unseen opponent → hasHistory false');
select is(
  (select private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000e5f01') #>> '{payload,headToHead,note}'),
  'primeiro confronto', 'unseen opponent → "primeiro confronto"');
select is(
  (select (private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000e5f01') -> 'payload') ? 'mbjSeasonStats'),
  true, 'payload carries MBJ season stats');
select is(
  (select (private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000e5f01') -> 'payload') ? 'opponentSeasonStats'),
  false, 'payload carries NO opponent season stats');
select is(
  (select private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000e5f01') #>> '{payload,mbjSeasonStats,topScorers,0,shirtName}'),
  'Ace', 'MBJ top scorer of the active season leads the list');
select is(
  (select (private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000e5f01') #> '{payload,mbjSeasonStats,clubRecord}') ? 'matches_played'),
  true, 'MBJ retrospecto is included');

select is(
  (select count(*)::integer from public.notification_events
   where kind = 'PRE_MATCH_HIGHLIGHTS' and resource_id = '00000000-0000-4000-8000-0000000e5f01'),
  1, 'exactly one PRE_MATCH_HIGHLIGHTS row after repeated runs (idempotent per match)');
select is(
  (select private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000e5f01') ->> 'eventId'),
  (select id::text from public.notification_events
   where kind = 'PRE_MATCH_HIGHLIGHTS' and resource_id = '00000000-0000-4000-8000-0000000e5f01'),
  'a re-run returns the same event id');
select is(
  (select count(*)::integer from public.notification_deliveries d
   join public.notification_events e on e.id = d.event_id
   where e.kind = 'PRE_MATCH_HIGHLIGHTS'
     and d.user_id in ('00000000-0000-4000-8000-0000000e1002',
                       '00000000-0000-4000-8000-0000000e1003',
                       '00000000-0000-4000-8000-0000000e1004')),
  3, 'every fixture athlete gets a delivery');

-- Cenário 2: adversário com histórico -----------------------------------------
select is(
  (select private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000e5f02') #>> '{payload,headToHead,hasHistory}'),
  'true', 'known opponent → hasHistory true');
select is(
  (select private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000e5f02') #>> '{payload,headToHead,wins}'),
  '1', 'head-to-head wins match an independent count (3-1 win, 1-2 loss)');
select is(
  (select private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000e5f02') #>> '{payload,headToHead,losses}'),
  '1', 'head-to-head losses match an independent count');
select is(
  (select (private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000e5f02') #> '{payload,headToHead}') ? 'note'),
  false, 'known opponent → no "primeiro confronto" note');

-- Partida inexistente.
select throws_ok(
  $$select private.generate_pre_match_highlights('00000000-0000-4000-8000-0000000effff')$$,
  'P0002', 'NOT_FOUND', 'an unknown match is rejected');

select * from finish();
rollback;
