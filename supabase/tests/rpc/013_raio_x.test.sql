begin;

select plan(21);

select has_function('public', 'head_to_head_record', array['text'], 'head_to_head_record(text) exists');
select has_view('public', 'club_all_time_record', 'club_all_time_record view exists');
select has_view('public', 'season_scoring_leaders', 'season_scoring_leaders view exists');

-- Fixtures: um adversário com histórico (3 jogos), um com 1 jogo, um agendado
-- (sem consolidação) e um com consolidação INVALIDATED — os dois últimos não
-- entram no retrospecto.
insert into auth.users (id, email) values ('00000000-0000-4000-8000-00000000e001', 'raiox@example.test');
insert into public.profiles (id) values ('00000000-0000-4000-8000-00000000e001');
insert into public.user_roles (user_id, role, assigned_by)
values ('00000000-0000-4000-8000-00000000e001', 'PRESIDENT', '00000000-0000-4000-8000-00000000e001');

update public.seasons set is_active = false;
insert into public.seasons (id, year, is_active, starts_on, status)
values ('00000000-0000-4000-8000-00000000e201', 2050, true, '2050-01-01', 'ACTIVE');

-- helper de fixture: cada partida ganha um lineup publicado + (opcional) uma
-- consolidação, e a partida aponta para ela.
insert into public.matches (id, season_id, opponent_name, match_date, confirmation_deadline, status, created_by, updated_by) values
  ('00000000-0000-4000-8000-00000000e301', '00000000-0000-4000-8000-00000000e201', 'Alpha FC', now() - interval '30 days', now() - interval '31 days', 'COMPLETED', '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000e302', '00000000-0000-4000-8000-00000000e201', 'Alpha FC', now() - interval '20 days', now() - interval '21 days', 'COMPLETED', '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000e303', '00000000-0000-4000-8000-00000000e201', 'Alpha FC', now() - interval '10 days', now() - interval '11 days', 'COMPLETED', '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000e304', '00000000-0000-4000-8000-00000000e201', 'Alpha FC', now() + interval '7 days', now() + interval '6 days', 'SCHEDULED', '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000e305', '00000000-0000-4000-8000-00000000e201', 'Beta FC', now() - interval '5 days', now() - interval '6 days', 'COMPLETED', '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000e306', '00000000-0000-4000-8000-00000000e201', 'Alpha FC', now() - interval '3 days', now() - interval '4 days', 'COMPLETED', '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e001');

insert into public.lineups (id, match_id, revision, formation_code, status, created_by, published_by, published_at) values
  ('00000000-0000-4000-8000-00000000e401', '00000000-0000-4000-8000-00000000e301', 1, '4-3-3', 'PUBLISHED', '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e001', now()),
  ('00000000-0000-4000-8000-00000000e402', '00000000-0000-4000-8000-00000000e302', 1, '4-3-3', 'PUBLISHED', '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e001', now()),
  ('00000000-0000-4000-8000-00000000e403', '00000000-0000-4000-8000-00000000e303', 1, '4-3-3', 'PUBLISHED', '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e001', now()),
  ('00000000-0000-4000-8000-00000000e405', '00000000-0000-4000-8000-00000000e305', 1, '4-3-3', 'PUBLISHED', '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e001', now()),
  ('00000000-0000-4000-8000-00000000e406', '00000000-0000-4000-8000-00000000e306', 1, '4-3-3', 'PUBLISHED', '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e001', now());

insert into public.match_consolidations (id, match_id, lineup_id, revision, mbj_score, opponent_score, status, idempotency_key, consolidated_by) values
  ('00000000-0000-4000-8000-00000000e501', '00000000-0000-4000-8000-00000000e301', '00000000-0000-4000-8000-00000000e401', 1, 3, 1, 'VALID', gen_random_uuid(), '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000e502', '00000000-0000-4000-8000-00000000e302', '00000000-0000-4000-8000-00000000e402', 1, 2, 2, 'VALID', gen_random_uuid(), '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000e503', '00000000-0000-4000-8000-00000000e303', '00000000-0000-4000-8000-00000000e403', 1, 0, 1, 'VALID', gen_random_uuid(), '00000000-0000-4000-8000-00000000e001'),
  ('00000000-0000-4000-8000-00000000e505', '00000000-0000-4000-8000-00000000e305', '00000000-0000-4000-8000-00000000e405', 1, 1, 0, 'VALID', gen_random_uuid(), '00000000-0000-4000-8000-00000000e001');
