-- Feature 003 · US1 (Financeiro) · T022
-- Isenções por atleta. `period` NULL = indefinida. A geração mensal pula o atleta
-- quando existe isenção para o período alvo OU uma isenção indefinida.

create or replace function public.grant_dues_exemption(
  athlete_uuid uuid,
  period_input text,
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
  normalized_reason text;
  exemption_id uuid;
  result_value jsonb;
begin
  perform private.require_president_aal2();
  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result from private.command_results
  where command_name = 'grant_dues_exemption'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  normalized_reason := btrim(coalesce(reason_input, ''));
  if char_length(normalized_reason) not between 1 and 500
    or (period_input is not null and period_input !~ '^\d{4}-\d{2}$') then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;
  if not exists (select 1 from public.athletes where id = athlete_uuid) then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  begin
    insert into public.dues_exemptions (athlete_id, period, reason, created_by)
    values (athlete_uuid, period_input, normalized_reason, auth.uid())
    returning id into exemption_id;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'EXEMPTION_ALREADY_EXISTS';
  end;

  perform private.append_audit_log(
    'DUES_EXEMPTION_GRANTED', 'dues_exemption', exemption_id,
    null,
    jsonb_build_object('athleteId', athlete_uuid, 'period', period_input, 'reasonProvided', true),
    command_idempotency_key
  );

  result_value := jsonb_build_object('exemptionId', exemption_id);
  insert into private.command_results
  values ('grant_dues_exemption', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

create or replace function public.revoke_dues_exemption(
  exemption_uuid uuid,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  exemption_record public.dues_exemptions%rowtype;
  result_value jsonb;
begin
  perform private.require_president_aal2();
  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result from private.command_results
  where command_name = 'revoke_dues_exemption'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  select * into exemption_record from public.dues_exemptions where id = exemption_uuid for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NOT_FOUND';
  end if;

  delete from public.dues_exemptions where id = exemption_uuid;

  perform private.append_audit_log(
    'DUES_EXEMPTION_REVOKED', 'dues_exemption', exemption_uuid,
    jsonb_build_object('athleteId', exemption_record.athlete_id, 'period', exemption_record.period),
    null,
    command_idempotency_key
  );

  result_value := jsonb_build_object('exemptionId', exemption_uuid, 'revoked', true);
  insert into private.command_results
  values ('revoke_dues_exemption', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function public.grant_dues_exemption(uuid, text, text, uuid) from public, anon;
revoke all on function public.revoke_dues_exemption(uuid, uuid) from public, anon;
grant execute on function public.grant_dues_exemption(uuid, text, text, uuid) to authenticated;
grant execute on function public.revoke_dues_exemption(uuid, uuid) to authenticated;
