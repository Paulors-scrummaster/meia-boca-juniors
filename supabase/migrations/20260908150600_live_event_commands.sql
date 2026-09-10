-- Feature 003 · US3 (Súmula Live) · T061
-- Comandos de evento do cronômetro: log / undo / amend / end / cancel.
-- Escrita só por estas RPCs (`live_match_events` tem `insert`/`update` revogados
-- de `authenticated`). Ver `contracts/live-match.md`.
--
-- Autorização de log/undo/amend: o Registrador designado enquanto o setup está na
-- fase esperada, OU COACH/PRESIDENT. A autorização do Registrador some quando o
-- status muda (SC-013) ou quando `assign_field_recorder` regrava o Registrador.

create or replace function private.authorize_live_actor(
  target_match_id uuid,
  required_status public.live_sumula_status
)
returns public.live_match_setups
language plpgsql
security definer
set search_path = ''
as $$
declare
  setup_record public.live_match_setups%rowtype;
begin
  if auth.uid() is null or not private.current_user_is_active() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select * into setup_record from public.live_match_setups s
  where s.match_id = target_match_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'LIVE_NOT_ENABLED';
  end if;

  if setup_record.status <> required_status then
    if required_status = 'IN_REVIEW' then
      raise exception using errcode = 'P0001', message = 'SUMULA_NOT_IN_REVIEW';
    end if;
    -- fora da fase RECORDING a autorização do Registrador já expirou
    raise exception using errcode = 'P0001', message = 'RECORDER_ONLY';
  end if;

  if private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
    or setup_record.recorder_user_id = auth.uid() then
    return setup_record;
  end if;

  raise exception using errcode = 'P0001', message = 'RECORDER_ONLY';
end;
$$;

