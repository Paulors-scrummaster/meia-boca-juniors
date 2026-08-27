create or replace function public.set_athlete_status(
  athlete_uuid uuid,
  target_status public.athlete_status,
  replacement_shirt_number smallint,
  request_trace_id uuid
)
returns public.athletes
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_record public.athletes%rowtype;
  updated_record public.athletes%rowtype;
begin
  if not private.has_role('PRESIDENT') or not private.current_session_is_aal2() then
    raise exception using errcode = '42501', message = 'President with AAL2 required';
  end if;

  select * into previous_record
  from public.athletes
  where id = athlete_uuid
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'athlete not found';
  end if;
  if previous_record.anonymized_at is not null then
    raise exception using errcode = '55000', message = 'anonymized athlete is immutable';
  end if;
  if previous_record.status = 'INACTIVE'
    and target_status <> 'INACTIVE'
    and replacement_shirt_number is null then
    raise exception using errcode = '22023', message = 'reactivation requires a shirt number';
  end if;

  update public.athletes
  set status = target_status,
      shirt_number = case
        when previous_record.status = 'INACTIVE' and target_status <> 'INACTIVE'
          then replacement_shirt_number
        else shirt_number
      end,
      inactivated_at = case
        when target_status = 'INACTIVE' then coalesce(inactivated_at, statement_timestamp())
        else null
      end,
      updated_at = statement_timestamp()
  where id = athlete_uuid
  returning * into updated_record;

  if target_status = 'INACTIVE' and previous_record.user_id is not null then
    delete from public.user_roles
    where user_id = previous_record.user_id
      and role = 'ATHLETE';
  end if;

  perform private.append_audit_log(
    case
      when target_status = 'INACTIVE' and previous_record.status <> 'INACTIVE'
        then 'ATHLETE_INACTIVATED'
      else 'ATHLETE_STATUS_CHANGED'
    end,
    'athlete',
    athlete_uuid,
    jsonb_build_object('status', previous_record.status, 'shirtNumber', previous_record.shirt_number),
    jsonb_build_object('status', updated_record.status, 'shirtNumber', updated_record.shirt_number),
    request_trace_id
  );

  return updated_record;
end;
$$;

create or replace function public.anonymize_athlete(
  athlete_uuid uuid,
  request_trace_id uuid
)
returns public.athletes
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_record public.athletes%rowtype;
  updated_record public.athletes%rowtype;
begin
  if not private.has_role('PRESIDENT') or not private.current_session_is_aal2() then
    raise exception using errcode = '42501', message = 'President with AAL2 required';
  end if;

  select * into previous_record
  from public.athletes
  where id = athlete_uuid
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'athlete not found';
  end if;
  if previous_record.anonymized_at is not null then
    return previous_record;
  end if;

  update public.athletes
  set full_name = 'Atleta histórico ' || left(id::text, 8),
      shirt_name = 'Histórico',
      status = 'INACTIVE',
      photo_path = null,
      user_id = null,
      inactivated_at = coalesce(inactivated_at, statement_timestamp()),
      anonymized_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = athlete_uuid
  returning * into updated_record;

  if previous_record.user_id is not null then
    delete from public.user_roles
    where user_id = previous_record.user_id
      and role = 'ATHLETE';
  end if;

  perform private.append_audit_log(
    'ATHLETE_ANONYMIZED',
    'athlete',
    athlete_uuid,
    jsonb_build_object(
      'status', previous_record.status,
      'shirtNumber', previous_record.shirt_number,
      'linkedAccount', previous_record.user_id is not null,
      'hasPhoto', previous_record.photo_path is not null
    ),
    jsonb_build_object(
      'status', updated_record.status,
      'shirtNumber', updated_record.shirt_number,
      'linkedAccount', false,
      'hasPhoto', false,
      'anonymized', true
    ),
    request_trace_id
  );

  return updated_record;
end;
$$;

revoke all on function public.set_athlete_status(uuid, public.athlete_status, smallint, uuid) from public, anon;
revoke all on function public.anonymize_athlete(uuid, uuid) from public, anon;
grant execute on function public.set_athlete_status(uuid, public.athlete_status, smallint, uuid) to authenticated;
grant execute on function public.anonymize_athlete(uuid, uuid) to authenticated;
