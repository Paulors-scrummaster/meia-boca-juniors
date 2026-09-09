-- Feature 003 · US1 (Financeiro) · T023
-- Geração automática de mensalidades e varredura de inadimplência.
-- Cron interno (pg_cron) — permitido pela Constituição v1.1.0 / TECH_STACK §10.

-- Rotina de geração (idempotente por atleta/período via índice parcial único).
create or replace function private.generate_monthly_dues(target_period text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_period text;
  active_season_id uuid;
  default_amt numeric(10, 2);
  due_dt date;
  active_athletes integer;
  skipped_exempt integer;
  created_count integer;
begin
  resolved_period := coalesce(
    nullif(btrim(coalesce(target_period, '')), ''),
    to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM')
  );
  if resolved_period !~ '^\d{4}-\d{2}$' then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select id into active_season_id from public.seasons where status = 'ACTIVE';
  if active_season_id is null then
    raise exception using errcode = 'P0001', message = 'NO_ACTIVE_SEASON';
  end if;

  select default_amount into default_amt from public.dues_settings where id;
  if default_amt is null then
    raise exception using errcode = 'P0001', message = 'DUES_NOT_CONFIGURED';
  end if;

  due_dt := (resolved_period || '-10')::date;

  select count(*)::integer into active_athletes
  from public.athletes where status <> 'INACTIVE';

  select count(*)::integer into skipped_exempt
  from public.athletes a
  where a.status <> 'INACTIVE'
    and exists (
      select 1 from public.dues_exemptions e
      where e.athlete_id = a.id and (e.period = resolved_period or e.period is null)
    );

  insert into public.athlete_charges (
    athlete_id, season_id, amount, due_date, status, type, period, created_by
  )
  select a.id, active_season_id, default_amt, due_dt, 'PENDING', 'MONTHLY_AUTOMATIC', resolved_period, null
  from public.athletes a
  where a.status <> 'INACTIVE'
    and not exists (
      select 1 from public.dues_exemptions e
      where e.athlete_id = a.id and (e.period = resolved_period or e.period is null)
    )
  on conflict (athlete_id, period) where type = 'MONTHLY_AUTOMATIC' do nothing;

  get diagnostics created_count = row_count;

  return jsonb_build_object(
    'period', resolved_period,
    'created', created_count,
    'skippedExempt', skipped_exempt,
    'skippedExisting', greatest(active_athletes - skipped_exempt - created_count, 0),
    'activeAthletes', active_athletes
  );
end;
$$;

-- Transição diária PENDING -> OVERDUE.
create or replace function private.mark_overdue_charges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  update public.athlete_charges
  set status = 'OVERDUE', updated_at = statement_timestamp()
  where status = 'PENDING' and due_date < current_date;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- "Rodar agora / re-rodar" para a diretoria (mesmo corpo do cron).
create or replace function public.run_monthly_dues_generation(
  period_input text,
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
  where command_name = 'run_monthly_dues_generation'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  result_value := private.generate_monthly_dues(period_input);

  perform private.append_audit_log(
    'MONTHLY_DUES_GENERATED', 'athlete_charge', null,
    null, result_value, command_idempotency_key
  );

  insert into private.command_results
  values ('run_monthly_dues_generation', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function private.generate_monthly_dues(text) from public, anon, authenticated;
revoke all on function private.mark_overdue_charges() from public, anon, authenticated;
revoke all on function public.run_monthly_dues_generation(text, uuid) from public, anon;
grant execute on function private.generate_monthly_dues(text) to service_role;
grant execute on function private.mark_overdue_charges() to service_role;
grant execute on function public.run_monthly_dues_generation(text, uuid) to authenticated;

-- Agendamentos internos. 06:00 America/Sao_Paulo = 09:00 UTC; 03:00 SP = 06:00 UTC.
select cron.schedule('mbj-generate-monthly-dues', '0 9 1 * *', $$select private.generate_monthly_dues(null)$$);
select cron.schedule('mbj-mark-overdue-charges', '0 6 * * *', $$select private.mark_overdue_charges()$$);