create or replace function public.log_live_event(
  match_id uuid,
  client_event_id uuid,
  minute integer,
  event_type text,
  athlete_id uuid,
  target_athlete_id uuid,
  team_side text,
  idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_record public.live_match_events%rowtype;
  was_deduped boolean := false;
begin
  perform private.authorize_live_actor(log_live_event.match_id, 'RECORDING'::public.live_sumula_status);

  if log_live_event.client_event_id is null or log_live_event.idempotency_key is null
    or log_live_event.athlete_id is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;
  if log_live_event.event_type not in ('GOAL', 'ASSIST', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION')
    or coalesce(log_live_event.team_side, 'MBJ') not in ('MBJ', 'OPPONENT')
    or log_live_event.minute is null or log_live_event.minute not between 0 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;
  if log_live_event.event_type = 'SUBSTITUTION' and log_live_event.target_athlete_id is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;
  if log_live_event.target_athlete_id is not null
    and log_live_event.target_athlete_id = log_live_event.athlete_id then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  -- Dedupe da sincronização offline: o `client_event_id` é gerado no clique e o
  -- reenvio cai em `on conflict do nothing` (FR-037a).
  insert into public.live_match_events (
    match_id, client_event_id, minute, event_type, athlete_id, target_athlete_id,
    team_side, recorded_by, recorded_at
  ) values (
    log_live_event.match_id, log_live_event.client_event_id, log_live_event.minute::smallint,
    log_live_event.event_type::public.live_event_type, log_live_event.athlete_id,
    log_live_event.target_athlete_id, coalesce(log_live_event.team_side, 'MBJ')::public.team_side,
    auth.uid(), statement_timestamp()
  )
  on conflict on constraint live_match_events_client_event_id_key do nothing
  returning * into event_record;

  if not found then
    was_deduped := true;
    select * into event_record from public.live_match_events e
    where e.client_event_id = log_live_event.client_event_id;
  end if;

  return jsonb_build_object(
    'eventId', event_record.id,
    'clientEventId', event_record.client_event_id,
    'deduped', was_deduped,
    'minute', event_record.minute,
    'eventType', event_record.event_type::text
  );
end;
$$;

create or replace function public.undo_live_event(
  match_id uuid,
  idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  target_event public.live_match_events%rowtype;
  result_value jsonb;
begin
  perform private.authorize_live_actor(undo_live_event.match_id, 'RECORDING'::public.live_sumula_status);

  if undo_live_event.idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select cr.result into cached_result
  from private.command_results cr
  where cr.command_name = 'undo_live_event'
    and cr.actor_user_id = auth.uid()
    and cr.idempotency_key = undo_live_event.idempotency_key;
  if found then
    return cached_result;
  end if;

  -- Evento mais recente ainda não desfeito dentro da janela de 30 s (FR-030, E-01, SC-005).
  select * into target_event from public.live_match_events e
  where e.match_id = undo_live_event.match_id
    and e.undone = false
    and e.recorded_at >= statement_timestamp() - interval '30 seconds'
  order by e.recorded_at desc, e.id desc
  limit 1
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'UNDO_WINDOW_EXPIRED';
  end if;

  update public.live_match_events e
  set undone = true, undone_at = statement_timestamp()
  where e.id = target_event.id;

  result_value := jsonb_build_object(
    'eventId', target_event.id,
    'clientEventId', target_event.client_event_id,
    'minute', target_event.minute,
    'eventType', target_event.event_type::text,
    'undone', true
  );
  insert into private.command_results
  values ('undo_live_event', auth.uid(), undo_live_event.idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

create or replace function public.amend_live_event(
  event_id uuid,
  patch jsonb,
  idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  event_record public.live_match_events%rowtype;
  new_minute smallint;
  new_athlete uuid;
  new_target uuid;
  result_value jsonb;
begin
  if amend_live_event.idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select cr.result into cached_result
  from private.command_results cr
  where cr.command_name = 'amend_live_event'
    and cr.actor_user_id = auth.uid()
    and cr.idempotency_key = amend_live_event.idempotency_key;
  if found then
    return cached_result;
  end if;

  select * into event_record from public.live_match_events e
  where e.id = amend_live_event.event_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  -- Só na revisão pós-jogo, e só Registrador ou comissão (FR-033).
  perform private.authorize_live_actor(event_record.match_id, 'IN_REVIEW'::public.live_sumula_status);

  if amend_live_event.patch is null or jsonb_typeof(amend_live_event.patch) <> 'object' then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  new_minute := coalesce((amend_live_event.patch ->> 'minute')::smallint, event_record.minute);
  new_athlete := coalesce(nullif(amend_live_event.patch ->> 'athlete_id', '')::uuid, event_record.athlete_id);
  if amend_live_event.patch ? 'target_athlete_id' then
    new_target := nullif(amend_live_event.patch ->> 'target_athlete_id', '')::uuid;
  else
    new_target := event_record.target_athlete_id;
  end if;

  if new_minute not between 0 and 200 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;
  if new_target is not null and new_target = new_athlete then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;
  if event_record.event_type = 'SUBSTITUTION' and new_target is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  update public.live_match_events e
  set minute = new_minute,
      athlete_id = new_athlete,
      target_athlete_id = new_target
  where e.id = amend_live_event.event_id;

  result_value := jsonb_build_object(
    'eventId', amend_live_event.event_id,
    'minute', new_minute,
    'athleteId', new_athlete,
    'targetAthleteId', new_target
  );
  insert into private.command_results
  values ('amend_live_event', auth.uid(), amend_live_event.idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

create or replace function public.end_live_recording(
  match_id uuid,
  idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  setup_record public.live_match_setups%rowtype;
  result_value jsonb;
begin
  if end_live_recording.idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select cr.result into cached_result
  from private.command_results cr
  where cr.command_name = 'end_live_recording'
    and cr.actor_user_id = auth.uid()
    and cr.idempotency_key = end_live_recording.idempotency_key;
  if found then
    return cached_result;
  end if;

  if auth.uid() is null or not private.current_user_is_active() then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  select * into setup_record from public.live_match_setups s
  where s.match_id = end_live_recording.match_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'LIVE_NOT_ENABLED';
  end if;
  if setup_record.status <> 'RECORDING' then
    raise exception using errcode = 'P0001', message = 'CONFLICT';
  end if;
  if not (
    private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
    or setup_record.recorder_user_id = auth.uid()
  ) then
    raise exception using errcode = 'P0001', message = 'RECORDER_ONLY';
  end if;

  update public.live_match_setups s
  set status = 'IN_REVIEW', updated_at = statement_timestamp()
  where s.match_id = end_live_recording.match_id;

  perform private.append_audit_log(
    'LIVE_RECORDING_ENDED', 'match', end_live_recording.match_id,
    jsonb_build_object('status', 'RECORDING'),
    jsonb_build_object('status', 'IN_REVIEW'),
    end_live_recording.idempotency_key
  );

  result_value := jsonb_build_object(
    'matchId', end_live_recording.match_id,
    'status', 'IN_REVIEW'
  );
  insert into private.command_results
  values ('end_live_recording', auth.uid(), end_live_recording.idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

create or replace function public.cancel_live_recording(
  match_id uuid,
  reason text,
  idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  setup_record public.live_match_setups%rowtype;
  result_value jsonb;
begin
  perform private.require_staff_aal2();

  if cancel_live_recording.idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select cr.result into cached_result
  from private.command_results cr
  where cr.command_name = 'cancel_live_recording'
    and cr.actor_user_id = auth.uid()
    and cr.idempotency_key = cancel_live_recording.idempotency_key;
  if found then
    return cached_result;
  end if;

  select * into setup_record from public.live_match_setups s
  where s.match_id = cancel_live_recording.match_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'LIVE_NOT_ENABLED';
  end if;
  if setup_record.status in ('FINALIZED', 'CANCELLED') then
    raise exception using errcode = 'P0001', message = 'CONFLICT';
  end if;

  update public.live_match_setups s
  set status = 'CANCELLED', updated_at = statement_timestamp()
  where s.match_id = cancel_live_recording.match_id;

  perform private.append_audit_log(
    'LIVE_RECORDING_CANCELLED', 'match', cancel_live_recording.match_id,
    jsonb_build_object('status', setup_record.status::text),
    jsonb_build_object(
      'status', 'CANCELLED',
      'reason', nullif(btrim(coalesce(cancel_live_recording.reason, '')), '')
    ),
    cancel_live_recording.idempotency_key
  );

  result_value := jsonb_build_object(
    'matchId', cancel_live_recording.match_id,
    'status', 'CANCELLED'
  );
  insert into private.command_results
  values ('cancel_live_recording', auth.uid(), cancel_live_recording.idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function private.authorize_live_actor(uuid, public.live_sumula_status) from public, anon, authenticated;
grant execute on function private.authorize_live_actor(uuid, public.live_sumula_status) to service_role;

revoke all on function public.log_live_event(uuid, uuid, integer, text, uuid, uuid, text, uuid) from public, anon;
revoke all on function public.undo_live_event(uuid, uuid) from public, anon;
revoke all on function public.amend_live_event(uuid, jsonb, uuid) from public, anon;
revoke all on function public.end_live_recording(uuid, uuid) from public, anon;
revoke all on function public.cancel_live_recording(uuid, text, uuid) from public, anon;
grant execute on function public.log_live_event(uuid, uuid, integer, text, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.undo_live_event(uuid, uuid) to authenticated;
grant execute on function public.amend_live_event(uuid, jsonb, uuid) to authenticated;
grant execute on function public.end_live_recording(uuid, uuid) to authenticated;
grant execute on function public.cancel_live_recording(uuid, text, uuid) to authenticated;
