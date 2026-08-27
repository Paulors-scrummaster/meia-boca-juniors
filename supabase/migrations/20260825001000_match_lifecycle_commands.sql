create or replace function public.reschedule_match(
  match_uuid uuid,
  match_date_input timestamptz,
  confirmation_deadline_input timestamptz,
  opponent_name_input text,
  competition_name_input text,
  location_name_input text,
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
  date_changed boolean;
  reset_count integer := 0;
  event_uuid uuid;
  result_value jsonb;
begin
  perform private.require_staff_aal2();

  select result into cached_result
  from private.command_results
  where command_name = 'reschedule_match'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  select * into match_record from public.matches where id = match_uuid for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if match_record.current_consolidation_id is not null then
    raise exception using errcode = 'P0001', message = 'MATCH_LOCKED';
  end if;
  if confirmation_deadline_input >= match_date_input then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  date_changed := match_record.match_date is distinct from match_date_input;

  update public.matches
  set opponent_name = regexp_replace(btrim(opponent_name_input), '[[:space:]]+', ' ', 'g'),
      competition_name = nullif(regexp_replace(btrim(coalesce(competition_name_input, '')), '[[:space:]]+', ' ', 'g'), ''),
      location_name = nullif(regexp_replace(btrim(coalesce(location_name_input, '')), '[[:space:]]+', ' ', 'g'), ''),
      match_date = match_date_input,
      confirmation_deadline = confirmation_deadline_input,
      schedule_revision = schedule_revision + case when date_changed then 1 else 0 end,
      updated_by = auth.uid(),
      updated_at = statement_timestamp()
  where id = match_uuid
  returning * into match_record;

  if date_changed then
    update public.match_presences
    set presence_status = 'PENDING',
        responded_at = null,
        is_exceptional_call = case
          when is_exceptional_call and individual_deadline <= match_date_input
            and individual_deadline > statement_timestamp() then true
          else false
        end,
        individual_deadline = case
          when is_exceptional_call and individual_deadline <= match_date_input
            and individual_deadline > statement_timestamp() then individual_deadline
          else null
        end,
        last_changed_by = auth.uid(),
        updated_at = statement_timestamp()
    where match_id = match_uuid and call_status = 'CALLED';
    get diagnostics reset_count = row_count;

    delete from public.presence_justifications pj
    using public.match_presences mp
    where pj.presence_id = mp.id and mp.match_id = match_uuid;

    event_uuid := private.enqueue_notification(
      'MATCH_CHANGED', 'match', match_uuid,
      'match:' || match_uuid::text || ':schedule:' || match_record.schedule_revision::text || ':changed',
      jsonb_build_object(
        'title', 'Partida alterada',
        'body', 'A partida mudou. Confirme novamente sua presença.',
        'route', '/app/matches/' || match_uuid::text
      ),
      array(
        select a.user_id
        from public.match_presences mp
        join public.athletes a on a.id = mp.athlete_id
        where mp.match_id = match_uuid and mp.call_status = 'CALLED' and a.user_id is not null
      )
    );
  end if;

  perform private.append_audit_log(
    'MATCH_RESCHEDULED', 'match', match_uuid,
    jsonb_build_object('scheduleRevision', match_record.schedule_revision - case when date_changed then 1 else 0 end),
    jsonb_build_object('scheduleRevision', match_record.schedule_revision, 'responsesReset', reset_count),
    command_idempotency_key
  );

  result_value := jsonb_build_object(
    'matchId', match_uuid,
    'scheduleRevision', match_record.schedule_revision,
    'resetCount', reset_count,
    'notificationEventId', event_uuid
  );
  insert into private.command_results values (
    'reschedule_match', auth.uid(), command_idempotency_key, result_value, statement_timestamp()
  );
  return result_value;
end;
$$;

create or replace function public.cancel_match(match_uuid uuid, command_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  match_record public.matches%rowtype;
  result_value jsonb;
begin
  perform private.require_staff_aal2();
  select result into cached_result from private.command_results
  where command_name = 'cancel_match' and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  select * into match_record from public.matches where id = match_uuid for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if match_record.current_consolidation_id is not null or match_record.status = 'COMPLETED' then
    raise exception using errcode = 'P0001', message = 'MATCH_LOCKED';
  end if;
  update public.matches set status = 'CANCELLED', updated_by = auth.uid(), updated_at = statement_timestamp()
  where id = match_uuid returning * into match_record;

  perform private.enqueue_notification(
    'MATCH_CHANGED', 'match', match_uuid,
    'match:' || match_uuid::text || ':schedule:' || match_record.schedule_revision::text || ':cancelled',
    jsonb_build_object('title', 'Partida cancelada', 'body', 'A partida foi cancelada.', 'route', '/app/matches/' || match_uuid::text),
    array(select a.user_id from public.match_presences mp join public.athletes a on a.id = mp.athlete_id where mp.match_id = match_uuid and mp.call_status = 'CALLED' and a.user_id is not null)
  );
  perform private.append_audit_log('MATCH_CANCELLED', 'match', match_uuid, null, jsonb_build_object('status', 'CANCELLED'), command_idempotency_key);
  result_value := to_jsonb(match_record);
  insert into private.command_results values ('cancel_match', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

create or replace function public.reactivate_match(match_uuid uuid, command_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  match_record public.matches%rowtype;
  result_value jsonb;
begin
  perform private.require_staff_aal2();
  select result into cached_result from private.command_results
  where command_name = 'reactivate_match' and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  select * into match_record from public.matches where id = match_uuid for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if match_record.status <> 'CANCELLED' or match_record.match_date <= statement_timestamp() then
    raise exception using errcode = 'P0001', message = 'MATCH_LOCKED';
  end if;
  update public.matches set status = 'SCHEDULED', updated_by = auth.uid(), updated_at = statement_timestamp()
  where id = match_uuid returning * into match_record;

  perform private.enqueue_notification(
    'MATCH_CHANGED', 'match', match_uuid,
    'match:' || match_uuid::text || ':schedule:' || match_record.schedule_revision::text || ':reactivated',
    jsonb_build_object('title', 'Partida reativada', 'body', 'A partida foi reativada.', 'route', '/app/matches/' || match_uuid::text),
    array(select a.user_id from public.match_presences mp join public.athletes a on a.id = mp.athlete_id where mp.match_id = match_uuid and mp.call_status = 'CALLED' and a.user_id is not null)
  );
  perform private.append_audit_log('MATCH_REACTIVATED', 'match', match_uuid, null, jsonb_build_object('status', 'SCHEDULED'), command_idempotency_key);
  result_value := to_jsonb(match_record);
  insert into private.command_results values ('reactivate_match', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function public.reschedule_match(uuid, timestamptz, timestamptz, text, text, text, uuid) from public, anon;
revoke all on function public.cancel_match(uuid, uuid) from public, anon;
revoke all on function public.reactivate_match(uuid, uuid) from public, anon;
grant execute on function public.reschedule_match(uuid, timestamptz, timestamptz, text, text, text, uuid) to authenticated;
grant execute on function public.cancel_match(uuid, uuid) to authenticated;
grant execute on function public.reactivate_match(uuid, uuid) to authenticated;
