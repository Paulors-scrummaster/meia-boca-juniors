-- Feature 003 · US1 (Financeiro) · T020
-- Comandos administrativos da diretoria: valor padrão da mensalidade, cobrança
-- manual avulsa e ajuste de valor. PRESIDENT + AAL2, idempotentes, auditados.

create or replace function public.set_default_dues_amount(
  amount numeric,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  result_value jsonb;
begin
  perform private.require_president_aal2();
  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result from private.command_results
  where command_name = 'set_default_dues_amount'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  if amount is null or amount <= 0 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  insert into public.dues_settings (id, default_amount, updated_by, updated_at)
  values (true, amount, auth.uid(), statement_timestamp())
  on conflict (id) do update
    set default_amount = excluded.default_amount,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  perform private.append_audit_log(
    'DUES_DEFAULT_AMOUNT_SET', 'dues_settings', null,
    null, jsonb_build_object('defaultAmount', amount), command_idempotency_key
  );

  result_value := jsonb_build_object('defaultAmount', amount);
  insert into private.command_results
  values ('set_default_dues_amount', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

create or replace function public.create_manual_charge(
  athlete_uuid uuid,
  amount numeric,
  due_date_input date,
  type_input text,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  active_season_id uuid;
  charge_record public.athlete_charges%rowtype;
  result_value jsonb;
begin
  perform private.require_president_aal2();
  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result from private.command_results
  where command_name = 'create_manual_charge'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  if amount is null or amount <= 0
    or due_date_input is null
    or type_input not in ('MANUAL_OVERRIDE', 'EVENT_FEE') then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  if not exists (select 1 from public.athletes where id = athlete_uuid) then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  select id into active_season_id from public.seasons where status = 'ACTIVE';
  if active_season_id is null then
    raise exception using errcode = 'P0001', message = 'NO_ACTIVE_SEASON';
  end if;

  insert into public.athlete_charges (
    athlete_id, season_id, amount, due_date, status, type, period, created_by
  ) values (
    athlete_uuid, active_season_id, amount, due_date_input, 'PENDING', type_input::public.charge_type, null, auth.uid()
  )
  returning * into charge_record;

  perform private.append_audit_log(
    'CHARGE_CREATED', 'athlete_charge', charge_record.id,
    null,
    jsonb_build_object('athleteId', athlete_uuid, 'amount', amount, 'type', type_input, 'dueDate', due_date_input),
    command_idempotency_key
  );

  result_value := jsonb_build_object('chargeId', charge_record.id, 'status', 'PENDING');
  insert into private.command_results
  values ('create_manual_charge', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

create or replace function public.adjust_charge_amount(
  charge_uuid uuid,
  amount numeric,
  reason_input text,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  charge_record public.athlete_charges%rowtype;
  normalized_reason text;
  result_value jsonb;
begin
  perform private.require_president_aal2();
  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result from private.command_results
  where command_name = 'adjust_charge_amount'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  normalized_reason := btrim(coalesce(reason_input, ''));
  if amount is null or amount <= 0 or char_length(normalized_reason) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select * into charge_record from public.athlete_charges where id = charge_uuid for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if charge_record.status not in ('PENDING', 'OVERDUE') then
    raise exception using errcode = 'P0001', message = 'CHARGE_LOCKED';
  end if;

  update public.athlete_charges
  set amount = adjust_charge_amount.amount, updated_at = statement_timestamp()
  where id = charge_uuid;

  perform private.append_audit_log(
    'CHARGE_AMOUNT_ADJUSTED', 'athlete_charge', charge_uuid,
    jsonb_build_object('amount', charge_record.amount),
    jsonb_build_object('amount', adjust_charge_amount.amount, 'reasonProvided', true),
    command_idempotency_key
  );

  result_value := jsonb_build_object('chargeId', charge_uuid, 'amount', adjust_charge_amount.amount);
  insert into private.command_results
  values ('adjust_charge_amount', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function public.set_default_dues_amount(numeric, uuid) from public, anon;
revoke all on function public.create_manual_charge(uuid, numeric, date, text, uuid) from public, anon;
revoke all on function public.adjust_charge_amount(uuid, numeric, text, uuid) from public, anon;
grant execute on function public.set_default_dues_amount(numeric, uuid) to authenticated;
grant execute on function public.create_manual_charge(uuid, numeric, date, text, uuid) to authenticated;
grant execute on function public.adjust_charge_amount(uuid, numeric, text, uuid) to authenticated;
