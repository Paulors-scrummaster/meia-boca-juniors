create or replace view public.next_match_view
with (security_invoker = true)
as
select
  m.id,
  m.season_id,
  m.opponent_name,
  m.competition_name,
  m.location_name,
  m.match_date,
  m.confirmation_deadline,
  m.status,
  m.schedule_revision,
  mp.id as presence_id,
  coalesce(mp.call_status, 'NOT_CALLED'::public.call_status) as call_status,
  mp.presence_status,
  mp.is_exceptional_call,
  mp.individual_deadline,
  case when mp.is_exceptional_call then mp.individual_deadline else m.confirmation_deadline end
    as applicable_deadline
from public.matches m
left join public.athletes a on a.user_id = auth.uid()
left join public.match_presences mp on mp.match_id = m.id and mp.athlete_id = a.id
where m.id = (
  select candidate.id
  from public.matches candidate
  where candidate.status = 'SCHEDULED' and candidate.match_date > statement_timestamp()
  order by candidate.match_date
  limit 1
);

create or replace view public.roster_presence_view
with (security_invoker = true)
as
select
  mp.id as presence_id,
  mp.match_id,
  mp.athlete_id,
  a.shirt_name as athlete_name,
  mp.call_status,
  mp.presence_status,
  mp.is_exceptional_call,
  mp.individual_deadline,
  mp.responded_at,
  mp.call_revision
from public.match_presences mp
join public.athletes a on a.id = mp.athlete_id;

create or replace view public.staff_attendance_view
with (security_invoker = true)
as
select
  mp.id as presence_id,
  mp.match_id,
  mp.athlete_id,
  a.full_name as athlete_name,
  mp.call_status,
  mp.presence_status,
  mp.is_exceptional_call,
  mp.individual_deadline,
  case when mp.is_exceptional_call then mp.individual_deadline else m.confirmation_deadline end
    as applicable_deadline,
  mp.responded_at,
  mp.call_revision,
  pj.reason
from public.match_presences mp
join public.matches m on m.id = mp.match_id
join public.athletes a on a.id = mp.athlete_id
left join public.presence_justifications pj on pj.presence_id = mp.id
where private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
  and private.current_session_is_aal2();

revoke all on public.next_match_view, public.roster_presence_view, public.staff_attendance_view
from public, anon, authenticated;
grant select on public.next_match_view, public.roster_presence_view, public.staff_attendance_view
to authenticated;

alter table public.matches replica identity full;
alter table public.match_presences replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_presences'
  ) then
    alter publication supabase_realtime add table public.match_presences;
  end if;
end;
$$;
