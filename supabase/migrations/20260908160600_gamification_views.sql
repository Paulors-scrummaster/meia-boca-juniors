-- Feature 003 · US4 (UX & Gamificação) · T084
-- Leituras derivadas para o cartão, o Raio-X, a aba "Histórico & Conquistas", o
-- progresso de troféus e a galeria. Tudo somente-leitura para contas ativas:
--   - dashboards sem parâmetro  -> views `security_invoker` (herdam o RLS das
--     tabelas MVP);
--   - leituras parametrizadas   -> funções `security definer`/`stable`
--     concedidas a `authenticated` (mesmo padrão de `athlete_delinquency_badge`).
--
-- "Jogou a partida" e "clean sheet" seguem R3: titular no lineup consolidado ou
-- reserva que entrou por substituição; goleiro que cobriu a partida inteira
-- (único registro, `to_minute is null`) com `opponent_score = 0`.

-- Retrospecto do clube sem filtro de adversário (aba Histórico — FR-024).
create view public.club_all_time_record with (security_invoker = true) as
select
  count(*)::integer as matches_played,
  count(*) filter (where c.mbj_score > c.opponent_score)::integer as wins,
  count(*) filter (where c.mbj_score = c.opponent_score)::integer as draws,
  count(*) filter (where c.mbj_score < c.opponent_score)::integer as losses,
  coalesce(sum(c.mbj_score), 0)::integer as goals_for,
  coalesce(sum(c.opponent_score), 0)::integer as goals_against,
  (coalesce(sum(c.mbj_score), 0) - coalesce(sum(c.opponent_score), 0))::integer as goal_diff
from public.matches m
join public.match_consolidations c
  on c.id = m.current_consolidation_id and c.status = 'VALID'
where m.status = 'COMPLETED';

-- Gols / assistências / partidas jogadas / clean sheets por (temporada, atleta).
-- Base dos destaques semanais (B10b) e do progresso de troféus.
create view public.season_scoring_leaders with (security_invoker = true) as
with current_consolidations as (
  select c.id, c.lineup_id, c.opponent_score, m.season_id
  from public.match_consolidations c
  join public.matches m on m.current_consolidation_id = c.id
  where c.status = 'VALID' and m.status = 'COMPLETED'
),
goals as (
  select cc.season_id, g.scorer_athlete_id as athlete_id, count(*)::integer as goals
  from current_consolidations cc
  join public.match_goals g on g.consolidation_id = cc.id
  where g.scorer_athlete_id is not null
  group by cc.season_id, g.scorer_athlete_id
),
assists as (
  select cc.season_id, g.assistant_athlete_id as athlete_id, count(*)::integer as assists
  from current_consolidations cc
  join public.match_goals g on g.consolidation_id = cc.id
  where g.assistant_athlete_id is not null
  group by cc.season_id, g.assistant_athlete_id
),
appearances as (
  select cc.season_id, lp.athlete_id, count(distinct cc.id)::integer as matches_played
  from current_consolidations cc
  join public.lineup_players lp on lp.lineup_id = cc.lineup_id
  where lp.assignment = 'STARTER'
    or exists (
      select 1 from public.match_substitutions s
      where s.consolidation_id = cc.id and s.in_athlete_id = lp.athlete_id
    )
  group by cc.season_id, lp.athlete_id
),
clean_sheets as (
  select cc.season_id, gk.athlete_id, count(*)::integer as clean_sheets
  from current_consolidations cc
  join public.match_goalkeeper_assignments gk on gk.consolidation_id = cc.id
  where gk.to_minute is null
    and cc.opponent_score = 0
    and (
      select count(*) from public.match_goalkeeper_assignments g2 where g2.consolidation_id = cc.id
    ) = 1
  group by cc.season_id, gk.athlete_id
)
select
  s.id as season_id,
  s.year,
  a.id as athlete_id,
  a.shirt_name,
  a.shirt_number,
  coalesce(g.goals, 0)::integer as goals,
  coalesce(x.assists, 0)::integer as assists,
  coalesce(ap.matches_played, 0)::integer as matches_played,
  coalesce(cs.clean_sheets, 0)::integer as clean_sheets
from public.seasons s
cross join public.athletes a
left join goals g on g.season_id = s.id and g.athlete_id = a.id
left join assists x on x.season_id = s.id and x.athlete_id = a.id
left join appearances ap on ap.season_id = s.id and ap.athlete_id = a.id
left join clean_sheets cs on cs.season_id = s.id and cs.athlete_id = a.id
where a.status <> 'INACTIVE'
  and (
    g.goals is not null or x.assists is not null
    or ap.matches_played is not null or cs.clean_sheets is not null
  );

revoke all on public.club_all_time_record, public.season_scoring_leaders from anon, authenticated;
grant select on public.club_all_time_record, public.season_scoring_leaders to authenticated;

