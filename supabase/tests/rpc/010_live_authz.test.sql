begin;

select plan(21);

-- Contrato -----------------------------------------------------------------
select has_function('public', 'enable_live_recording', array['uuid', 'uuid', 'uuid', 'uuid'],
  'enable_live_recording exists');
select has_function('public', 'assign_field_recorder', array['uuid', 'uuid', 'uuid'],
  'assign_field_recorder exists');

-- Atores + partida -----------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000da001', 'authz-president@example.test'),
  ('00000000-0000-4000-8000-0000000da002', 'authz-coach@example.test'),
  ('00000000-0000-4000-8000-0000000da003', 'authz-recorderA@example.test'),
  ('00000000-0000-4000-8000-0000000da004', 'authz-recorderB@example.test'),
  ('00000000-0000-4000-8000-0000000da005', 'authz-outsider@example.test'),
  ('00000000-0000-4000-8000-0000000da006', 'authz-a2@example.test');
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-0000000da00%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('00000000-0000-4000-8000-0000000da001', 'PRESIDENT', '00000000-0000-4000-8000-0000000da001'),
  ('00000000-0000-4000-8000-0000000da002', 'COACH', '00000000-0000-4000-8000-0000000da001'),
  ('00000000-0000-4000-8000-0000000da003', 'ATHLETE', '00000000-0000-4000-8000-0000000da001'),
  ('00000000-0000-4000-8000-0000000da004', 'ATHLETE', '00000000-0000-4000-8000-0000000da001'),
  ('00000000-0000-4000-8000-0000000da005', 'ATHLETE', '00000000-0000-4000-8000-0000000da001'),
  ('00000000-0000-4000-8000-0000000da006', 'ATHLETE', '00000000-0000-4000-8000-0000000da001');
insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position) values
  ('00000000-0000-4000-8000-0000000da101', '00000000-0000-4000-8000-0000000da003', 'Authz GK', 'AGK', 87, 'Goleiro'),
  ('00000000-0000-4000-8000-0000000da102', '00000000-0000-4000-8000-0000000da004', 'Authz Nine', 'A9', 88, 'Ataque'),
  ('00000000-0000-4000-8000-0000000da103', '00000000-0000-4000-8000-0000000da006', 'Authz Ten', 'A10', 89, 'Meio');
update public.seasons set is_active = false;
insert into public.seasons (id, year, is_active, starts_on, status)
values ('00000000-0000-4000-8000-0000000da201', 2044, true, '2044-01-01', 'ACTIVE');
insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, created_by, updated_by)
values ('00000000-0000-4000-8000-0000000da301', '00000000-0000-4000-8000-0000000da201', 'Authz FC',
        statement_timestamp() - interval '15 minutes', statement_timestamp() - interval '1 day',
        '00000000-0000-4000-8000-0000000da001', '00000000-0000-4000-8000-0000000da001');
insert into public.lineups (id, match_id, revision, formation_code, created_by)
values ('00000000-0000-4000-8000-0000000da401', '00000000-0000-4000-8000-0000000da301', 1, '4-3-3', '00000000-0000-4000-8000-0000000da001');
insert into public.lineup_players (lineup_id, athlete_id, assignment, tactical_position, position_x, position_y, display_order) values
  ('00000000-0000-4000-8000-0000000da401', '00000000-0000-4000-8000-0000000da101', 'STARTER', 'GOL', 50, 5, 0),
  ('00000000-0000-4000-8000-0000000da401', '00000000-0000-4000-8000-0000000da102', 'STARTER', 'ATA', 50, 80, 1),
  ('00000000-0000-4000-8000-0000000da401', '00000000-0000-4000-8000-0000000da103', 'STARTER', 'MEI', 50, 50, 2);
update public.lineups set status = 'PUBLISHED', published_by = '00000000-0000-4000-8000-0000000da001', published_at = statement_timestamp()
where id = '00000000-0000-4000-8000-0000000da401';

-- Setup RBAC ---------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000da005', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000da005","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.enable_live_recording('00000000-0000-4000-8000-0000000da301',
     '00000000-0000-4000-8000-0000000da003', '00000000-0000-4000-8000-0000000da101', gen_random_uuid())$$,
  '42501', 'FORBIDDEN', 'a plain athlete cannot enable live recording');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000da002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000da002","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.enable_live_recording('00000000-0000-4000-8000-0000000da301',
     '00000000-0000-4000-8000-0000000da003', '00000000-0000-4000-8000-0000000da101', gen_random_uuid())$$,
  '42501', 'MFA_REQUIRED', 'enabling live recording needs AAL2');
reset role;

-- Coach + AAL2 habilita, com Recorder A.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000da002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000da002","role":"authenticated","aal":"aal2"}', true);
select is(
  (select public.enable_live_recording('00000000-0000-4000-8000-0000000da301',
     '00000000-0000-4000-8000-0000000da003', '00000000-0000-4000-8000-0000000da101',
     '00000000-0000-4000-8000-0000000daf01') ->> 'status'),
  'RECORDING', 'coach + AAL2 enables live recording');
select throws_ok(
  $$select public.enable_live_recording('00000000-0000-4000-8000-0000000da301',
     '00000000-0000-4000-8000-0000000da003', '00000000-0000-4000-8000-0000000da101', gen_random_uuid())$$,
  'P0001', 'CONFLICT', 'live recording cannot be enabled twice');
