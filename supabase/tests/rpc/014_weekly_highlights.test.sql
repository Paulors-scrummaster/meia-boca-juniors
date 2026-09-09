begin;

select plan(14);

select has_function('private', 'generate_weekly_highlights', array['timestamptz'],
  'generate_weekly_highlights(timestamptz) exists');

-- Atores + temporada ativa --------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000f1001', 'wh-pres@example.test'),
  ('00000000-0000-4000-8000-0000000f1002', 'wh-a1@example.test'),
  ('00000000-0000-4000-8000-0000000f1003', 'wh-a2@example.test'),
  ('00000000-0000-4000-8000-0000000f1004', 'wh-a3@example.test'),
  ('00000000-0000-4000-8000-0000000f1005', 'wh-a4@example.test'),
  ('00000000-0000-4000-8000-0000000f1006', 'wh-a5@example.test');
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000f100%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('00000000-0000-4000-8000-0000000f1001', 'PRESIDENT', '00000000-0000-4000-8000-0000000f1001'),
  ('00000000-0000-4000-8000-0000000f1002', 'ATHLETE', '00000000-0000-4000-8000-0000000f1001'),
  ('00000000-0000-4000-8000-0000000f1003', 'ATHLETE', '00000000-0000-4000-8000-0000000f1001'),
  ('00000000-0000-4000-8000-0000000f1004', 'ATHLETE', '00000000-0000-4000-8000-0000000f1001'),
  ('00000000-0000-4000-8000-0000000f1005', 'ATHLETE', '00000000-0000-4000-8000-0000000f1001'),
  ('00000000-0000-4000-8000-0000000f1006', 'ATHLETE', '00000000-0000-4000-8000-0000000f1001');
insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position) values
  ('00000000-0000-4000-8000-0000000fa001', '00000000-0000-4000-8000-0000000f1002', 'WH Scorer', 'Scorer', 41, 'Ataque'),
  ('00000000-0000-4000-8000-0000000fa002', '00000000-0000-4000-8000-0000000f1003', 'WH AssistB', 'AssistB', 42, 'Meio'),
  ('00000000-0000-4000-8000-0000000fa003', '00000000-0000-4000-8000-0000000f1004', 'WH AssistC', 'AssistC', 43, 'Meio'),
  ('00000000-0000-4000-8000-0000000fa004', '00000000-0000-4000-8000-0000000f1005', 'WH Other', 'Other', 44, 'Defesa'),
  ('00000000-0000-4000-8000-0000000fa005', '00000000-0000-4000-8000-0000000f1006', 'WH Keeper', 'Keeper', 45, 'Goleiro');

update public.seasons set is_active = false;
insert into public.seasons (id, year, is_active, starts_on, status)
values ('00000000-0000-4000-8000-0000000f5001', 2099, true, '2099-01-01', 'ACTIVE');

insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, status, created_by, updated_by)
values ('00000000-0000-4000-8000-0000000f0a01', '00000000-0000-4000-8000-0000000f5001', 'WH Rival',
        '2099-06-12 20:00:00+00', '2099-06-11 20:00:00+00', 'COMPLETED',
        '00000000-0000-4000-8000-0000000f1001', '00000000-0000-4000-8000-0000000f1001');
insert into public.lineups (id, match_id, revision, formation_code, status, created_by, published_by, published_at)
values ('00000000-0000-4000-8000-0000000f0b01', '00000000-0000-4000-8000-0000000f0a01', 1, '4-3-3', 'PUBLISHED',
        '00000000-0000-4000-8000-0000000f1001', '00000000-0000-4000-8000-0000000f1001', now());
insert into public.match_consolidations (id, match_id, lineup_id, revision, mbj_score, opponent_score, status, idempotency_key, consolidated_by, consolidated_at)
values ('00000000-0000-4000-8000-0000000fc001', '00000000-0000-4000-8000-0000000f0a01', '00000000-0000-4000-8000-0000000f0b01',
        1, 4, 0, 'VALID', gen_random_uuid(), '00000000-0000-4000-8000-0000000f1001', '2099-06-12 22:00:00+00');
update public.matches set current_consolidation_id = '00000000-0000-4000-8000-0000000fc001' where id = '00000000-0000-4000-8000-0000000f0a01';

