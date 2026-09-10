-- Feature 003 · US2 (Resenha / Churrasco) · T041
-- Fechamento transacional: distribui `total_cost` em centavos de forma
-- determinística (base + 1 centavo nas `resto` primeiras cotas, ordem por
-- `athlete_id`), de modo que Σ cotas == total_cost exatamente (SC-002). Congela
-- os valores; NÃO cria cobrança EVENT_FEE (FR-017).

create or replace function public.close_social_event(
  event_uuid uuid,
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
  people_count integer;
  total_cents bigint;
  base_cents bigint;
  remainder bigint;
  shares jsonb;
  result_value jsonb;
begin
  perform private.require_president_aal2();
  if command_idempotency_key is null then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  select result into cached_result from private.command_results
  where command_name = 'close_social_event'
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

  select coalesce(sum(1 + guests_count), 0)::integer into people_count
  from public.social_event_presences
  where social_event_id = event_uuid and status = 'CONFIRMED';

  if people_count = 0 then
    raise exception using errcode = '22023', message = 'VALIDATION_ERROR';
  end if;

  total_cents := round(event_record.total_cost * 100)::bigint;
  base_cents := total_cents / people_count;                 -- divisão inteira
  remainder := total_cents - base_cents * people_count;     -- 0 <= remainder < people_count

  -- Cota por atleta: base por vaga (1 + acompanhantes) + 1 centavo para os
  -- `remainder` primeiros atletas ordenados por athlete_id.
  with confirmed as (
    select id, athlete_id, (1 + guests_count) as slots,
           row_number() over (order by athlete_id) as rn
    from public.social_event_presences
    where social_event_id = event_uuid and status = 'CONFIRMED'
  ),
  computed as (
    select id, athlete_id,
      ((base_cents * slots) + case when rn <= remainder then 1 else 0 end) / 100.0 as share
    from confirmed
  ),
  applied as (
    update public.social_event_presences p
    set frozen_share = computed.share, updated_at = statement_timestamp()
    from computed
    where computed.id = p.id
    returning computed.athlete_id, computed.share
  )
  select jsonb_agg(jsonb_build_object('athleteId', athlete_id, 'share', share) order by athlete_id)
  into shares
  from applied;

  update public.social_events
  set status = 'CLOSED',
      frozen_people_count = people_count,
      frozen_cost_per_person = round(event_record.total_cost / people_count, 2),
      closed_by = auth.uid(),
      closed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = event_uuid;

  perform private.append_audit_log(
    'SOCIAL_EVENT_CLOSED', 'social_event', event_uuid,
    jsonb_build_object('status', 'OPEN'),
    jsonb_build_object('status', 'CLOSED', 'peopleCount', people_count, 'totalCost', event_record.total_cost),
    command_idempotency_key
  );

  result_value := jsonb_build_object(
    'eventId', event_uuid,
    'status', 'CLOSED',
    'peopleCount', people_count,
    'costPerPerson', round(event_record.total_cost / people_count, 2),
    'shares', coalesce(shares, '[]'::jsonb)
  );
  insert into private.command_results
  values ('close_social_event', auth.uid(), command_idempotency_key, result_value, statement_timestamp());
  return result_value;
end;
$$;

revoke all on function public.close_social_event(uuid, uuid) from public, anon;
grant execute on function public.close_social_event(uuid, uuid) to authenticated;
