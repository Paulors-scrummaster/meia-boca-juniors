begin;

select plan(21);

-- Estrutura da extração ------------------------------------------------------
select has_function('private', 'write_consolidation', 'internal write_consolidation was extracted');
select has_function(
  'public', 'consolidate_match', array['uuid', 'integer', 'integer', 'jsonb', 'uuid'],
  'consolidate_match keeps its public signature'
);
select function_returns(
  'public', 'consolidate_match', array['uuid', 'integer', 'integer', 'jsonb', 'uuid'], 'jsonb',
  'consolidate_match still returns jsonb'
);
select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'private' and p.proname = 'write_consolidation'),
  true, 'write_consolidation is SECURITY DEFINER'
);
select is(
  (select has_function_privilege('authenticated', 'private.write_consolidation(public.matches, public.lineups, integer, integer, jsonb, uuid, uuid)', 'execute')),
  false, 'authenticated cannot call write_consolidation directly (bypasses the role/AAL2 gate)'
);

-- Cenário de consolidação ---------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000018001', 'wc-president@example.test'),
  ('00000000-0000-4000-8000-000000018002', 'wc-a1@example.test'),
  ('00000000-0000-4000-8000-000000018003', 'wc-a2@example.test'),
  ('00000000-0000-4000-8000-000000018004', 'wc-a3@example.test');
insert into public.profiles (id) select id from auth.users where id::text like '00000000-0000-4000-8000-00000001800%';
insert into public.user_roles (user_id, role, assigned_by) values
  ('00000000-0000-4000-8000-000000018001', 'PRESIDENT', '00000000-0000-4000-8000-000000018001'),
  ('00000000-0000-4000-8000-000000018002', 'ATHLETE', '00000000-0000-4000-8000-000000018001'),
  ('00000000-0000-4000-8000-000000018003', 'ATHLETE', '00000000-0000-4000-8000-000000018001'),
  ('00000000-0000-4000-8000-000000018004', 'ATHLETE', '00000000-0000-4000-8000-000000018001');
insert into public.athletes (id, user_id, full_name, shirt_name, shirt_number, primary_position) values
  ('00000000-0000-4000-8000-000000018101', '00000000-0000-4000-8000-000000018002', 'WC Um', 'Um', 71, 'Ataque'),
  ('00000000-0000-4000-8000-000000018102', '00000000-0000-4000-8000-000000018003', 'WC Dois', 'Dois', 72, 'Meio'),
  ('00000000-0000-4000-8000-000000018103', '00000000-0000-4000-8000-000000018004', 'WC Tres', 'Tres', 73, 'Defesa');
update public.seasons set is_active = false;
insert into public.seasons (id, year, is_active, starts_on, status)
values ('00000000-0000-4000-8000-000000018201', 2041, true, '2041-01-01', 'ACTIVE');
insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, created_by, updated_by)
values ('00000000-0000-4000-8000-000000018301', '00000000-0000-4000-8000-000000018201', 'Refactor FC',
        statement_timestamp() - interval '2 hours', statement_timestamp() - interval '1 day',
        '00000000-0000-4000-8000-000000018001', '00000000-0000-4000-8000-000000018001');
insert into public.lineups (id, match_id, revision, formation_code, created_by)
values ('00000000-0000-4000-8000-000000018401', '00000000-0000-4000-8000-000000018301', 1, '4-3-3', '00000000-0000-4000-8000-000000018001');
insert into public.lineup_players (lineup_id, athlete_id, assignment, tactical_position, position_x, position_y, display_order) values
  ('00000000-0000-4000-8000-000000018401', '00000000-0000-4000-8000-000000018101', 'STARTER', 'ATA', 50, 20, 0),
  ('00000000-0000-4000-8000-000000018401', '00000000-0000-4000-8000-000000018102', 'STARTER', 'MEI', 50, 50, 1),
  ('00000000-0000-4000-8000-000000018401', '00000000-0000-4000-8000-000000018103', 'STARTER', 'DEF', 50, 75, 2);
update public.lineups set status = 'PUBLISHED', published_by = '00000000-0000-4000-8000-000000018001', published_at = statement_timestamp()
where id = '00000000-0000-4000-8000-000000018401';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000018001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000018001","role":"authenticated","aal":"aal2"}', true);