insert into public.match_consolidations (id, match_id, lineup_id, revision, mbj_score, opponent_score, status, idempotency_key, consolidated_by, invalidated_by, invalidated_at) values
  ('00000000-0000-4000-8000-00000000e506', '00000000-0000-4000-8000-00000000e306', '00000000-0000-4000-8000-00000000e406', 1, 5, 0, 'INVALIDATED', gen_random_uuid(), '00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000e001', now());

update public.matches set current_consolidation_id = '00000000-0000-4000-8000-00000000e501' where id = '00000000-0000-4000-8000-00000000e301';
update public.matches set current_consolidation_id = '00000000-0000-4000-8000-00000000e502' where id = '00000000-0000-4000-8000-00000000e302';
update public.matches set current_consolidation_id = '00000000-0000-4000-8000-00000000e503' where id = '00000000-0000-4000-8000-00000000e303';
update public.matches set current_consolidation_id = '00000000-0000-4000-8000-00000000e505' where id = '00000000-0000-4000-8000-00000000e305';
update public.matches set current_consolidation_id = '00000000-0000-4000-8000-00000000e506' where id = '00000000-0000-4000-8000-00000000e306';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000e001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000e001","role":"authenticated","aal":"aal2"}', true);

-- Raio-X vs. Alpha FC: 3 jogos VALID (3-1, 2-2, 0-1) → 1V 1E 1D, saldo (5-4) = +1.
select is((select has_history from public.head_to_head_record('Alpha FC')), true, 'Alpha FC has history');
select is((select matches_played from public.head_to_head_record('Alpha FC')), 3, 'Alpha FC: 3 completed+valid matches');
select is((select wins from public.head_to_head_record('Alpha FC')), 1, 'Alpha FC: 1 win');
select is((select draws from public.head_to_head_record('Alpha FC')), 1, 'Alpha FC: 1 draw');
select is((select losses from public.head_to_head_record('Alpha FC')), 1, 'Alpha FC: 1 loss');
select is((select goal_diff from public.head_to_head_record('Alpha FC')), 1, 'Alpha FC: goal diff (5-4) = +1');

-- O nome é normalizado com btrim.
select is((select matches_played from public.head_to_head_record('  Alpha FC  ')), 3, 'opponent name is trimmed before matching');

-- Beta FC: 1 jogo 1-0.
select is((select matches_played from public.head_to_head_record('Beta FC')), 1, 'Beta FC: 1 match');
select is((select wins from public.head_to_head_record('Beta FC')), 1, 'Beta FC: 1 win');
select is((select goal_diff from public.head_to_head_record('Beta FC')), 1, 'Beta FC: goal diff +1');

-- Sem histórico → exatamente uma linha, has_history false, tudo zero.
select is((select has_history from public.head_to_head_record('Gamma FC')), false, 'unknown opponent: hasHistory false');
select is((select matches_played from public.head_to_head_record('Gamma FC')), 0, 'unknown opponent: 0 matches');
select is((select wins + draws + losses + goal_diff from public.head_to_head_record('Gamma FC')), 0, 'unknown opponent: all zero');

-- Retrospecto geral do clube: só os 4 COMPLETED com consolidação VALID.
select is((select matches_played from public.club_all_time_record), 4, 'club record counts only completed+valid matches (SCHEDULED and INVALIDATED excluded)');
select is((select wins from public.club_all_time_record), 2, 'club record: 2 wins');
select is((select draws from public.club_all_time_record), 1, 'club record: 1 draw');
select is((select losses from public.club_all_time_record), 1, 'club record: 1 loss');
select is(
  (select goals_for || '-' || goals_against || ' (' || goal_diff || ')' from public.club_all_time_record),
  '6-4 (2)', 'club record: 6 for, 4 against, +2');

reset role;

select * from finish();
rollback;
