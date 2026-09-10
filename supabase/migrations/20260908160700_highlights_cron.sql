-- Feature 003 · US4 (UX & Gamificação) · T085
-- Destaques semanais (pg_cron, segunda 08:00 SP) e pré-jogo (ligado à rotina de
-- lembrete de partida existente do MVP — ~24 h antes do apito, sem novo
-- scheduler). Ambos enfileiram via `private.enqueue_notification`; a entrega
-- (Edge Function) filtra por push habilitado e degrada sem bloquear nada
-- (FR-025/FR-026, SC-007).

-- Destaques semanais -------------------------------------------------------------
-- Regra determinística sobre consolidações VALID da temporada ativa finalizadas
-- nos últimos 7 dias. Categoria com empate no topo (ou sem dados) é omitida.
create or replace function private.generate_weekly_highlights(
  scan_from timestamptz default statement_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_season_id uuid;
  match_count integer;
  highlights jsonb;
  payload jsonb;
  week_key text;
  recipients uuid[];
  event_uuid uuid;
begin
  select id into active_season_id from public.seasons where status = 'ACTIVE';
  if active_season_id is null then
    return jsonb_build_object('enqueued', false, 'reason', 'NO_ACTIVE_SEASON');
  end if;

  with scoped as (
    select c.id, c.opponent_score
    from public.match_consolidations c
    join public.matches m on m.current_consolidation_id = c.id and m.season_id = active_season_id
    where c.status = 'VALID'
      and c.consolidated_at >= scan_from - interval '7 days'
      and c.consolidated_at < scan_from
  ),
  goal_tally as (
    select g.scorer_athlete_id as athlete_id, count(*)::integer as v
    from scoped s join public.match_goals g on g.consolidation_id = s.id
    where g.scorer_athlete_id is not null
    group by g.scorer_athlete_id
  ),
  assist_tally as (
    select g.assistant_athlete_id as athlete_id, count(*)::integer as v
    from scoped s join public.match_goals g on g.consolidation_id = s.id
    where g.assistant_athlete_id is not null
    group by g.assistant_athlete_id
  ),
  keeper_tally as (
    select gk.athlete_id, sum(s.opponent_score)::integer as conceded, count(*)::integer as games
    from scoped s
    join public.match_goalkeeper_assignments gk on gk.consolidation_id = s.id
    where gk.to_minute is null
      and (select count(*) from public.match_goalkeeper_assignments g2 where g2.consolidation_id = s.id) = 1
    group by gk.athlete_id
  ),
  scorer_leaders as (
    select athlete_id, v from goal_tally where v = (select max(v) from goal_tally)
  ),
  assister_leaders as (
    select athlete_id, v from assist_tally where v = (select max(v) from assist_tally)
  ),
  keeper_ranked as (
    select athlete_id, conceded, games,
           row_number() over (order by conceded asc, games desc) as rn
    from keeper_tally
  ),
  keeper_leader as (
    select k1.athlete_id, k1.conceded, k1.games
    from keeper_ranked k1
    where k1.rn = 1
      and not exists (
        select 1 from keeper_ranked k2
        where k2.rn = 2 and k2.conceded = k1.conceded and k2.games = k1.games
      )
  )
  select
    count(*) over (),
    jsonb_strip_nulls(jsonb_build_object(
      'topScorer', case when (select count(*) from scorer_leaders) = 1 then (
        select jsonb_build_object('athleteId', sl.athlete_id, 'shirtName', a.shirt_name, 'goals', sl.v)
        from scorer_leaders sl join public.athletes a on a.id = sl.athlete_id
      ) end,
      'topAssister', case when (select count(*) from assister_leaders) = 1 then (
        select jsonb_build_object('athleteId', al.athlete_id, 'shirtName', a.shirt_name, 'assists', al.v)
        from assister_leaders al join public.athletes a on a.id = al.athlete_id
      ) end,
      'topKeeper', (
        select jsonb_build_object('athleteId', kl.athlete_id, 'shirtName', a.shirt_name,
                                  'concededGoals', kl.conceded, 'matches', kl.games)
        from keeper_leader kl join public.athletes a on a.id = kl.athlete_id
      )
    ))
  into match_count, highlights
  from scoped;

  if coalesce(match_count, 0) = 0 then
    return jsonb_build_object('enqueued', false, 'reason', 'NO_MATCHES');
  end if;

  week_key := 'weekly-highlights:'
    || to_char((scan_from at time zone 'America/Sao_Paulo')::date, 'IYYY-"W"IW');

  payload := jsonb_build_object(
    'title', 'Destaques da semana',
    'body', 'Confira os craques da semana no Meia Boca Juniors.',
    'route', '/app/historico',
    'seasonId', active_season_id,
    'highlights', coalesce(highlights, '{}'::jsonb)
  );

  recipients := array(
    select distinct a.user_id
    from public.athletes a
    join public.profiles p on p.id = a.user_id and p.account_status = 'ACTIVE'
    join public.user_roles ur on ur.user_id = a.user_id and ur.role = 'ATHLETE'
    where a.status <> 'INACTIVE'
  );

  event_uuid := private.enqueue_notification(
    'WEEKLY_HIGHLIGHTS'::public.notification_kind, 'season', active_season_id,
    week_key, payload, recipients
  );

  return jsonb_build_object(
    'enqueued', true, 'eventId', event_uuid, 'weekKey', week_key,
    'highlights', coalesce(highlights, '{}'::jsonb)
  );
end;
$$;

revoke all on function private.generate_weekly_highlights(timestamptz) from public, anon, authenticated;
grant execute on function private.generate_weekly_highlights(timestamptz) to service_role;

-- Pré-jogo --------------------------------------------------------------------
-- Payload determinístico: estatísticas-chave da temporada ativa do MBJ + o
-- retrospecto (Raio-X) contra o adversário. SEM estatísticas de temporada do
-- adversário. Idempotente por partida (dedup key).
create or replace function private.generate_pre_match_highlights(match_uuid uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  match_row public.matches%rowtype;
  active_season_id uuid;
  h2h record;
  mbj_stats jsonb;
  payload jsonb;
  recipients uuid[];
  event_uuid uuid;
  dedup_key text := 'pre-match-highlights:' || match_uuid::text;
begin
  select * into match_row from public.matches where id = match_uuid;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select id into active_season_id from public.seasons where status = 'ACTIVE';
  select * into h2h from public.head_to_head_record(match_row.opponent_name);

  mbj_stats := jsonb_build_object(
    'topScorers', coalesce((
      select jsonb_agg(jsonb_build_object('shirtName', t.shirt_name, 'goals', t.goals)
                       order by t.goals desc, t.shirt_number)
      from (
        select shirt_name, shirt_number, goals
        from public.season_scoring_leaders
        where season_id = active_season_id and goals > 0
        order by goals desc, shirt_number
        limit 3
      ) t
    ), '[]'::jsonb),
    'topAssisters', coalesce((
      select jsonb_agg(jsonb_build_object('shirtName', t.shirt_name, 'assists', t.assists)
                       order by t.assists desc, t.shirt_number)
      from (
        select shirt_name, shirt_number, assists
        from public.season_scoring_leaders
        where season_id = active_season_id and assists > 0
        order by assists desc, shirt_number
        limit 3
      ) t
    ), '[]'::jsonb),
    'clubRecord', (select to_jsonb(r) from public.club_all_time_record r)
  );

  payload := jsonb_build_object(
    'title', 'Pré-jogo: MBJ x ' || match_row.opponent_name,
    'body', case
      when h2h.has_history then
        'Retrospecto vs. ' || match_row.opponent_name || ': '
        || h2h.wins || 'V ' || h2h.draws || 'E ' || h2h.losses || 'D.'
      else 'Primeiro confronto contra ' || match_row.opponent_name || '.'
    end,
    'route', '/app/partidas/' || match_uuid::text,
    'matchId', match_uuid,
    'opponentName', match_row.opponent_name,
    'headToHead', jsonb_strip_nulls(jsonb_build_object(
      'hasHistory', h2h.has_history,
      'wins', h2h.wins,
      'draws', h2h.draws,
      'losses', h2h.losses,
      'goalDiff', h2h.goal_diff,
      'matchesPlayed', h2h.matches_played,
      'note', case when h2h.has_history then null else 'primeiro confronto' end
    )),
    'mbjSeasonStats', mbj_stats
  );

  recipients := array(
    select distinct a.user_id
    from public.athletes a
    join public.profiles p on p.id = a.user_id and p.account_status = 'ACTIVE'
    join public.user_roles ur on ur.user_id = a.user_id and ur.role = 'ATHLETE'
    where a.status <> 'INACTIVE'
  );

  event_uuid := private.enqueue_notification(
    'PRE_MATCH_HIGHLIGHTS'::public.notification_kind, 'match', match_uuid,
    dedup_key, payload, recipients
  );

  return jsonb_build_object('enqueued', true, 'eventId', event_uuid, 'matchId', match_uuid, 'payload', payload);
end;
$$;

revoke all on function private.generate_pre_match_highlights(uuid) from public, anon, authenticated;
grant execute on function private.generate_pre_match_highlights(uuid) to service_role;

-- Hook na rotina de lembrete existente do MVP -------------------------------------
-- `create or replace` de `private.generate_attendance_reminders`: corpo idêntico
-- ao de 20260825002400, MAIS um laço guardado ao final que dispara os destaques
-- de pré-jogo ~24 h antes do apito. O contador de retorno NÃO muda (só conta
-- lembretes de presença); uma falha nos destaques nunca interrompe a rotina.
create or replace function private.generate_attendance_reminders(scan_at timestamptz default statement_timestamp())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate record;
  reminder_kind public.notification_kind;
  reminder_hours integer;
  target_at timestamptz;
  generated_count integer := 0;
  event_before_count bigint;
  event_after_count bigint;
  upcoming record;
begin
  if scan_at is null then
    raise exception using errcode = '22023', message = 'scan instant is required';
  end if;

  for candidate in
    select
      mp.id as presence_id,
      mp.call_revision,
      mp.called_at,
      m.id as match_id,
      m.schedule_revision,
      case when mp.is_exceptional_call then mp.individual_deadline else m.confirmation_deadline end as applicable_deadline,
      a.user_id
    from public.match_presences mp
    join public.matches m on m.id = mp.match_id
    join public.athletes a on a.id = mp.athlete_id
    join public.profiles p on p.id = a.user_id and p.account_status = 'ACTIVE'
    join public.user_roles ur on ur.user_id = a.user_id and ur.role = 'ATHLETE'
    where m.status = 'SCHEDULED'
      and m.current_consolidation_id is null
      and mp.call_status = 'CALLED'
      and mp.presence_status = 'PENDING'
      and mp.called_at is not null
      and mp.call_revision > 0
      and (case when mp.is_exceptional_call then mp.individual_deadline else m.confirmation_deadline end) is not null
  loop
    foreach reminder_hours in array array[24, 6]
    loop
      reminder_kind := case when reminder_hours = 24 then 'DEADLINE_24H'::public.notification_kind else 'DEADLINE_6H'::public.notification_kind end;
      target_at := candidate.applicable_deadline - make_interval(hours => reminder_hours);

      if candidate.called_at <= target_at
        and scan_at >= target_at
        and scan_at < target_at + interval '10 minutes' then
        select count(*) into event_before_count from public.notification_events;
        perform private.enqueue_notification(
          reminder_kind,
          'match_presence',
          candidate.presence_id,
          'presence:' || candidate.presence_id::text
            || ':schedule:' || candidate.schedule_revision::text
            || ':call:' || candidate.call_revision::text
            || case when reminder_hours = 24 then ':deadline-24h' else ':deadline-6h' end,
          jsonb_build_object(
            'title', case when reminder_hours = 24 then 'Confirme sua presença' else 'Prazo de presença próximo' end,
            'body', case when reminder_hours = 24 then 'Falta aproximadamente um dia para o prazo.' else 'Faltam aproximadamente seis horas para o prazo.' end,
            'route', '/app/matches/' || candidate.match_id::text,
            'matchId', candidate.match_id
          ),
          array[candidate.user_id]
        );
        select count(*) into event_after_count from public.notification_events;
        if event_after_count > event_before_count then generated_count := generated_count + 1; end if;
      end if;
    end loop;
  end loop;

  -- US4: destaques de pré-jogo ~24 h antes do apito inicial. Mesma janela de 10
  -- min da rotina; `generate_pre_match_highlights` é idempotente por partida.
  for upcoming in
    select m.id
    from public.matches m
    where m.status = 'SCHEDULED'
      and m.current_consolidation_id is null
      and m.match_date is not null
      and scan_at >= m.match_date - interval '24 hours'
      and scan_at < m.match_date - interval '24 hours' + interval '10 minutes'
  loop
    begin
      perform private.generate_pre_match_highlights(upcoming.id);
    exception when others then
      null;
    end;
  end loop;

  return generated_count;
end;
$$;

revoke all on function private.generate_attendance_reminders(timestamptz) from public, anon, authenticated;
grant execute on function private.generate_attendance_reminders(timestamptz) to service_role;

-- Agendamento interno. 08:00 America/Sao_Paulo = 11:00 UTC.
select cron.schedule(
  'mbj-generate-weekly-highlights',
  '0 11 * * 1',
  $$select private.generate_weekly_highlights(statement_timestamp())$$
);
