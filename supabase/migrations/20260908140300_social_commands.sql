-- Feature 003 · US2 (Resenha / Churrasco) · T040
-- Criação/edição de evento (PRESIDENT + AAL2) e confirmação de presença (atleta).

create or replace function public.create_social_event(
  title_input text,
  event_at_input timestamptz,
  location_name_input text,
  total_cost_input numeric,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  event_record public.social_events%rowtype;
  result_value jsonb;
begin
  perform private.require_president_aal2();
  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result from private.command_results
  where command_name = 'create_social_event'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  if event_at_input is null or total_cost_input is null or total_cost_input < 0 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  insert into public.social_events (title, event_at, location_name, total_cost, created_by)
  values (
    regexp_replace(btrim(coalesce(title_input, '')), '[[:space:]]+', ' ', 'g'),
    event_at_input,
    btrim(coalesce(location_name_input, '')),
    total_cost_input,
    auth.uid()
  )
  returning * into event_record;

  perform private.append_audit_log(
    'SOCIAL_EVENT_CREATED', 'social_event', event_record.id,
    null, jsonb_build_object('title', event_record.title, 'totalCost', event_record.total_cost),
    command_idempotency_key
  );

  result_value := jsonb_build_object('eventId', event_record.id, 'status', 'OPEN');
  insert into private.command_results
  values ('create_social_event', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

create or replace function public.update_social_event(
  event_uuid uuid,
  title_input text,
  event_at_input timestamptz,
  location_name_input text,
  total_cost_input numeric,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  event_record public.social_events%rowtype;
  result_value jsonb;
begin
  perform private.require_president_aal2();
  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result from private.command_results
  where command_name = 'update_social_event'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  select * into event_record from public.social_events where id = event_uuid for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if event_record.status <> 'OPEN' then
    raise exception using errcode = 'P0001', message = 'EVENT_CLOSED';
  end if;
  if total_cost_input is not null and total_cost_input < 0 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  update public.social_events
  set title = coalesce(
        regexp_replace(nullif(btrim(coalesce(title_input, '')), ''), '[[:space:]]+', ' ', 'g'),
        title
      ),
      event_at = coalesce(event_at_input, event_at),
      location_name = coalesce(nullif(btrim(coalesce(location_name_input, '')), ''), location_name),
      total_cost = coalesce(total_cost_input, total_cost),
      updated_at = statement_timestamp()
  where id = event_uuid
  returning * into event_record;

  perform private.append_audit_log(
    'SOCIAL_EVENT_UPDATED', 'social_event', event_uuid,
    null, jsonb_build_object('totalCost', event_record.total_cost), command_idempotency_key
  );

  result_value := jsonb_build_object('eventId', event_uuid, 'status', event_record.status::text);
  insert into private.command_results
  values ('update_social_event', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

create or replace function public.set_event_presence(
  event_uuid uuid,
  status_input text,
  guests_count_input integer,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  acting_athlete_id uuid;
  event_status public.social_event_status;
  presence_id uuid;
  result_value jsonb;
begin
  if not private.has_role('ATHLETE') then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result from private.command_results
  where command_name = 'set_event_presence'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  if status_input not in ('CONFIRMED', 'DECLINED')
    or guests_count_input is null or guests_count_input not between 0 and 20 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select id into acting_athlete_id from public.athletes where user_id = auth.uid();
  if acting_athlete_id is null then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select status into event_status from public.social_events where id = event_uuid for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if event_status <> 'OPEN' then
    raise exception using errcode = 'P0001', message = 'EVENT_CLOSED';
  end if;

  insert into public.social_event_presences (
    social_event_id, athlete_id, status, guests_count, responded_at, updated_at
  ) values (
    event_uuid, acting_athlete_id, status_input::public.event_presence_status,
    case when status_input = 'CONFIRMED' then guests_count_input else 0 end,
    statement_timestamp(), statement_timestamp()
  )
  on conflict (social_event_id, athlete_id) do update
    set status = excluded.status,
        guests_count = excluded.guests_count,
        updated_at = statement_timestamp()
  returning id into presence_id;

  result_value := jsonb_build_object(
    'presenceId', presence_id,
    'status', status_input,
    'guestsCount', case when status_input = 'CONFIRMED' then guests_count_input else 0 end
  );
  insert into private.command_results
  values ('set_event_presence', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function public.create_social_event(text, timestamptz, text, numeric, uuid) from public, anon;
revoke all on function public.update_social_event(uuid, text, timestamptz, text, numeric, uuid) from public, anon;
revoke all on function public.set_event_presence(uuid, text, integer, uuid) from public, anon;
grant execute on function public.create_social_event(text, timestamptz, text, numeric, uuid) to authenticated;
grant execute on function public.update_social_event(uuid, text, timestamptz, text, numeric, uuid) to authenticated;
grant execute on function public.set_event_presence(uuid, text, integer, uuid) to authenticated;
