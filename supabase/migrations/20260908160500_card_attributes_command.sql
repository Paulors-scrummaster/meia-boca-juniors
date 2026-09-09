-- Feature 003 · US4 (UX & Gamificação) · T083
-- `set_athlete_attributes`: upsert 1:1 dos seis atributos do cartão. Cada valor é
-- `null` ou `1..99`; `overall` é derivado no banco (coluna gerada). COACH/PRESIDENT
-- + AAL2, com audit log. Padrão de idempotência via `private.command_results`.

create or replace function public.set_athlete_attributes(
  athlete_uuid uuid,
  pace_input integer,
  shooting_input integer,
  passing_input integer,
  dribbling_input integer,
  defending_input integer,
  physical_input integer,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  card_record public.athlete_card_attributes%rowtype;
  result_value jsonb;
begin
  perform private.require_staff_aal2();

  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result
  from private.command_results
  where command_name = 'set_athlete_attributes'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then
    return cached_result;
  end if;

  if (pace_input is not null and pace_input not between 1 and 99)
    or (shooting_input is not null and shooting_input not between 1 and 99)
    or (passing_input is not null and passing_input not between 1 and 99)
    or (dribbling_input is not null and dribbling_input not between 1 and 99)
    or (defending_input is not null and defending_input not between 1 and 99)
    or (physical_input is not null and physical_input not between 1 and 99) then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  if not exists (select 1 from public.athletes where id = athlete_uuid) then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  insert into public.athlete_card_attributes (
    athlete_id, pace, shooting, passing, dribbling, defending, physical, updated_by, updated_at
  ) values (
    athlete_uuid, pace_input::smallint, shooting_input::smallint, passing_input::smallint,
    dribbling_input::smallint, defending_input::smallint, physical_input::smallint,
    auth.uid(), statement_timestamp()
  )
  on conflict (athlete_id) do update
    set pace = excluded.pace,
        shooting = excluded.shooting,
        passing = excluded.passing,
        dribbling = excluded.dribbling,
        defending = excluded.defending,
        physical = excluded.physical,
        updated_by = auth.uid(),
        updated_at = statement_timestamp()
  returning * into card_record;

  perform private.append_audit_log(
    'ATHLETE_ATTRIBUTES_SET', 'athlete', athlete_uuid,
    null,
    jsonb_build_object('overall', card_record.overall),
    command_idempotency_key
  );

  result_value := jsonb_build_object(
    'athleteId', athlete_uuid,
    'attributes', jsonb_build_object(
      'pace', card_record.pace,
      'shooting', card_record.shooting,
      'passing', card_record.passing,
      'dribbling', card_record.dribbling,
      'defending', card_record.defending,
      'physical', card_record.physical
    ),
    'overall', card_record.overall
  );
  insert into private.command_results
  values ('set_athlete_attributes', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function public.set_athlete_attributes(uuid, integer, integer, integer, integer, integer, integer, uuid)
  from public, anon;
grant execute on function public.set_athlete_attributes(uuid, integer, integer, integer, integer, integer, integer, uuid)
  to authenticated;
