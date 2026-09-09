-- Feature 003 · US4 (UX & Gamificação) · T082
-- Implementação real de `private.evaluate_trophies`, substituindo o stub no-op da
-- Fase 2. Chamada dentro de `finalize_sumula` depois de gravar a consolidação:
-- para cada atleta afetado e cada troféu do catálogo, avalia o gatilho na
-- temporada e faz `insert ... on conflict (athlete_id, trophy_code, season_id) do
-- nothing` — nunca duplica, nunca revoga (FR-021, FR-027, SC-011).
--
-- `#variable_conflict use_column` + aliases internos (`season_uuid` / `ids`)
-- porque `create or replace` não permite renomear os parâmetros do stub e o token
-- `season_id` no `ON CONFLICT` colidiria com o parâmetro.
--
-- Os gatilhos (contracts/gamification.md) são avaliados sobre consolidações
-- `VALID` de partidas `COMPLETED` da temporada. A regra "jogou" / "clean sheet"
-- segue R3 e é idêntica à de `season_scoring_leaders` / `season_trophy_progress`
-- — repetida aqui (não reusada) porque esta migração aplica antes de
-- `20260908160600_gamification_views.sql`.

create or replace function private.evaluate_trophies(season_id uuid, athlete_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  season_uuid uuid := season_id;
  ids uuid[] := athlete_ids;
begin
  if season_uuid is null or ids is null or array_length(ids, 1) is null then
    return;
  end if;

  -- ARTILHEIRO / GARCOM / VETERANO / MURALHA (acumulados na temporada).
  insert into public.athlete_trophies (athlete_id, trophy_code, season_id, trigger_context)
  select
    ath,
    t.code,
    season_uuid,
    jsonb_build_object('metric', metric.value, 'threshold', t.threshold, 'seasonId', season_uuid)
  from unnest(ids) as ath
  cross join public.trophy_catalog t
  cross join lateral (
    select case t.code
      when 'ARTILHEIRO' then (
        select count(*)::integer
        from public.match_consolidations c
        join public.matches mt
          on mt.current_consolidation_id = c.id and mt.season_id = season_uuid and mt.status = 'COMPLETED'
        join public.match_goals g on g.consolidation_id = c.id
        where c.status = 'VALID' and g.scorer_athlete_id = ath
      )
      when 'GARCOM' then (
        select count(*)::integer
        from public.match_consolidations c
        join public.matches mt
          on mt.current_consolidation_id = c.id and mt.season_id = season_uuid and mt.status = 'COMPLETED'
        join public.match_goals g on g.consolidation_id = c.id
        where c.status = 'VALID' and g.assistant_athlete_id = ath
      )
      when 'VETERANO' then (
        select count(distinct c.id)::integer
        from public.match_consolidations c
        join public.matches mt
          on mt.current_consolidation_id = c.id and mt.season_id = season_uuid and mt.status = 'COMPLETED'
        where c.status = 'VALID'
          and (
            exists (
              select 1 from public.lineup_players lp
              where lp.lineup_id = c.lineup_id and lp.athlete_id = ath and lp.assignment = 'STARTER'
            )
            or exists (
              select 1 from public.match_substitutions s
              where s.consolidation_id = c.id and s.in_athlete_id = ath
            )
          )
      )
      when 'MURALHA' then (
        select count(*)::integer
        from public.match_consolidations c
        join public.matches mt
          on mt.current_consolidation_id = c.id and mt.season_id = season_uuid and mt.status = 'COMPLETED'
        join public.match_goalkeeper_assignments gk
          on gk.consolidation_id = c.id and gk.athlete_id = ath and gk.to_minute is null
        where c.status = 'VALID'
          and c.opponent_score = 0
          and (select count(*) from public.match_goalkeeper_assignments g2 where g2.consolidation_id = c.id) = 1
      )
      else 0
    end as value
  ) metric
  where t.scope = 'SEASON_CUMULATIVE'
    and metric.value >= t.threshold
  on conflict (athlete_id, trophy_code, season_id) do nothing;

  -- HAT_TRICK: >= threshold gols do atleta numa mesma consolidação VALID.
  insert into public.athlete_trophies (athlete_id, trophy_code, season_id, trigger_context)
  select
    ath,
    'HAT_TRICK',
    season_uuid,
    jsonb_build_object('matchId', best.match_id, 'goalsInMatch', best.n, 'seasonId', season_uuid)
  from unnest(ids) as ath
  cross join (select threshold from public.trophy_catalog where code = 'HAT_TRICK') ht
  cross join lateral (
    select mt.id as match_id, count(*)::integer as n
    from public.match_consolidations c
    join public.matches mt
      on mt.current_consolidation_id = c.id and mt.season_id = season_uuid and mt.status = 'COMPLETED'
    join public.match_goals g on g.consolidation_id = c.id and g.scorer_athlete_id = ath
    where c.status = 'VALID'
    group by mt.id
    having count(*) >= ht.threshold
    order by count(*) desc, mt.id
    limit 1
  ) best
  on conflict (athlete_id, trophy_code, season_id) do nothing;
end;
$$;

revoke all on function private.evaluate_trophies(uuid, uuid[]) from public, anon, authenticated;
grant execute on function private.evaluate_trophies(uuid, uuid[]) to service_role;
