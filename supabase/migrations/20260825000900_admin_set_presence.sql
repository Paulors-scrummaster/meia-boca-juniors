create or replace function public.admin_set_presence(
  match_uuid uuid,
  athlete_uuid uuid,
  target_status public.presence_status,
  refusal_reason text,
  change_explanation text,
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
  normalized_explanation text;
  result_value jsonb;
begin
  perform private.require_staff_aal2();

  select result into cached_result
  from private.command_results
  where command_name = 'admin_set_presence'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  if target_status not in ('PENDING', 'CONFIRMED', 'DECLINED') then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;
  normalized_explanation := regexp_replace(btrim(coalesce(change_explanation, '')), '[[:space:]]+', ' ', 'g');
  if char_length(normalized_explanation) not between 2 and 500 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select * into match_record from public.matches where id = match_uuid for update;
  if not found then raise exception using errcode = 'P0002', message = 'NOT_FOUND'; end if;
  if match_record.status = 'CANCELLED' or match_record.current_consolidation_id is not null then
    raise exception using errcode = 'P0001', message = 'MATCH_LOCKED';
  end if;

  select * into presence_record
  from public.match_presences
  where match_id = match_uuid and athlete_id = athlete_uuid
  for update;
  if not found or presence_record.call_status <> 'CALLED' then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  normalized_reason := regexp_replace(btrim(coalesce(refusal_reason, '')), '[[:space:]]+', ' ', 'g');
  if target_status = 'DECLINED' and char_length(normalized_reason) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  if target_status = 'DECLINED' then
    insert into public.presence_justifications (presence_id, reason, created_by)
    values (presence_record.id, normalized_reason, auth.uid())
    on conflict (presence_id) do update
      set reason = excluded.reason, created_by = excluded.created_by, updated_at = statement_timestamp();
  else
    delete from public.presence_justifications where presence_id = presence_record.id;
  end if;

  update public.match_presences
  set presence_status = target_status,
      responded_at = case when target_status = 'PENDING' then null else statement_timestamp() end,
      last_changed_by = auth.uid(),
      updated_at = statement_timestamp()
  where id = presence_record.id
  returning * into presence_record;

  perform private.append_audit_log(
    'PRESENCE_ADMIN_OVERRIDE', 'match_presence', presence_record.id,
    jsonb_build_object('athleteId', athlete_uuid),
    jsonb_build_object(
      'athleteId', athlete_uuid,
      'status', presence_record.presence_status,
      'reasonProvided', target_status = 'DECLINED',
      'explanationProvided', true
    ),
    command_idempotency_key
  );

  result_value := to_jsonb(presence_record);
  insert into private.command_results values (
    'admin_set_presence', auth.uid(), command_idempotency_key, result_value, statement_timestamp()
  );
  return result_value;
end;
$$;

revoke all on function public.admin_set_presence(uuid, uuid, public.presence_status, text, text, uuid)
from public, anon;
grant execute on function public.admin_set_presence(uuid, uuid, public.presence_status, text, text, uuid)
to authenticated;
