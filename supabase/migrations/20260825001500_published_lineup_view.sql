create or replace view public.published_lineup_view
with (security_invoker = true)
as
select
  l.id as lineup_id,
  l.match_id,
  l.revision,
  l.formation_code,
  l.published_at,
  lp.athlete_id,
  lp.assignment,
  lp.tactical_position,
  lp.position_x,
  lp.position_y,
  lp.display_order,
  a.shirt_name,
  a.shirt_number
from public.lineups l
join public.lineup_players lp on lp.lineup_id = l.id
join public.athletes a on a.id = lp.athlete_id
where l.status = 'PUBLISHED';

revoke all on public.published_lineup_view from public, anon, authenticated;
grant select on public.published_lineup_view to authenticated;

alter table public.lineups replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lineups'
  ) then
    alter publication supabase_realtime add table public.lineups;
  end if;
end;
$$;
