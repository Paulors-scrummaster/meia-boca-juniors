-- Feature 003 · US3 (Súmula Live) · T062
-- `finalize_sumula`: consolida a súmula ao vivo numa única transação. A
-- consolidação **é** a escrita — não há cópia posterior — então não pode haver
-- divergência entre o que a comissão revisou e a estatística final (SC-004).
--
-- Reusa `private.write_consolidation` (extraída de `consolidate_match` na B4):
-- cria a revisão `match_consolidations` + `match_goals`, abre a votação de MVP,
-- marca a partida `COMPLETED` e enfileira a notificação. Depois grava
-- `match_cards` / `match_substitutions` / `match_goalkeeper_assignments` derivados
-- dos `live_match_events` não desfeitos, roda `private.evaluate_trophies` (stub
-- até a US4) e fecha o setup em `FINALIZED`.
--
-- Ver `data-model.md` §"Fluxo transacional finalize_sumula" e
-- `contracts/live-match.md` §finalize_sumula.

create or replace function public.finalize_sumula(
  match_id uuid,
  reviewed_payload jsonb,
  idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  payload jsonb := coalesce(reviewed_payload, '{}'::jsonb);
  pending_raw jsonb;
  match_record public.matches%rowtype;
  setup_record public.live_match_setups%rowtype;
  lineup_record public.lineups%rowtype;
  goals_input jsonb;
  mbj_score integer;
  opponent_score integer;
  wc_result jsonb;
  consolidation_uuid uuid;
  current_keeper uuid;
  current_from smallint;
  sub_row record;
  affected_athletes uuid[];
  result_value jsonb;
begin
  perform private.require_staff_aal2();

  if finalize_sumula.idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select cr.result into cached_result
  from private.command_results cr
  where cr.command_name = 'finalize_sumula'
    and cr.actor_user_id = auth.uid()
    and cr.idempotency_key = finalize_sumula.idempotency_key;
  if found then
    return cached_result;
  end if;

  -- A UI só habilita o botão com a fila IndexedDB vazia; o servidor também recusa
  -- se o payload declarar pendências (FR-037b).
  pending_raw := payload -> 'pendingOfflineEvents';
  if pending_raw is not null and (
    (jsonb_typeof(pending_raw) = 'number' and (pending_raw::text)::numeric > 0)
    or (jsonb_typeof(pending_raw) = 'boolean' and (pending_raw::text)::boolean)
  ) then
    raise exception using errcode = 'P0001', message = 'PENDING_OFFLINE_EVENTS';
  end if;

  select * into match_record from public.matches m
  where m.id = finalize_sumula.match_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select * into setup_record from public.live_match_setups s
  where s.match_id = finalize_sumula.match_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'LIVE_NOT_ENABLED';
  end if;
  if setup_record.status <> 'IN_REVIEW' then
    raise exception using errcode = 'P0001', message = 'SUMULA_NOT_IN_REVIEW';
  end if;
  if match_record.current_consolidation_id is not null then
    raise exception using errcode = 'P0001', message = 'MATCH_LOCKED';
  end if;

  select * into lineup_record from public.lineups l
  where l.match_id = finalize_sumula.match_id and l.status = 'PUBLISHED'
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'PUBLISHED_LINEUP_REQUIRED';
  end if;

  -- Todo autor de cartão / substituição precisa estar no lineup consolidado (SC-004).
  if exists (
    select 1 from public.live_match_events e
    where e.match_id = finalize_sumula.match_id and not e.undone
      and e.event_type in ('YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION')
      and (
        not exists (
          select 1 from public.lineup_players lp
          where lp.lineup_id = lineup_record.id and lp.athlete_id = e.athlete_id
        )
        or (e.target_athlete_id is not null and not exists (
          select 1 from public.lineup_players lp
          where lp.lineup_id = lineup_record.id and lp.athlete_id = e.target_athlete_id
        ))
      )
  ) then
    raise exception using errcode = '22023', message = 'ATHLETE_NOT_IN_CONSOLIDATED_LINEUP';
  end if;

  -- Placar e gols derivados só de eventos GOAL não desfeitos.
  with mbj_goals as (
    select e.athlete_id, e.target_athlete_id,
           row_number() over (order by e.minute, e.recorded_at, e.id) as seq
    from public.live_match_events e
    where e.match_id = finalize_sumula.match_id and not e.undone
      and e.event_type = 'GOAL' and e.team_side = 'MBJ'
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'sequence', seq,
             'scorerAthleteId', athlete_id,
             'assistantAthleteId', target_athlete_id,
             'isOpponentOwnGoal', false
           ) order by seq
         ), '[]'::jsonb)
  into goals_input
  from mbj_goals;

  mbj_score := jsonb_array_length(goals_input);
  select count(*)::integer into opponent_score
  from public.live_match_events e
  where e.match_id = finalize_sumula.match_id and not e.undone
    and e.event_type = 'GOAL' and e.team_side = 'OPPONENT';

  -- A consolidação é a escrita (mesma rotina de `consolidate_match`).
  wc_result := private.write_consolidation(
    match_record, lineup_record, mbj_score, opponent_score, goals_input,
    finalize_sumula.idempotency_key, auth.uid()
  );
  consolidation_uuid := (wc_result ->> 'consolidationId')::uuid;

  -- Cartões.
  insert into public.match_cards (consolidation_id, athlete_id, card_type, minute)
  select consolidation_uuid, e.athlete_id,
         case e.event_type when 'YELLOW_CARD' then 'YELLOW'::public.card_type
                           else 'RED'::public.card_type end,
         e.minute
  from public.live_match_events e
  where e.match_id = finalize_sumula.match_id and not e.undone
    and e.event_type in ('YELLOW_CARD', 'RED_CARD');

  -- Substituições (no evento: `athlete_id` = quem entra, `target_athlete_id` = quem sai).
  insert into public.match_substitutions (consolidation_id, out_athlete_id, in_athlete_id, minute)
  select consolidation_uuid, e.target_athlete_id, e.athlete_id, e.minute
  from public.live_match_events e
  where e.match_id = finalize_sumula.match_id and not e.undone
    and e.event_type = 'SUBSTITUTION';

  -- Linha do tempo do goleiro: começa no titular do setup; cada substituição que
  -- tira o goleiro corrente fecha a janela e abre a próxima (R3 / Muralha).
  current_keeper := setup_record.starting_goalkeeper_athlete_id;
  current_from := 0;
  for sub_row in
    select e.athlete_id as in_athlete, e.target_athlete_id as out_athlete, e.minute
    from public.live_match_events e
    where e.match_id = finalize_sumula.match_id and not e.undone
      and e.event_type = 'SUBSTITUTION'
    order by e.minute, e.recorded_at, e.id
  loop
    if sub_row.out_athlete = current_keeper then
      insert into public.match_goalkeeper_assignments (consolidation_id, athlete_id, from_minute, to_minute)
      values (consolidation_uuid, current_keeper, current_from, sub_row.minute);
      current_keeper := sub_row.in_athlete;
      current_from := sub_row.minute;
    end if;
  end loop;
  insert into public.match_goalkeeper_assignments (consolidation_id, athlete_id, from_minute, to_minute)
  values (consolidation_uuid, current_keeper, current_from, null);

  -- Troféus (stub no-op até a US4 — T082).
  select array_agg(distinct a) into affected_athletes
  from (
    select scorer_athlete_id a from public.match_goals where consolidation_id = consolidation_uuid and scorer_athlete_id is not null
    union select assistant_athlete_id from public.match_goals where consolidation_id = consolidation_uuid and assistant_athlete_id is not null
    union select athlete_id from public.match_cards where consolidation_id = consolidation_uuid
    union select out_athlete_id from public.match_substitutions where consolidation_id = consolidation_uuid
    union select in_athlete_id from public.match_substitutions where consolidation_id = consolidation_uuid
    union select athlete_id from public.match_goalkeeper_assignments where consolidation_id = consolidation_uuid
  ) s;
  perform private.evaluate_trophies(match_record.season_id, coalesce(affected_athletes, array[]::uuid[]));

  update public.live_match_setups s
  set status = 'FINALIZED', updated_at = statement_timestamp()
  where s.match_id = finalize_sumula.match_id;

  perform private.append_audit_log(
    'SUMULA_FINALIZED', 'match', finalize_sumula.match_id,
    null,
    jsonb_build_object(
      'consolidationId', consolidation_uuid,
      'revision', (wc_result ->> 'revision')::integer,
      'mbjScore', mbj_score,
      'opponentScore', opponent_score
    ),
    finalize_sumula.idempotency_key
  );

  result_value := jsonb_build_object(
    'matchId', finalize_sumula.match_id,
    'consolidationId', consolidation_uuid,
    'revision', (wc_result ->> 'revision')::integer,
    'mbjScore', mbj_score,
    'opponentScore', opponent_score,
    'trophiesAwarded', '[]'::jsonb
  );
  insert into private.command_results
  values ('finalize_sumula', auth.uid(), finalize_sumula.idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function public.finalize_sumula(uuid, jsonb, uuid) from public, anon;
grant execute on function public.finalize_sumula(uuid, jsonb, uuid) to authenticated;
