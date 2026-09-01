create or replace function public.set_match_callups(
  match_uuid uuid,
  called_athlete_ids uuid[],
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
  athlete_uuid uuid;
  athlete_user_id uuid;
  presence_record public.match_presences%rowtype;
  newly_called_count integer := 0;
  removed_count integer := 0;
  result_value jsonb;
begin
  perform private.require_staff_aal2();
  called_athlete_ids := coalesce(called_athlete_ids, '{}'::uuid[]);

  select result into cached_result from private.command_results
  where command_name = 'set_match_callups' and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  if cardinality(called_athlete_ids) <> (select count(distinct value) from unnest(called_athlete_ids) value) then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select * into match_record from public.matches where id = match_uuid for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if match_record.status <> 'SCHEDULED' or match_record.current_consolidation_id is not null then
    raise exception using errcode = 'P0001', message = 'MATCH_LOCKED';
  end if;

  if exists (
    select 1
    from unnest(called_athlete_ids) requested(athlete_id)
    left join public.athletes a on a.id = requested.athlete_id
    left join public.profiles p on p.id = a.user_id and p.account_status = 'ACTIVE'
    left join public.user_roles ur on ur.user_id = a.user_id and ur.role = 'ATHLETE'
    where a.id is null or a.status = 'INACTIVE' or a.anonymized_at is not null
      or a.user_id is null or p.id is null or ur.user_id is null
  ) then
    raise exception using errcode = 'P0001', message = 'ATHLETE_INELIGIBLE';
  end if;

  update public.match_presences
  set call_status = 'NOT_CALLED', presence_status = 'PENDING', responded_at = null,
      is_exceptional_call = false, individual_deadline = null,
      last_changed_by = auth.uid(), updated_at = statement_timestamp()
  where match_id = match_uuid and call_status = 'CALLED'
    and not (athlete_id = any(called_athlete_ids));
  get diagnostics removed_count = row_count;

  delete from public.presence_justifications pj
  using public.match_presences mp
  where pj.presence_id = mp.id and mp.match_id = match_uuid and mp.call_status = 'NOT_CALLED';

  foreach athlete_uuid in array called_athlete_ids loop
    select * into presence_record
    from public.match_presences
    where match_id = match_uuid and athlete_id = athlete_uuid
    for update;

    if not found then
      insert into public.match_presences (
        match_id, athlete_id, call_status, presence_status, called_at, call_revision, last_changed_by
      ) values (
        match_uuid, athlete_uuid, 'CALLED', 'PENDING', statement_timestamp(), 1, auth.uid()
      ) returning * into presence_record;
      newly_called_count := newly_called_count + 1;
    elsif presence_record.call_status = 'NOT_CALLED' then
      update public.match_presences
      set call_status = 'CALLED', presence_status = 'PENDING', called_at = statement_timestamp(),
          call_revision = call_revision + 1, is_exceptional_call = false,
          individual_deadline = null, responded_at = null, last_changed_by = auth.uid(),
          updated_at = statement_timestamp()
      where id = presence_record.id returning * into presence_record;
      newly_called_count := newly_called_count + 1;
    else
      continue;
    end if;

    select user_id into athlete_user_id from public.athletes where id = athlete_uuid;
    perform private.enqueue_notification(
      'CALL_UP', 'match', match_uuid,
      'match:' || match_uuid::text || ':schedule:' || match_record.schedule_revision::text
        || ':call:' || presence_record.call_revision::text || ':call-up:' || athlete_uuid::text,
      jsonb_build_object('title', 'Nova convocação', 'body', 'Você foi convocado para a próxima partida.', 'route', '/app/matches/' || match_uuid::text),
      array[athlete_user_id]
    );
  end loop;

  perform private.append_audit_log(
    'MATCH_CALLUPS_SET', 'match', match_uuid, null,
    jsonb_build_object('calledAthleteIds', to_jsonb(called_athlete_ids), 'newCalls', newly_called_count, 'removedCalls', removed_count),
    command_idempotency_key
  );

  result_value := jsonb_build_object(
    'matchId', match_uuid,
    'calledAthleteIds', to_jsonb(called_athlete_ids),
    'newCallCount', newly_called_count,
    'removedCallCount', removed_count
  );
  insert into private.command_results values ('set_match_callups', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function public.set_match_callups(uuid, uuid[], uuid) from public, anon;
grant execute on function public.set_match_callups(uuid, uuid[], uuid) to authenticated;
