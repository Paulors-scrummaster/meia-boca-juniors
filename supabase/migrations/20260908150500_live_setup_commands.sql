-- Feature 003 · US3 (Súmula Live) · T060
-- Comandos de setup do registro ao vivo (pré-jogo). Só COACH/PRESIDENT + AAL2
-- habilitam o ao vivo e designam o Registrador de Campo; o Registrador em si pode
-- ser qualquer conta ativa (FR-028). Idempotência via `private.command_results` e
-- auditoria via `private.append_audit_log`, no mesmo padrão do MVP.
--
-- Convenção de parâmetros das RPCs de súmula: `match_id` / `idempotency_key`
-- (data-model.md §"Fluxo transacional finalize_sumula"). Colunas homônimas são
-- sempre qualificadas por alias; parâmetros, por nome da função.

create or replace function public.enable_live_recording(
  match_id uuid,
  recorder_user_id uuid,
  starting_goalkeeper_athlete_id uuid,
  idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  match_record public.matches%rowtype;
  lineup_record public.lineups%rowtype;
  result_value jsonb;
begin
  perform private.require_staff_aal2();

  if enable_live_recording.idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select cr.result into cached_result
  from private.command_results cr
  where cr.command_name = 'enable_live_recording'
    and cr.actor_user_id = auth.uid()
    and cr.idempotency_key = enable_live_recording.idempotency_key;
  if found then
    return cached_result;
  end if;

  if enable_live_recording.match_id is null
    or enable_live_recording.recorder_user_id is null
    or enable_live_recording.starting_goalkeeper_athlete_id is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = enable_live_recording.recorder_user_id and p.account_status = 'ACTIVE'
  ) then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select * into match_record from public.matches m
  where m.id = enable_live_recording.match_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if match_record.status <> 'SCHEDULED' or match_record.current_consolidation_id is not null then
    raise exception using errcode = 'P0001', message = 'MATCH_LOCKED';
  end if;

  if exists (
    select 1 from public.live_match_setups s where s.match_id = enable_live_recording.match_id
  ) then
    raise exception using errcode = 'P0001', message = 'CONFLICT';
  end if;

  select * into lineup_record from public.lineups l
  where l.match_id = enable_live_recording.match_id and l.status = 'PUBLISHED'
  for share;
  if not found then
    raise exception using errcode = 'P0001', message = 'PUBLISHED_LINEUP_REQUIRED';
  end if;

  if not exists (
    select 1 from public.lineup_players lp
    where lp.lineup_id = lineup_record.id
      and lp.athlete_id = enable_live_recording.starting_goalkeeper_athlete_id
  ) then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  insert into public.live_match_setups (
    match_id, recorder_user_id, status, starting_goalkeeper_athlete_id, enabled_by
  ) values (
    enable_live_recording.match_id,
    enable_live_recording.recorder_user_id,
    'RECORDING',
    enable_live_recording.starting_goalkeeper_athlete_id,
    auth.uid()
  );

  perform private.append_audit_log(
    'LIVE_RECORDING_ENABLED', 'match', enable_live_recording.match_id,
    null,
    jsonb_build_object(
      'recorderUserId', enable_live_recording.recorder_user_id,
      'startingGoalkeeperAthleteId', enable_live_recording.starting_goalkeeper_athlete_id
    ),
    enable_live_recording.idempotency_key
  );

  result_value := jsonb_build_object(
    'matchId', enable_live_recording.match_id,
    'recorderUserId', enable_live_recording.recorder_user_id,
    'status', 'RECORDING'
  );
  insert into private.command_results
  values ('enable_live_recording', auth.uid(), enable_live_recording.idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

create or replace function public.assign_field_recorder(
  match_id uuid,
  recorder_user_id uuid,
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
  previous_recorder uuid;
  result_value jsonb;
begin
  perform private.require_staff_aal2();

  if assign_field_recorder.idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select cr.result into cached_result
  from private.command_results cr
  where cr.command_name = 'assign_field_recorder'
    and cr.actor_user_id = auth.uid()
    and cr.idempotency_key = assign_field_recorder.idempotency_key;
  if found then
    return cached_result;
  end if;

  if assign_field_recorder.match_id is null or assign_field_recorder.recorder_user_id is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = assign_field_recorder.recorder_user_id and p.account_status = 'ACTIVE'
  ) then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select * into setup_record from public.live_match_setups s
  where s.match_id = assign_field_recorder.match_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'LIVE_NOT_ENABLED';
  end if;
  if setup_record.status <> 'RECORDING' then
    raise exception using errcode = 'P0001', message = 'CONFLICT';
  end if;

  previous_recorder := setup_record.recorder_user_id;

  update public.live_match_setups s
  set recorder_user_id = assign_field_recorder.recorder_user_id,
      updated_at = statement_timestamp()
  where s.match_id = assign_field_recorder.match_id;

  -- A autorização do Registrador anterior deixa de valer imediatamente (FR-028b, SC-013):
  -- `log_live_event` / `undo_live_event` conferem `setup.recorder_user_id = auth.uid()`.
  perform private.append_audit_log(
    'FIELD_RECORDER_ASSIGNED', 'match', assign_field_recorder.match_id,
    jsonb_build_object('recorderUserId', previous_recorder),
    jsonb_build_object('recorderUserId', assign_field_recorder.recorder_user_id),
    assign_field_recorder.idempotency_key
  );

  result_value := jsonb_build_object(
    'matchId', assign_field_recorder.match_id,
    'recorderUserId', assign_field_recorder.recorder_user_id,
    'previousRecorderUserId', previous_recorder,
    'status', setup_record.status::text
  );
  insert into private.command_results
  values ('assign_field_recorder', auth.uid(), assign_field_recorder.idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function public.enable_live_recording(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.assign_field_recorder(uuid, uuid, uuid) from public, anon;
grant execute on function public.enable_live_recording(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.assign_field_recorder(uuid, uuid, uuid) to authenticated;
