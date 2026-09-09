begin;

select plan(15);

select has_function('public', 'log_live_event',
  array['uuid', 'uuid', 'integer', 'text', 'uuid', 'uuid', 'text', 'uuid'],
  'log_live_event exists');

-- Atores + partida ao vivo -----------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000d9001', 'idem-president@example.test'),
  ('00000000-0000-4000-8000-0000000d9002', 'idem-coach@example.test'),
  ('00000000-0000-4000-8000-0000000d9003', 'idem-recorder@example.test'),
  ('00000000-0000-4000-8000-0000000d9004', 'idem-a1@example.test'),
  ('00000000-0000-4000-8000-0000000d9005', 'idem-a2@example.test');
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000d900%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('00000000-0000-4000-8000-0000000d9001', 'PRESIDENT', '00000000-0000-4000-8000-0000000d9001'),
  ('00000000-0000-4000-8000-0000000d9002', 'COACH', '00000000-0000-4000-8000-0000000d9001'),
  ('00000000-0000-4000-8000-0000000d9003', 'ATHLETE', '00000000-0000-4000-8000-0000000d9001'),
  ('00000000-0000-4000-8000-0000000d9004', 'ATHLETE', '00000000-0000-4000-8000-0000000d9001'),
  ('00000000-0000-4000-8000-0000000d9005', 'ATHLETE', '00000000-0000-4000-8000-0000000d9001');
insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position) values
  ('00000000-0000-4000-8000-0000000d9101', '00000000-0000-4000-8000-0000000d9003', 'Idem GK', 'IGK', 84, 'Goleiro'),
  ('00000000-0000-4000-8000-0000000d9102', '00000000-0000-4000-8000-0000000d9004', 'Idem Nine', 'I9', 85, 'Ataque'),
  ('00000000-0000-4000-8000-0000000d9103', '00000000-0000-4000-8000-0000000d9005', 'Idem Ten', 'I10', 86, 'Meio');
update public.seasons set is_active = false;
insert into public.seasons (id, year, is_active, starts_on, status)
values ('00000000-0000-4000-8000-0000000d9201', 2043, true, '2043-01-01', 'ACTIVE');
insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, created_by, updated_by)
values ('00000000-0000-4000-8000-0000000d9301', '00000000-0000-4000-8000-0000000d9201', 'Idem FC',
        statement_timestamp() - interval '20 minutes', statement_timestamp() - interval '1 day',
        '00000000-0000-4000-8000-0000000d9001', '00000000-0000-4000-8000-0000000d9001');
insert into public.lineups (id, match_id, revision, formation_code, created_by)
values ('00000000-0000-4000-8000-0000000d9401', '00000000-0000-4000-8000-0000000d9301', 1, '4-3-3', '00000000-0000-4000-8000-0000000d9001');
insert into public.lineup_players (lineup_id, athlete_id, assignment, tactical_position, position_x, position_y, display_order) values
  ('00000000-0000-4000-8000-0000000d9401', '00000000-0000-4000-8000-0000000d9101', 'STARTER', 'GOL', 50, 5, 0),
  ('00000000-0000-4000-8000-0000000d9401', '00000000-0000-4000-8000-0000000d9102', 'STARTER', 'ATA', 50, 80, 1),
  ('00000000-0000-4000-8000-0000000d9401', '00000000-0000-4000-8000-0000000d9103', 'STARTER', 'MEI', 50, 50, 2);
update public.lineups set status = 'PUBLISHED', published_by = '00000000-0000-4000-8000-0000000d9001', published_at = statement_timestamp()
where id = '00000000-0000-4000-8000-0000000d9401';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000d9001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000d9001","role":"authenticated","aal":"aal2"}', true);
select public.enable_live_recording(
  '00000000-0000-4000-8000-0000000d9301', '00000000-0000-4000-8000-0000000d9003',
  '00000000-0000-4000-8000-0000000d9101', '00000000-0000-4000-8000-0000000d9f01');
reset role;

