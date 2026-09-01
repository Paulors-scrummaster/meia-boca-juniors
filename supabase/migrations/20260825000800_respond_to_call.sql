create or replace function public.respond_to_call(
  match_uuid uuid,
  target_status public.presence_status,
  refusal_reason text,
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
  presence_record public.match_presences%rowtype;
  normalized_reason text;
  applicable_deadline timestamptz;
  result_value jsonb;
begin
  if not private.has_role('ATHLETE') then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if target_status not in ('CONFIRMED', 'DECLINED') then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result
  from private.command_results
  where command_name = 'respond_to_call'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  select m.* into match_record
  from public.matches m
  where m.id = match_uuid
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if match_record.status <> 'SCHEDULED' or match_record.current_consolidation_id is not null then
    raise exception using errcode = 'P0001', message = 'MATCH_LOCKED';
  end if;

  select mp.* into presence_record
  from public.match_presences mp
  join public.athletes a on a.id = mp.athlete_id
  where mp.match_id = match_uuid
    and a.user_id = auth.uid()
    and mp.call_status = 'CALLED'
  for update of mp;
  if not found then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;

  applicable_deadline := case
    when presence_record.is_exceptional_call then presence_record.individual_deadline
    else match_record.confirmation_deadline
  end;
  if applicable_deadline is null or statement_timestamp() >= applicable_deadline then
    raise exception using errcode = 'P0001', message = 'DEADLINE_CLOSED';
  end if;

  normalized_reason := regexp_replace(btrim(coalesce(refusal_reason, '')), '[[:space:]]+', ' ', 'g');
  if target_status = 'DECLINED' and char_length(normalized_reason) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  if target_status = 'DECLINED' then
    insert into public.presence_justifications (presence_id, reason, created_by)
    values (presence_record.id, normalized_reason, auth.uid())
    on conflict (presence_id) do update
      set reason = excluded.reason,
          created_by = excluded.created_by,
          updated_at = statement_timestamp();
  else
    delete from public.presence_justifications where presence_id = presence_record.id;
  end if;

  update public.match_presences
  set presence_status = target_status,
      responded_at = statement_timestamp(),
      last_changed_by = auth.uid(),
      updated_at = statement_timestamp()
  where id = presence_record.id
  returning * into presence_record;

  perform private.append_audit_log(
    'PRESENCE_RESPONDED', 'match_presence', presence_record.id,
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object('status', presence_record.presence_status, 'reasonProvided', target_status = 'DECLINED'),
    command_idempotency_key
  );

  result_value := to_jsonb(presence_record) || jsonb_build_object(
    'applicable_deadline', applicable_deadline,
    'schedule_revision', match_record.schedule_revision
  );
  insert into private.command_results values (
    'respond_to_call', auth.uid(), command_idempotency_key, result_value, statement_timestamp()
  );
  return result_value;
end;
$$;

revoke all on function public.respond_to_call(uuid, public.presence_status, text, uuid) from public, anon;
grant execute on function public.respond_to_call(uuid, public.presence_status, text, uuid) to authenticated;