-- Raio-X: confronto direto por adversário (FR-022/023, SC-010). Sempre devolve
-- exatamente uma linha; `has_history = false` + zeros quando não há histórico.
create or replace function public.head_to_head_record(opponent_name_input text)
returns table (
  has_history boolean,
  matches_played integer,
  wins integer,
  draws integer,
  losses integer,
  goal_diff integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with played as (
    select c.mbj_score, c.opponent_score
    from public.matches m
    join public.match_consolidations c
      on c.id = m.current_consolidation_id and c.status = 'VALID'
    where m.status = 'COMPLETED'
      and m.opponent_name = btrim(coalesce(opponent_name_input, ''))
  )
  select
    count(*) > 0 as has_history,
    count(*)::integer as matches_played,
    count(*) filter (where mbj_score > opponent_score)::integer as wins,
    count(*) filter (where mbj_score = opponent_score)::integer as draws,
    count(*) filter (where mbj_score < opponent_score)::integer as losses,
    (coalesce(sum(mbj_score), 0) - coalesce(sum(opponent_score), 0))::integer as goal_diff
  from played;
$$;

-- Payload de renderização do cartão (FR-019a–h). `incomplete = (overall is null)`.
create or replace function public.athlete_card(athlete_uuid uuid)
returns table (
  athlete_id uuid,
  shirt_name text,
  shirt_number smallint,
  primary_position text,
  photo_path text,
  pace smallint,
  shooting smallint,
  passing smallint,
  dribbling smallint,
  defending smallint,
  physical smallint,
  overall smallint,
  incomplete boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.id,
    a.shirt_name,
    a.shirt_number,
    a.primary_position,
    a.photo_path,
    ca.pace, ca.shooting, ca.passing, ca.dribbling, ca.defending, ca.physical,
    ca.overall,
    ca.overall is null as incomplete
  from public.athletes a
  left join public.athlete_card_attributes ca on ca.athlete_id = a.id
  where a.id = athlete_uuid;
$$;

-- Galeria de troféus do atleta, todas as temporadas (FR-021b).
create or replace function public.athlete_trophy_gallery(athlete_uuid uuid)
returns table (
  trophy_code text,
  title_pt text,
  description_pt text,
  season_id uuid,
  season_year integer,
  awarded_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.trophy_code,
    tc.title_pt,
    tc.description_pt,
    t.season_id,
    s.year,
    t.awarded_at
  from public.athlete_trophies t
  join public.trophy_catalog tc on tc.code = t.trophy_code
  join public.seasons s on s.id = t.season_id
  where t.athlete_id = athlete_uuid
  order by s.year desc, tc.display_order;
$$;

-- Progresso atual vs. `threshold` por troféu, na temporada dada. Sempre devolve as
-- cinco linhas do catálogo, com `current_value = 0` quando não há dados.
create or replace function public.season_trophy_progress(athlete_uuid uuid, season_uuid uuid)
returns table (
  trophy_code text,
  title_pt text,
  scope public.trophy_scope,
  threshold integer,
  current_value integer,
  achieved boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.code,
    t.title_pt,
    t.scope,
    t.threshold,
    v.current_value,
    v.current_value >= t.threshold as achieved
  from public.trophy_catalog t
  cross join lateral (
    select coalesce(l.goals, 0) as goals,
           coalesce(l.assists, 0) as assists,
           coalesce(l.matches_played, 0) as matches_played,
           coalesce(l.clean_sheets, 0) as clean_sheets
    from (select 1) one
    left join public.season_scoring_leaders l
      on l.athlete_id = athlete_uuid and l.season_id = season_uuid
  ) agg
  cross join lateral (
    select coalesce(max(cnt), 0) as best_match_goals
    from (
      select count(*) as cnt
      from public.match_consolidations c
      join public.matches m on m.current_consolidation_id = c.id and m.season_id = season_uuid
      join public.match_goals g on g.consolidation_id = c.id and g.scorer_athlete_id = athlete_uuid
      where c.status = 'VALID'
      group by c.id
    ) per_match
  ) htk
  cross join lateral (
    select (
      case t.code
        when 'ARTILHEIRO' then agg.goals
        when 'GARCOM' then agg.assists
        when 'VETERANO' then agg.matches_played
        when 'MURALHA' then agg.clean_sheets
        when 'HAT_TRICK' then htk.best_match_goals
        else 0
      end
    )::integer as current_value
  ) v
  order by t.display_order;
$$;

revoke all on function public.head_to_head_record(text) from public, anon;
revoke all on function public.athlete_card(uuid) from public, anon;
revoke all on function public.athlete_trophy_gallery(uuid) from public, anon;
revoke all on function public.season_trophy_progress(uuid, uuid) from public, anon;
grant execute on function public.head_to_head_record(text) to authenticated;
grant execute on function public.athlete_card(uuid) to authenticated;
grant execute on function public.athlete_trophy_gallery(uuid) to authenticated;
grant execute on function public.season_trophy_progress(uuid, uuid) to authenticated;
