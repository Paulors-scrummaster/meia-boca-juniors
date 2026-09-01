begin;

select plan(20);

select has_table('public', 'match_consolidations', 'immutable consolidations table exists');
select has_table('public', 'match_goals', 'official goal contributions table exists');
select has_table('public', 'mvp_voting_rounds', 'voting rounds table exists');
select has_table('public', 'mvp_votes', 'votes table exists');
select has_table('public', 'mvp_awards', 'tied awards table exists');
select col_is_fk('public', 'match_consolidations', 'match_id', 'consolidations retain match history');
select col_is_fk('public', 'match_consolidations', 'lineup_id', 'consolidations retain exact lineup history');
select col_is_fk('public', 'match_goals', 'consolidation_id', 'goals retain consolidation history');
select col_is_fk('public', 'mvp_voting_rounds', 'consolidation_id', 'rounds retain consolidation history');
select col_is_fk('public', 'mvp_votes', 'voting_round_id', 'votes retain round history');
select col_is_fk('public', 'mvp_awards', 'voting_round_id', 'awards retain round history');
select col_is_unique('public', 'match_consolidations', array['match_id', 'revision'], 'consolidation revisions are unique per match');
select col_is_unique('public', 'mvp_voting_rounds', array['consolidation_id'], 'one voting round belongs to each consolidation');
select col_is_unique('public', 'mvp_votes', array['voting_round_id', 'voter_athlete_id'], 'one vote is allowed per athlete and round');
select col_is_pk('public', 'mvp_awards', array['voting_round_id', 'athlete_id'], 'every tied winner has one award per round');

select throws_ok(
  $$insert into public.match_consolidations (match_id, lineup_id, revision, mbj_score, opponent_score, status, idempotency_key, consolidated_by)
    values (gen_random_uuid(), gen_random_uuid(), 0, 0, 0, 'VALID', gen_random_uuid(), gen_random_uuid())$$,
  null, null, 'consolidation revision must be positive'
);
select throws_ok(
  $$insert into public.mvp_votes (voting_round_id, voter_athlete_id, voted_athlete_id)
    values (gen_random_uuid(), '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001')$$,
  null, null, 'self votes are rejected'
);
select throws_ok(
  $$insert into public.mvp_awards (voting_round_id, athlete_id, vote_count)
    values (gen_random_uuid(), gen_random_uuid(), -1)$$,
  null, null, 'award vote counts are non-negative'
);
select has_trigger('public', 'match_consolidations', 'guard_match_consolidation_immutability', 'consolidation history is immutable');
select has_trigger('public', 'match_goals', 'guard_match_goal_immutability', 'goal history is immutable');

select * from finish();
rollback;
