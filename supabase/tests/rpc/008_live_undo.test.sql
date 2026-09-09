begin;

select plan(16);

-- Contrato -----------------------------------------------------------------
select has_function('public', 'log_live_event',
  array['uuid', 'uuid', 'integer', 'text', 'uuid', 'uuid', 'text', 'uuid'],
  'log_live_event exists with the contract signature');
select has_function('public', 'undo_live_event', array['uuid', 'uuid'],
  'undo_live_event exists');

-- Atores + partida ao vivo -----------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000d8001', 'undo-president@example.test'),
  ('00000000-0000-4000-8000-0000000d8002', 'undo-recorder@example.test'),
  ('00000000-0000-4000-8000-0000000d8003', 'undo-a1@example.test'),
  ('00000000-0000-4000-8000-0000000d8004', 'undo-a2@example.test');
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000d800%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('00000000-0000-4000-8000-0000000d8001', 'PRESIDENT', '00000000-0000-4000-8000-0000000d8001'),
  ('00000000-0000-4000-8000-0000000d8002', 'ATHLETE', '00000000-0000-4000-8000-0000000d8001'),
  ('00000000-0000-4000-8000-0000000d8003', 'ATHLETE', '00000000-0000-4000-8000-0000000d8001'),
  ('00000000-0000-4000-8000-0000000d8004', 'ATHLETE', '00000000-0000-4000-8000-0000000d8001');
insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position) values
  ('00000000-0000-4000-8000-0000000d8101', '00000000-0000-4000-8000-0000000d8002', 'Undo GK', 'UGK', 81, 'Goleiro'),
  ('00000000-0000-4000-8000-0000000d8102', '00000000-0000-4000-8000-0000000d8003', 'Undo Nine', 'U9', 82, 'Ataque'),
  ('00000000-0000-4000-8000-0000000d8103', '00000000-0000-4000-8000-0000000d8004', 'Undo Ten', 'U10', 83, 'Meio');
update public.seasons set is_active = false;
insert into public.seasons (id, year, is_active, starts_on, status)
values ('00000000-0000-4000-8000-0000000d8201', 2042, true, '2042-01-01', 'ACTIVE');
insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, created_by, updated_by)
values ('00000000-0000-4000-8000-0000000d8301', '00000000-0000-4000-8000-0000000d8201', 'Undo FC',
        statement_timestamp() - interval '30 minutes', statement_timestamp() - interval '1 day',
        '00000000-0000-4000-8000-0000000d8001', '00000000-0000-4000-8000-0000000d8001');
insert into public.lineups (id, match_id, revision, formation_code, created_by)
values ('00000000-0000-4000-8000-0000000d8401', '00000000-0000-4000-8000-0000000d8301', 1, '4-3-3', '00000000-0000-4000-8000-0000000d8001');
insert into public.lineup_players (lineup_id, athlete_id, assignment, tactical_position, position_x, position_y, display_order) values
  ('00000000-0000-4000-8000-0000000d8401', '00000000-0000-4000-8000-0000000d8101', 'STARTER', 'GOL', 50, 5, 0),
  ('00000000-0000-4000-8000-0000000d8401', '00000000-0000-4000-8000-0000000d8102', 'STARTER', 'ATA', 50, 80, 1),
  ('00000000-0000-4000-8000-0000000d8401', '00000000-0000-4000-8000-0000000d8103', 'STARTER', 'MEI', 50, 50, 2);
update public.lineups set status = 'PUBLISHED', published_by = '00000000-0000-4000-8000-0000000d8001', published_at = statement_timestamp()
where id = '00000000-0000-4000-8000-0000000d8401';

-- Presidente habilita o ao vivo, com o atleta d8002 como Registrador de Campo.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000d8001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000d8001","role":"authenticated","aal":"aal2"}', true);
select public.enable_live_recording(
  '00000000-0000-4000-8000-0000000d8301', '00000000-0000-4000-8000-0000000d8002',
  '00000000-0000-4000-8000-0000000d8101', '00000000-0000-4000-8000-0000000d8f01');
reset role;

