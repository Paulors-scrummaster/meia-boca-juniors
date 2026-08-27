create or replace function public.create_exceptional_call(
  match_uuid uuid,
  athlete_uuid uuid,
  individual_deadline_input timestamptz,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  match_record public.matches%rowtype;
  athlete_record public.athletes%rowtype;
  presence_record public.match_presences%rowtype;
  result_value jsonb;
begin
  perform private.require_staff_aal2();
  select result into cached_result from private.command_results
  where command_name = 'create_exceptional_call' and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  select * into match_record from public.matches where id = match_uuid for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if match_record.status <> 'SCHEDULED' or match_record.current_consolidation_id is not null
    or statement_timestamp() < match_record.confirmation_deadline
    or statement_timestamp() >= match_record.match_date then
    raise exception using errcode = 'P0001', message = 'MATCH_LOCKED';
  end if;
  if individual_deadline_input <= statement_timestamp()
    or individual_deadline_input > match_record.match_date then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select * into athlete_record from public.athletes where id = athlete_uuid for share;
  if not found or athlete_record.status = 'INACTIVE' or athlete_record.user_id is null
    or not exists (
      select 1 from public.profiles p join public.user_roles ur on ur.user_id = p.id
      where p.id = athlete_record.user_id and p.account_status = 'ACTIVE' and ur.role = 'ATHLETE'
    ) then
    raise exception using errcode = 'P0001', message = 'ATHLETE_INELIGIBLE';
  end if;

  insert into public.match_presences (
    match_id, athlete_id, call_status, presence_status, called_at, call_revision,
    is_exceptional_call, individual_deadline, last_changed_by
  ) values (
    match_uuid, athlete_uuid, 'CALLED', 'PENDING', statement_timestamp(), 1,
    true, individual_deadline_input, auth.uid()
  )
  on conflict (match_id, athlete_id) do update
  set call_status = 'CALLED',
      presence_status = 'PENDING',
      called_at = statement_timestamp(),
      call_revision = public.match_presences.call_revision + 1,
      is_exceptional_call = true,
      individual_deadline = excluded.individual_deadline,
      responded_at = null,
      last_changed_by = auth.uid(),
      updated_at = statement_timestamp()
  returning * into presence_record;

  delete from public.presence_justifications where presence_id = presence_record.id;
  perform private.enqueue_notification(
    'CALL_UP', 'match', match_uuid,
    'match:' || match_uuid::text || ':schedule:' || match_record.schedule_revision::text
      || ':call:' || presence_record.call_revision::text || ':call-up:' || athlete_uuid::text,
    jsonb_build_object('title', 'Convocação excepcional', 'body', 'Você recebeu uma convocação com prazo individual.', 'route', '/app/matches/' || match_uuid::text),
    array[athlete_record.user_id]
  );
  perform private.append_audit_log(
    'EXCEPTIONAL_CALL_CREATED', 'match_presence', presence_record.id, null,
    jsonb_build_object('athleteId', athlete_uuid, 'callRevision', presence_record.call_revision),
    command_idempotency_key
  );
  result_value := to_jsonb(presence_record);
  insert into private.command_results values ('create_exceptional_call', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function public.create_exceptional_call(uuid, uuid, timestamptz, uuid) from public, anon;
grant execute on function public.create_exceptional_call(uuid, uuid, timestamptz, uuid) to authenticated;