-- Scorer marca 3 (líder claro); AssistB e AssistC dão 2 assistências cada (empate).
insert into public.match_goals (consolidation_id, scorer_athlete_id, assistant_athlete_id, sequence_number, created_by) values
  ('00000000-0000-4000-8000-0000000fc001', '00000000-0000-4000-8000-0000000fa001', '00000000-0000-4000-8000-0000000fa002', 1, '00000000-0000-4000-8000-0000000f1001'),
  ('00000000-0000-4000-8000-0000000fc001', '00000000-0000-4000-8000-0000000fa001', '00000000-0000-4000-8000-0000000fa002', 2, '00000000-0000-4000-8000-0000000f1001'),
  ('00000000-0000-4000-8000-0000000fc001', '00000000-0000-4000-8000-0000000fa001', '00000000-0000-4000-8000-0000000fa003', 3, '00000000-0000-4000-8000-0000000f1001'),
  ('00000000-0000-4000-8000-0000000fc001', '00000000-0000-4000-8000-0000000fa004', '00000000-0000-4000-8000-0000000fa003', 4, '00000000-0000-4000-8000-0000000f1001');
insert into public.match_goalkeeper_assignments (consolidation_id, athlete_id, from_minute, to_minute)
values ('00000000-0000-4000-8000-0000000fc001', '00000000-0000-4000-8000-0000000fa005', 0, null);

-- Janela [2099-06-08 12:00, 2099-06-15 12:00) contém a consolidação (22:00 de 06-12).
select is(
  (select private.generate_weekly_highlights('2099-06-15 12:00:00+00'::timestamptz) ->> 'enqueued'),
  'true', 'a run with matches in the window enqueues');
select is(
  (select private.generate_weekly_highlights('2099-06-15 12:00:00+00'::timestamptz) #>> '{highlights,topScorer,athleteId}'),
  '00000000-0000-4000-8000-0000000fa001', 'top scorer is the clear leader (3 goals)');
select is(
  (select private.generate_weekly_highlights('2099-06-15 12:00:00+00'::timestamptz) #>> '{highlights,topScorer,goals}'),
  '3', 'top scorer goal count');
select is(
  (select (private.generate_weekly_highlights('2099-06-15 12:00:00+00'::timestamptz) -> 'highlights') ? 'topAssister'),
  false, 'a tied top-assister category is omitted');
select is(
  (select private.generate_weekly_highlights('2099-06-15 12:00:00+00'::timestamptz) #>> '{highlights,topKeeper,athleteId}'),
  '00000000-0000-4000-8000-0000000fa005', 'goalkeeper of the week is the clean-sheet keeper');

select is(
  (select private.generate_weekly_highlights('2099-06-15 12:00:00+00'::timestamptz) -> 'highlights'),
  (select private.generate_weekly_highlights('2099-06-15 12:00:00+00'::timestamptz) -> 'highlights'),
  'deterministic over identical data');

select is(
  (select count(*)::integer from public.notification_events where kind = 'WEEKLY_HIGHLIGHTS'
     and resource_id = '00000000-0000-4000-8000-0000000f5001'),
  1, 'exactly one WEEKLY_HIGHLIGHTS event after repeated runs');
select matches(
  (select deduplication_key from public.notification_events where kind = 'WEEKLY_HIGHLIGHTS' limit 1),
  '^weekly-highlights:2099-W[0-9]{2}$', 'dedup key is scoped to the ISO week');
select is(
  (select count(*)::integer from public.notification_deliveries d
   join public.notification_events e on e.id = d.event_id
   where e.kind = 'WEEKLY_HIGHLIGHTS'
     and d.user_id in (
       '00000000-0000-4000-8000-0000000f1002', '00000000-0000-4000-8000-0000000f1003',
       '00000000-0000-4000-8000-0000000f1004', '00000000-0000-4000-8000-0000000f1005',
       '00000000-0000-4000-8000-0000000f1006')),
  5, 'every fixture athlete gets exactly one delivery');
select is(
  (select payload ->> 'route' from public.notification_events where kind = 'WEEKLY_HIGHLIGHTS' limit 1),
  '/app/historico', 'weekly highlights route is /app/historico');

-- Sem partidas na janela → não enfileira.
select is(
  (select private.generate_weekly_highlights('2099-01-05 12:00:00+00'::timestamptz) ->> 'enqueued'),
  'false', 'an empty window does not enqueue');
select is(
  (select private.generate_weekly_highlights('2099-01-05 12:00:00+00'::timestamptz) ->> 'reason'),
  'NO_MATCHES', 'empty-window reason is NO_MATCHES');

-- Sem temporada ativa → não enfileira.
update public.seasons set status = 'CLOSED', ends_on = '2099-12-31', is_active = false
where id = '00000000-0000-4000-8000-0000000f5001';
select is(
  (select private.generate_weekly_highlights('2099-06-15 12:00:00+00'::timestamptz) ->> 'reason'),
  'NO_ACTIVE_SEASON', 'no active season → not enqueued');

select * from finish();
rollback;
