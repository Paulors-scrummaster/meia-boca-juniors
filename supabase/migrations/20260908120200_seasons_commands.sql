-- Feature 003 · Phase 2 (Foundational) · T007
-- Comandos de ciclo de vida da temporada. A comissão técnica / administração
-- (COACH ou PRESIDENT + AAL2) abre e encerra temporadas explicitamente; no
-- máximo uma ativa por vez. Padrão de idempotência via `private.command_results`
-- e auditoria via `private.append_audit_log`, iguais ao restante do MVP.

create or replace function public.open_season(
  year_input integer,
  starts_on_input date,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  season_record public.seasons%rowtype;
  result_value jsonb;
begin
  perform private.require_staff_aal2();

  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result
  from private.command_results
  where command_name = 'open_season'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then
    return cached_result;
  end if;

  if year_input is null or year_input not between 1000 and 9999 or starts_on_input is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  if exists (select 1 from public.seasons where status = 'ACTIVE') then
    raise exception using errcode = 'P0001', message = 'SEASON_ALREADY_ACTIVE';
  end if;

  insert into public.seasons (year, starts_on, ends_on, status)
  values (year_input, starts_on_input, null, 'ACTIVE')
  on conflict (year) do update
    set starts_on = excluded.starts_on,
        ends_on = null,
        status = 'ACTIVE'
  returning * into season_record;

  perform private.append_audit_log(
    'SEASON_OPENED',
    'season',
    season_record.id,
    null,
    jsonb_build_object('year', season_record.year, 'startsOn', season_record.starts_on),
    command_idempotency_key
  );

  result_value := jsonb_build_object(
    'seasonId', season_record.id,
    'year', season_record.year,
    'status', 'ACTIVE',
    'startsOn', season_record.starts_on
  );
  insert into private.command_results
  values ('open_season', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

create or replace function public.close_season(
  season_uuid uuid,
  ends_on_input date,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  season_record public.seasons%rowtype;
  result_value jsonb;
begin
  perform private.require_staff_aal2();

  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result
  from private.command_results
  where command_name = 'close_season'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then
    return cached_result;
  end if;

  select * into season_record from public.seasons where id = season_uuid for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if season_record.status <> 'ACTIVE' then
    raise exception using errcode = 'P0001', message = 'SEASON_NOT_ACTIVE';
  end if;
  if ends_on_input is null or ends_on_input < season_record.starts_on then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  update public.seasons
  set status = 'CLOSED',
      ends_on = ends_on_input
  where id = season_uuid
  returning * into season_record;

  perform private.append_audit_log(
    'SEASON_CLOSED',
    'season',
    season_record.id,
    jsonb_build_object('status', 'ACTIVE'),
    jsonb_build_object('status', 'CLOSED', 'endsOn', season_record.ends_on),
    command_idempotency_key
  );

  result_value := jsonb_build_object(
    'seasonId', season_record.id,
    'year', season_record.year,
    'status', 'CLOSED',
    'endsOn', season_record.ends_on
  );
  insert into private.command_results
  values ('close_season', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function public.open_season(integer, date, uuid) from public, anon;
revoke all on function public.close_season(uuid, date, uuid) from public, anon;
grant execute on function public.open_season(integer, date, uuid) to authenticated;
grant execute on function public.close_season(uuid, date, uuid) to authenticated;