-- Guardas preservadas através da extração
select throws_ok(
  $$select public.consolidate_match('00000000-0000-4000-8000-000000018301', 1, 0,
      '[{"sequence":1,"scorerAthleteId":"00000000-0000-4000-8000-0000000180ff","assistantAthleteId":null,"isOpponentOwnGoal":false}]',
      gen_random_uuid())$$,
  '22023', 'ATHLETE_NOT_IN_CONSOLIDATED_LINEUP', 'lineup validation still runs inside write_consolidation'
);

-- Consolidação válida
select lives_ok(
  $$select public.consolidate_match('00000000-0000-4000-8000-000000018301', 1, 2,
      '[{"sequence":1,"scorerAthleteId":"00000000-0000-4000-8000-000000018101","assistantAthleteId":"00000000-0000-4000-8000-000000018102","isOpponentOwnGoal":false}]',
      '00000000-0000-4000-8000-000000018501')$$,
  'consolidate_match still consolidates through the extracted routine'
);
select lives_ok(
  $$select public.consolidate_match('00000000-0000-4000-8000-000000018301', 1, 2,
      '[{"sequence":1,"scorerAthleteId":"00000000-0000-4000-8000-000000018101","assistantAthleteId":"00000000-0000-4000-8000-000000018102","isOpponentOwnGoal":false}]',
      '00000000-0000-4000-8000-000000018501')$$,
  'retry with the same key is idempotent'
);
reset role;

select is(
  (select count(*)::integer from public.match_consolidations where match_id = '00000000-0000-4000-8000-000000018301'),
  1, 'exactly one consolidation revision'
);
select is(
  (select revision from public.match_consolidations where match_id = '00000000-0000-4000-8000-000000018301'),
  1, 'first revision is 1'
);
select is(
  (select mbj_score || '-' || opponent_score from public.match_consolidations where match_id = '00000000-0000-4000-8000-000000018301'),
  '1-2', 'scores are stored verbatim'
);
select is(
  (select consolidated_by from public.match_consolidations where match_id = '00000000-0000-4000-8000-000000018301'),
  '00000000-0000-4000-8000-000000018001'::uuid, 'consolidated_by is the acting president'
);
select is(
  (select lineup_id from public.match_consolidations where match_id = '00000000-0000-4000-8000-000000018301'),
  '00000000-0000-4000-8000-000000018401'::uuid, 'the exact published lineup revision is captured'
);
select is(
  (select count(*)::integer from public.match_goals gc
   join public.match_consolidations c on c.id = gc.consolidation_id
   where c.match_id = '00000000-0000-4000-8000-000000018301'),
  1, 'goal count equals the MBJ score'
);
select is(
  (select status::text from public.matches where id = '00000000-0000-4000-8000-000000018301'),
  'COMPLETED', 'the match is marked COMPLETED'
);
select isnt(
  (select current_consolidation_id from public.matches where id = '00000000-0000-4000-8000-000000018301'),
  null, 'the match points at its current consolidation'
);
select is(
  (select r.closes_at - r.opens_at
   from public.mvp_voting_rounds r join public.match_consolidations c on c.id = r.consolidation_id
   where c.match_id = '00000000-0000-4000-8000-000000018301'),
  interval '24 hours', 'the MVP voting window is exactly 24 hours'
);
select is(
  (select count(*)::integer from public.notification_events e
   where e.kind = 'VOTING_OPENED'
     and e.resource_id in (
       select r.id from public.mvp_voting_rounds r
       join public.match_consolidations c on c.id = r.consolidation_id
       where c.match_id = '00000000-0000-4000-8000-000000018301')),
  1, 'one VOTING_OPENED notification event is enqueued'
);
select is(
  (select count(*)::integer from public.audit_logs
   where action = 'MATCH_CONSOLIDATED' and resource_id = '00000000-0000-4000-8000-000000018301'),
  1, 'the caller still writes the MATCH_CONSOLIDATED audit entry'
);
select is(
  (select count(*)::integer from private.command_results where command_name = 'consolidate_match'
   and idempotency_key = '00000000-0000-4000-8000-000000018501'),
  1, 'the result is cached under the consolidate_match command name'
);

-- Papel/AAL2 continua sendo checado pelo caller
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000018002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000018002","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select public.consolidate_match('00000000-0000-4000-8000-000000018301', 0, 0, '[]', gen_random_uuid())$$,
  '42501', 'FORBIDDEN', 'a non-president is still rejected before any write'
);
reset role;

select * from finish();
rollback;