reset role;

-- Log/undo: Recorder A e comissão podem; quem não é, não.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000da003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000da003","role":"authenticated","aal":"aal1"}', true);
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000da301', '00000000-0000-4000-8000-0000000dca01',
     10, 'GOAL', '00000000-0000-4000-8000-0000000da102', null, 'MBJ', '00000000-0000-4000-8000-0000000dae01') ->> 'deduped'),
  'false', 'the designated recorder may log while RECORDING');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000da005', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000da005","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.log_live_event('00000000-0000-4000-8000-0000000da301', gen_random_uuid(),
     11, 'GOAL', '00000000-0000-4000-8000-0000000da102', null, 'MBJ', gen_random_uuid())$$,
  'P0001', 'RECORDER_ONLY', 'a non-recorder non-staff account cannot log');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000da002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000da002","role":"authenticated","aal":"aal2"}', true);
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000da301', '00000000-0000-4000-8000-0000000dca02',
     12, 'ASSIST', '00000000-0000-4000-8000-0000000da103', null, 'MBJ', '00000000-0000-4000-8000-0000000dae02') ->> 'deduped'),
  'false', 'a COACH may log without being the designated recorder');
select is(
  (select public.undo_live_event('00000000-0000-4000-8000-0000000da301', '00000000-0000-4000-8000-0000000dab01') ->> 'eventType'),
  'ASSIST', 'a COACH may undo as well');
reset role;

-- Reatribuição: A perde a autorização na hora (SC-013).
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000da001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000da001","role":"authenticated","aal":"aal2"}', true);
select is(
  (select public.assign_field_recorder('00000000-0000-4000-8000-0000000da301',
     '00000000-0000-4000-8000-0000000da004', '00000000-0000-4000-8000-0000000daf02') ->> 'previousRecorderUserId'),
  '00000000-0000-4000-8000-0000000da003', 'assign_field_recorder reports the displaced recorder');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000da003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000da003","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.log_live_event('00000000-0000-4000-8000-0000000da301', gen_random_uuid(),
     13, 'GOAL', '00000000-0000-4000-8000-0000000da102', null, 'MBJ', gen_random_uuid())$$,
  'P0001', 'RECORDER_ONLY', 'the displaced recorder A can no longer log');
select throws_ok(
  $$select public.undo_live_event('00000000-0000-4000-8000-0000000da301', gen_random_uuid())$$,
  'P0001', 'RECORDER_ONLY', 'the displaced recorder A can no longer undo');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000da004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000da004","role":"authenticated","aal":"aal1"}', true);
select is(
  (select public.log_live_event('00000000-0000-4000-8000-0000000da301', '00000000-0000-4000-8000-0000000dca03',
     14, 'GOAL', '00000000-0000-4000-8000-0000000da102', null, 'MBJ', '00000000-0000-4000-8000-0000000dae03') ->> 'deduped'),
  'false', 'the newly designated recorder B may log');
reset role;

-- end_live_recording encerra a fase de gravação; a autorização de log some.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000da004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000da004","role":"authenticated","aal":"aal1"}', true);
select is(
  (select public.end_live_recording('00000000-0000-4000-8000-0000000da301',
     '00000000-0000-4000-8000-0000000daf03') ->> 'status'),
  'IN_REVIEW', 'recorder B ends the recording phase');
select throws_ok(
  $$select public.log_live_event('00000000-0000-4000-8000-0000000da301', gen_random_uuid(),
     15, 'GOAL', '00000000-0000-4000-8000-0000000da102', null, 'MBJ', gen_random_uuid())$$,
  'P0001', 'RECORDER_ONLY', 'no more logging once the sumula left RECORDING (SC-013)');
-- ...mas amend é permitido na revisão.
select is(
  (select public.amend_live_event(
     (select id from public.live_match_events where client_event_id = '00000000-0000-4000-8000-0000000dca03'),
     '{"minute": 16}'::jsonb, '00000000-0000-4000-8000-0000000daf04') ->> 'minute'),
  '16', 'recorder B may amend an event during IN_REVIEW');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000da005', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000da005","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.amend_live_event(
     (select id from public.live_match_events where client_event_id = '00000000-0000-4000-8000-0000000dca03'),
     '{"minute": 20}'::jsonb, gen_random_uuid())$$,
  'P0001', 'RECORDER_ONLY', 'an outsider cannot amend during review');
reset role;

-- cancel_live_recording: comissão + AAL2.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000da002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000da002","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select public.cancel_live_recording('00000000-0000-4000-8000-0000000da301', 'x', gen_random_uuid())$$,
  '42501', 'MFA_REQUIRED', 'cancelling live recording needs AAL2');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000da001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000da001","role":"authenticated","aal":"aal2"}', true);
select is(
  (select public.cancel_live_recording('00000000-0000-4000-8000-0000000da301', 'partida suspensa',
     '00000000-0000-4000-8000-0000000daf05') ->> 'status'),
  'CANCELLED', 'president + AAL2 cancels the live recording');
reset role;

select is(
  (select status::text from public.live_match_setups where match_id = '00000000-0000-4000-8000-0000000da301'),
  'CANCELLED', 'the setup row lands in CANCELLED');

select * from finish();
rollback;
