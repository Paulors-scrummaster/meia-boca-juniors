-- Feature 003 · US1 (Financeiro) · T021
-- Máquina de estados da cobrança operada só por comando:
--   PENDING|OVERDUE -> PAID           (settle_charge)
--   PAID -> PENDING|OVERDUE           (reverse_charge_settlement — conforme due_date)
--   PENDING|OVERDUE|PAID -> CANCELLED (cancel_charge, estado final)
-- Toda transição grava audit log com ator, instante e motivo do usuário.

create or replace function public.settle_charge(
  charge_uuid uuid,
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
  where command_name = 'settle_charge'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  normalized_reason := btrim(coalesce(reason_input, ''));
  if char_length(normalized_reason) not between 1 and 500 then
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
  set status = 'PAID', settled_by = auth.uid(), settled_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = charge_uuid;

  perform private.append_audit_log(
    'CHARGE_SETTLED', 'athlete_charge', charge_uuid,
    jsonb_build_object('status', charge_record.status::text),
    jsonb_build_object('status', 'PAID', 'reasonProvided', true),
    command_idempotency_key
  );

  result_value := jsonb_build_object(
    'chargeId', charge_uuid, 'status', 'PAID', 'settledAt', statement_timestamp()
  );
  insert into private.command_results
  values ('settle_charge', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

create or replace function public.reverse_charge_settlement(
  charge_uuid uuid,
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
  target_status public.charge_status;
  result_value jsonb;
begin
  perform private.require_president_aal2();
  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result from private.command_results
  where command_name = 'reverse_charge_settlement'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  normalized_reason := btrim(coalesce(reason_input, ''));
  if char_length(normalized_reason) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select * into charge_record from public.athlete_charges where id = charge_uuid for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if charge_record.status <> 'PAID' then
    raise exception using errcode = 'P0001', message = 'CHARGE_LOCKED';
  end if;

  target_status := case
    when charge_record.due_date < current_date then 'OVERDUE'::public.charge_status
    else 'PENDING'::public.charge_status
  end;

  update public.athlete_charges
  set status = target_status, settled_by = null, settled_at = null,
      updated_at = statement_timestamp()
  where id = charge_uuid;

  perform private.append_audit_log(
    'CHARGE_SETTLEMENT_REVERSED', 'athlete_charge', charge_uuid,
    jsonb_build_object('status', 'PAID'),
    jsonb_build_object('status', target_status::text, 'reasonProvided', true),
    command_idempotency_key
  );

  result_value := jsonb_build_object('chargeId', charge_uuid, 'status', target_status::text);
  insert into private.command_results
  values ('reverse_charge_settlement', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

create or replace function public.cancel_charge(
  charge_uuid uuid,
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
  where command_name = 'cancel_charge'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  normalized_reason := btrim(coalesce(reason_input, ''));
  if char_length(normalized_reason) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select * into charge_record from public.athlete_charges where id = charge_uuid for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;
  if charge_record.status = 'CANCELLED' then
    raise exception using errcode = 'P0001', message = 'CHARGE_LOCKED';
  end if;

  -- Um cancelamento não é uma baixa: limpa os metadados de liquidação.
  update public.athlete_charges
  set status = 'CANCELLED', settled_by = null, settled_at = null,
      updated_at = statement_timestamp()
  where id = charge_uuid;

  perform private.append_audit_log(
    'CHARGE_CANCELLED', 'athlete_charge', charge_uuid,
    jsonb_build_object('status', charge_record.status::text),
    jsonb_build_object('status', 'CANCELLED', 'reasonProvided', true),
    command_idempotency_key
  );

  result_value := jsonb_build_object('chargeId', charge_uuid, 'status', 'CANCELLED');
  insert into private.command_results
  values ('cancel_charge', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function public.settle_charge(uuid, text, uuid) from public, anon;
revoke all on function public.reverse_charge_settlement(uuid, text, uuid) from public, anon;
revoke all on function public.cancel_charge(uuid, text, uuid) from public, anon;
grant execute on function public.settle_charge(uuid, text, uuid) to authenticated;
grant execute on function public.reverse_charge_settlement(uuid, text, uuid) to authenticated;
grant execute on function public.cancel_charge(uuid, text, uuid) to authenticated;
