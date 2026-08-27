alter table public.athletes
  drop constraint athletes_full_name_format,
  drop constraint athletes_shirt_name_format,
  drop constraint athletes_primary_position_format;

alter table public.athletes
  add constraint athletes_full_name_format check (
    char_length(full_name) between 2 and 120
    and full_name = btrim(full_name)
    and full_name !~ '[[:space:]]{2,}'
  ),
  add constraint athletes_shirt_name_format check (
    char_length(shirt_name) between 1 and 40
    and shirt_name = btrim(shirt_name)
    and shirt_name !~ '[[:space:]]{2,}'
  ),
  add constraint athletes_primary_position_format check (
    char_length(primary_position) between 2 and 40
    and primary_position = btrim(primary_position)
    and primary_position !~ '[[:space:]]{2,}'
  ),
  add constraint athletes_photo_path_is_canonical check (
    photo_path is null
    or photo_path = 'athletes/' || id::text || '/avatar.webp'
  ),
  add constraint athletes_anonymization_is_complete check (
    anonymized_at is null
    or (
      status = 'INACTIVE'
      and inactivated_at is not null
      and user_id is null
      and photo_path is null
    )
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'athlete-avatars',
  'athlete-avatars',
  false,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy athlete_avatars_select_active_accounts
on storage.objects for select
to authenticated
using (
  bucket_id = 'athlete-avatars'
  and private.current_user_is_active()
  and exists (
    select 1
    from public.athletes
    where photo_path = storage.objects.name
  )
);

create policy athlete_avatars_insert_president_aal2
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'athlete-avatars'
  and private.has_role('PRESIDENT')
  and private.current_session_is_aal2()
  and name ~ '^athletes/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/avatar\.webp$'
  and exists (
    select 1
    from public.athletes
    where id::text = split_part(storage.objects.name, '/', 2)
  )
);

create policy athlete_avatars_update_president_aal2
on storage.objects for update
to authenticated
using (
  bucket_id = 'athlete-avatars'
  and private.has_role('PRESIDENT')
  and private.current_session_is_aal2()
)
with check (
  bucket_id = 'athlete-avatars'
  and private.has_role('PRESIDENT')
  and private.current_session_is_aal2()
  and name ~ '^athletes/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/avatar\.webp$'
);

create policy athlete_avatars_delete_president_aal2
on storage.objects for delete
to authenticated
using (
  bucket_id = 'athlete-avatars'
  and private.has_role('PRESIDENT')
  and private.current_session_is_aal2()
);

create or replace function public.create_athlete(
  full_name_input text,
  shirt_name_input text,
  shirt_number_input smallint,
  primary_position_input text,
  status_input public.athlete_status,
  photo_path_input text,
  request_trace_id uuid
)
returns public.athletes
language plpgsql
security definer
set search_path = ''
as $$
declare
  athlete_id uuid := gen_random_uuid();
  created_record public.athletes%rowtype;
begin
  if not private.has_role('PRESIDENT') or not private.current_session_is_aal2() then
    raise exception using errcode = '42501', message = 'President with AAL2 required';
  end if;

  insert into public.athletes (
    id, full_name, shirt_name, shirt_number, primary_position,
    status, photo_path, inactivated_at
  ) values (
    athlete_id,
    regexp_replace(btrim(full_name_input), '[[:space:]]+', ' ', 'g'),
    regexp_replace(btrim(shirt_name_input), '[[:space:]]+', ' ', 'g'),
    shirt_number_input,
    regexp_replace(btrim(primary_position_input), '[[:space:]]+', ' ', 'g'),
    status_input,
    photo_path_input,
    case when status_input = 'INACTIVE' then statement_timestamp() else null end
  )
  returning * into created_record;

  perform private.append_audit_log(
    'ATHLETE_CREATED',
    'athlete',
    created_record.id,
    null,
    jsonb_build_object(
      'status', created_record.status,
      'shirtNumber', created_record.shirt_number,
      'hasPhoto', created_record.photo_path is not null
    ),
    request_trace_id
  );

  return created_record;
end;
$$;

create or replace function public.update_athlete(
  athlete_uuid uuid,
  full_name_input text,
  shirt_name_input text,
  shirt_number_input smallint,
  primary_position_input text,
  photo_path_input text,
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

  update public.athletes
  set full_name = regexp_replace(btrim(full_name_input), '[[:space:]]+', ' ', 'g'),
      shirt_name = regexp_replace(btrim(shirt_name_input), '[[:space:]]+', ' ', 'g'),
      shirt_number = shirt_number_input,
      primary_position = regexp_replace(btrim(primary_position_input), '[[:space:]]+', ' ', 'g'),
      photo_path = photo_path_input,
      updated_at = statement_timestamp()
  where id = athlete_uuid
  returning * into updated_record;

  perform private.append_audit_log(
    'ATHLETE_UPDATED',
    'athlete',
    athlete_uuid,
    jsonb_build_object(
      'status', previous_record.status,
      'shirtNumber', previous_record.shirt_number,
      'hasPhoto', previous_record.photo_path is not null
    ),
    jsonb_build_object(
      'status', updated_record.status,
      'shirtNumber', updated_record.shirt_number,
      'hasPhoto', updated_record.photo_path is not null
    ),
    request_trace_id
  );

  return updated_record;
end;
$$;

revoke all on function public.create_athlete(text, text, smallint, text, public.athlete_status, text, uuid) from public, anon;
revoke all on function public.update_athlete(uuid, text, text, smallint, text, text, uuid) from public, anon;
grant execute on function public.create_athlete(text, text, smallint, text, public.athlete_status, text, uuid) to authenticated;
grant execute on function public.update_athlete(uuid, text, text, smallint, text, text, uuid) to authenticated;