-- Registrador: primeira gravação do evento A.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000d9003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000d9003","role":"authenticated","aal":"aal1"}', true);
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000d9301', '00000000-0000-4000-8000-0000000df0a1',
     31, 'GOAL', '00000000-0000-4000-8000-0000000d9102', null, 'MBJ', '00000000-0000-4000-8000-0000000d9e01') ->> 'deduped'),
  'false', 'first send of client_event_id A inserts');

-- Reenvio idêntico do A → deduped.
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000d9301', '00000000-0000-4000-8000-0000000df0a1',
     31, 'GOAL', '00000000-0000-4000-8000-0000000d9102', null, 'MBJ', '00000000-0000-4000-8000-0000000d9e02') ->> 'deduped'),
  'true', 'identical re-send of A is deduped');

-- Reenvio do A com payload divergente → ainda deduped, primeira escrita prevalece.
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000d9301', '00000000-0000-4000-8000-0000000df0a1',
     77, 'RED_CARD', '00000000-0000-4000-8000-0000000d9103', null, 'MBJ', '00000000-0000-4000-8000-0000000d9e03') ->> 'deduped'),
  'true', 'a divergent re-send of A is still deduped (no error)');
reset role;

select is(
  (select count(*)::integer from public.live_match_events where client_event_id = '00000000-0000-4000-8000-0000000df0a1'),
  1, 'client_event_id A maps to exactly one row');
select is(
  (select minute from public.live_match_events where client_event_id = '00000000-0000-4000-8000-0000000df0a1'),
  31::smallint, 'first-write-wins: stored minute is the original');
select is(
  (select event_type::text from public.live_match_events where client_event_id = '00000000-0000-4000-8000-0000000df0a1'),
  'GOAL', 'first-write-wins: stored type is the original');

-- Evento B, depois undo de B, depois reenvio tardio de B (fora de ordem).
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000d9003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000d9003","role":"authenticated","aal":"aal1"}', true);
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000d9301', '00000000-0000-4000-8000-0000000df0b2',
     40, 'GOAL', '00000000-0000-4000-8000-0000000d9102', null, 'MBJ', '00000000-0000-4000-8000-0000000d9e04') ->> 'deduped'),
  'false', 'client_event_id B inserts');
select is(
  (select public.undo_live_event('00000000-0000-4000-8000-0000000d9301', '00000000-0000-4000-8000-0000000d9b01') ->> 'clientEventId'),
  '00000000-0000-4000-8000-0000000df0b2', 'undo targets B (the newest)');
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000d9301', '00000000-0000-4000-8000-0000000df0b2',
     40, 'GOAL', '00000000-0000-4000-8000-0000000d9102', null, 'MBJ', '00000000-0000-4000-8000-0000000d9e05') ->> 'deduped'),
  'true', 'a late re-send of the already-undone B is deduped, not resurrected');
reset role;

select is(
  (select count(*)::integer from public.live_match_events where client_event_id = '00000000-0000-4000-8000-0000000df0b2'),
  1, 'B is still a single row');
select is(
  (select undone from public.live_match_events where client_event_id = '00000000-0000-4000-8000-0000000df0b2'),
  true, 'B stays undone after the out-of-order re-send');
select is(
  (select count(*)::integer from public.live_match_events where match_id = '00000000-0000-4000-8000-0000000d9301' and not undone),
  1, 'only A remains in the non-undone set');

-- Um segundo ator (comissão) reenviando o mesmo client_event_id A também é deduped.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000d9002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000d9002","role":"authenticated","aal":"aal2"}', true);
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000d9301', '00000000-0000-4000-8000-0000000df0a1',
     31, 'GOAL', '00000000-0000-4000-8000-0000000d9102', null, 'MBJ', '00000000-0000-4000-8000-0000000d9e06') ->> 'deduped'),
  'true', 'dedupe is keyed on client_event_id regardless of the acting user');

select is(
  (select count(*)::integer from public.live_match_events where match_id = '00000000-0000-4000-8000-0000000d9301'),
  2, 'exactly two physical rows overall (A + undone B)');
reset role;

select * from finish();
rollback;
