create or replace view public.season_rankings_view with (security_invoker=true) as
with current_consolidations as (
  select c.id,c.match_id from public.match_consolidations c join public.matches m on m.current_consolidation_id=c.id
  where c.status='VALID'
), goal_totals as (
  select m.season_id,g.scorer_athlete_id athlete_id,count(*)::integer goals,0::integer assists
  from current_consolidations c join public.matches m on m.id=c.match_id join public.match_goals g on g.consolidation_id=c.id
  where g.scorer_athlete_id is not null group by m.season_id,g.scorer_athlete_id
  union all
  select m.season_id,g.assistant_athlete_id,0,count(*)::integer
  from current_consolidations c join public.matches m on m.id=c.match_id join public.match_goals g on g.consolidation_id=c.id
  where g.assistant_athlete_id is not null group by m.season_id,g.assistant_athlete_id
), sporting as (
  select season_id,athlete_id,sum(goals)::integer goals,sum(assists)::integer assists from goal_totals group by season_id,athlete_id
), presence_totals as (
  select m.season_id,mp.athlete_id,count(*) filter(where mp.presence_status='CONFIRMED')::integer presences
  from current_consolidations c join public.matches m on m.id=c.match_id join public.match_presences mp on mp.match_id=m.id
  group by m.season_id,mp.athlete_id
), award_totals as (
  select m.season_id,aw.athlete_id,count(*)::integer mvp_awards
  from current_consolidations c join public.matches m on m.id=c.match_id
  join public.mvp_voting_rounds r on r.consolidation_id=c.id and r.status='CLOSED'
  join public.mvp_awards aw on aw.voting_round_id=r.id and aw.invalidated_at is null
  group by m.season_id,aw.athlete_id
)
select s.id season_id,s.year,a.id athlete_id,a.shirt_name,a.shirt_number,
  coalesce(sp.goals,0)::integer goals,coalesce(sp.assists,0)::integer assists,
  coalesce(pt.presences,0)::integer presences,coalesce(at.mvp_awards,0)::integer mvp_awards
from public.seasons s cross join public.athletes a
left join sporting sp on sp.season_id=s.id and sp.athlete_id=a.id
left join presence_totals pt on pt.season_id=s.id and pt.athlete_id=a.id
left join award_totals at on at.season_id=s.id and at.athlete_id=a.id;

create or replace view public.open_mvp_voting_view with (security_invoker=true) as
select r.id voting_round_id,r.opens_at,r.closes_at,c.match_id,c.lineup_id,
  voter.id voter_athlete_id,candidate.id candidate_athlete_id,candidate.shirt_name,candidate.shirt_number,
  lp.assignment,exists(select 1 from public.mvp_votes v where v.voting_round_id=r.id and v.voter_athlete_id=voter.id) has_voted
from public.mvp_voting_rounds r
join public.match_consolidations c on c.id=r.consolidation_id and c.status='VALID'
join public.matches m on m.current_consolidation_id=c.id
join public.athletes voter on voter.user_id=auth.uid() and voter.status<>'INACTIVE'
join public.lineup_players lp on lp.lineup_id=c.lineup_id
join public.athletes candidate on candidate.id=lp.athlete_id
where r.status='OPEN' and statement_timestamp()<r.closes_at and candidate.id<>voter.id and private.has_role('ATHLETE');

revoke all on public.season_rankings_view,public.open_mvp_voting_view from public,anon,authenticated;
grant select on public.season_rankings_view,public.open_mvp_voting_view to authenticated;