-- Registrador (AAL1, sem papel de comissão) computa três eventos.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000d8002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000d8002","role":"authenticated","aal":"aal1"}', true);
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000d8301', '00000000-0000-4000-8000-0000000dc001',
     12, 'GOAL', '00000000-0000-4000-8000-0000000d8102', null, 'MBJ', '00000000-0000-4000-8000-0000000d8e01') ->> 'deduped'),
  'false', 'recorder logs a goal');
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000d8301', '00000000-0000-4000-8000-0000000dc002',
     12, 'ASSIST', '00000000-0000-4000-8000-0000000d8103', null, 'MBJ', '00000000-0000-4000-8000-0000000d8e02') ->> 'eventType'),
  'ASSIST', 'recorder logs an assist');
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000d8301', '00000000-0000-4000-8000-0000000dc003',
     20, 'YELLOW_CARD', '00000000-0000-4000-8000-0000000d8102', null, 'MBJ', '00000000-0000-4000-8000-0000000d8e03') ->> 'eventType'),
  'YELLOW_CARD', 'recorder logs a yellow card');
reset role;

select is(
  (select count(*)::integer from public.live_match_events where match_id = '00000000-0000-4000-8000-0000000d8301' and not undone),
  3, 'three live events, none undone yet');

-- Undo #1 desfaz o mais recente (o cartão amarelo), sem deletar.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000d8002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000d8002","role":"authenticated","aal":"aal1"}', true);
select is(
  (select public.undo_live_event('00000000-0000-4000-8000-0000000d8301', '00000000-0000-4000-8000-0000000d8b01') ->> 'eventType'),
  'YELLOW_CARD', 'undo removes the newest non-undone event');
reset role;

select is(
  (select count(*)::integer from public.live_match_events where client_event_id = '00000000-0000-4000-8000-0000000dc003'),
  1, 'the undone event is still physically present (audit trail)');
select is(
  (select undone_at is not null from public.live_match_events where client_event_id = '00000000-0000-4000-8000-0000000dc003'),
  true, 'undone_at is stamped on the soft-undone row');
select is(
  (select count(*)::integer from public.live_match_events where match_id = '00000000-0000-4000-8000-0000000d8301' and not undone),
  2, 'one event dropped from the non-undone set');

-- Undo #2 desfaz agora a assistência (novo mais recente não desfeito).
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000d8002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000d8002","role":"authenticated","aal":"aal1"}', true);
select is(
  (select public.undo_live_event('00000000-0000-4000-8000-0000000d8301', '00000000-0000-4000-8000-0000000d8b02') ->> 'eventType'),
  'ASSIST', 'a second undo targets the next newest non-undone event');
reset role;

select is(
  (select count(*)::integer from public.live_match_events where match_id = '00000000-0000-4000-8000-0000000d8301' and not undone),
  1, 'only the goal remains in the non-undone set');

-- Envelhece o gol para fora da janela de 30 s.
update public.live_match_events
set recorded_at = statement_timestamp() - interval '45 seconds'
where client_event_id = '00000000-0000-4000-8000-0000000dc001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000d8002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000d8002","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.undo_live_event('00000000-0000-4000-8000-0000000d8301', '00000000-0000-4000-8000-0000000d8b03')$$,
  'P0001', 'UNDO_WINDOW_EXPIRED', 'nothing within 30 s is eligible for undo');
reset role;

select is(
  (select count(*)::integer from public.live_match_events where match_id = '00000000-0000-4000-8000-0000000d8301' and not undone),
  1, 'a failed undo leaves the non-undone set untouched');

-- Undo é idempotente por chave: repetir a chave do undo #2 não desfaz um terceiro evento.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000d8002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000d8002","role":"authenticated","aal":"aal1"}', true);
select is(
  (select public.undo_live_event('00000000-0000-4000-8000-0000000d8301', '00000000-0000-4000-8000-0000000d8b02') ->> 'eventType'),
  'ASSIST', 'replaying an undo key returns the cached result');
reset role;

select is(
  (select count(*)::integer from public.live_match_events where match_id = '00000000-0000-4000-8000-0000000d8301' and not undone),
  1, 'the idempotent replay did not undo another event');

select * from finish();
rollback;
