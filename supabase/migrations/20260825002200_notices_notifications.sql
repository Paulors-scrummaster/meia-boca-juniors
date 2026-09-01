create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  published_at timestamptz not null default statement_timestamp(),
  constraint notices_title_format check (
    char_length(title) between 1 and 100
    and title = btrim(title)
  ),
  constraint notices_body_format check (
    char_length(body) between 1 and 2000
    and body = btrim(body)
  )
);

create index notices_chronological_idx on public.notices (published_at desc, id desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on update restrict on delete cascade,
  provider_subscription_id text not null unique,
  is_enabled boolean not null default true,
  last_seen_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint push_subscriptions_provider_id_format check (
    char_length(provider_subscription_id) between 8 and 255
    and provider_subscription_id = btrim(provider_subscription_id)
    and provider_subscription_id !~ '[[:space:]]'
  ),
  constraint push_subscriptions_timestamps_ordered check (
    updated_at >= created_at and last_seen_at >= created_at
  )
);

create index push_subscriptions_user_enabled_idx
  on public.push_subscriptions (user_id, updated_at desc)
  where is_enabled;

alter table public.notification_deliveries
  add constraint notification_deliveries_attempt_count_bounded check (attempt_count between 0 and 5),
  add constraint notification_deliveries_retry_state check (
    (status = 'PENDING' and sent_at is null)
    or (status = 'PROCESSING' and attempt_count between 1 and 5 and sent_at is null)
    or (status = 'SENT' and attempt_count between 1 and 5 and sent_at is not null and last_error_code is null and next_attempt_at is null)
    or (status = 'FAILED' and attempt_count between 1 and 5 and sent_at is null and last_error_code is not null)
    or (status = 'SKIPPED' and attempt_count between 1 and 5 and sent_at is null and last_error_code is not null)
  );

create or replace function private.payload_is_safe(payload jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  item record;
  normalized_key text;
begin
  if payload is null or jsonb_typeof(payload) in ('string', 'number', 'boolean', 'null') then
    return true;
  end if;

  if jsonb_typeof(payload) = 'array' then
    for item in select value from jsonb_array_elements(payload)
    loop
      if not private.payload_is_safe(item.value) then return false; end if;
    end loop;
    return true;
  end if;

  for item in select key, value from jsonb_each(payload)
  loop
    normalized_key := regexp_replace(lower(item.key), '[^a-z0-9]', '', 'g');
    if normalized_key similar to '%(password|passwd|secret|token|email|mailaddress|invitationlink|actionlink|absencereason|declinereason|providerpayload|provideridentifier|providersubscription|externalid)%' then
      return false;
    end if;
    if not private.payload_is_safe(item.value) then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function private.claim_notification_deliveries(batch_limit integer)
returns table (
  delivery_id uuid,
  attempt_count integer,
  external_id uuid,
  subscription_id text,
  kind public.notification_kind,
  payload jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if batch_limit not between 1 and 50 then
    raise exception using errcode = '22023', message = 'invalid notification batch size';
  end if;

  return query
  with candidates as (
    select d.id
    from public.notification_deliveries d
    where (
      d.status in ('PENDING', 'FAILED')
      and coalesce(d.next_attempt_at, '-infinity'::timestamptz) <= statement_timestamp()
      and d.attempt_count < 5
    ) or (
      d.status = 'PROCESSING'
      and d.updated_at < statement_timestamp() - interval '10 minutes'
      and d.attempt_count < 5
    )
    order by coalesce(d.next_attempt_at, d.created_at), d.created_at, d.id
    for update skip locked
    limit batch_limit
  ), claimed as (
    update public.notification_deliveries d
    set status = 'PROCESSING',
        attempt_count = d.attempt_count + 1,
        last_error_code = null,
        next_attempt_at = null,
        updated_at = statement_timestamp()
    from candidates c
    where d.id = c.id
    returning d.*
  )
  select
    c.id,
    c.attempt_count,
    c.user_id,
    subscription.provider_subscription_id,
    e.kind,
    e.payload
  from claimed c
  join public.notification_events e on e.id = c.event_id
  left join lateral (
    select ps.provider_subscription_id
    from public.push_subscriptions ps
    where ps.user_id = c.user_id and ps.is_enabled
    order by ps.last_seen_at desc, ps.id
    limit 1
  ) subscription on true;
end;
$$;

create or replace function private.complete_notification_delivery(
  delivery_uuid uuid,
  outcome text,
  safe_error_code text default null,
  retry_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if outcome not in ('SENT', 'FAILED', 'SKIPPED', 'RETRY')
    or (safe_error_code is not null and safe_error_code !~ '^[A-Z][A-Z0-9_]{2,63}$')
    or (outcome = 'RETRY' and retry_at is null)
    or (outcome in ('FAILED', 'SKIPPED') and safe_error_code is null) then
    raise exception using errcode = '22023', message = 'invalid notification delivery outcome';
  end if;

  update public.notification_deliveries
  set status = case when outcome = 'RETRY' then 'FAILED'::public.notification_status else outcome::public.notification_status end,
      last_error_code = case when outcome = 'SENT' then null else safe_error_code end,
      next_attempt_at = case when outcome = 'RETRY' then retry_at else null end,
      sent_at = case when outcome = 'SENT' then statement_timestamp() else null end,
      updated_at = statement_timestamp()
  where id = delivery_uuid and status = 'PROCESSING';

  if not found then
    raise exception using errcode = 'P0002', message = 'notification delivery not claimed';
  end if;
end;
$$;

alter table public.notices enable row level security;
alter table public.push_subscriptions enable row level security;

create policy notices_select_active_accounts
on public.notices for select to authenticated
using (private.current_user_is_active());

create policy push_subscriptions_select_own
on public.push_subscriptions for select to authenticated
using (private.current_user_is_active() and user_id = auth.uid());
create policy push_subscriptions_insert_own
on public.push_subscriptions for insert to authenticated
with check (private.current_user_is_active() and user_id = auth.uid());
create policy push_subscriptions_update_own
on public.push_subscriptions for update to authenticated
using (private.current_user_is_active() and user_id = auth.uid())
with check (private.current_user_is_active() and user_id = auth.uid());
create policy push_subscriptions_delete_own
on public.push_subscriptions for delete to authenticated
using (private.current_user_is_active() and user_id = auth.uid());

revoke all on public.notices, public.push_subscriptions from public, anon, authenticated;
grant select on public.notices to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
revoke all on function private.claim_notification_deliveries(integer) from public, anon, authenticated;
revoke all on function private.complete_notification_delivery(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function private.claim_notification_deliveries(integer) to service_role;
grant execute on function private.complete_notification_delivery(uuid, text, text, timestamptz) to service_role;

create or replace function public.claim_notification_deliveries(batch_limit integer)
returns table (
  delivery_id uuid,
  attempt_count integer,
  external_id uuid,
  subscription_id text,
  kind public.notification_kind,
  payload jsonb
)
language sql
security definer
set search_path = ''
as $$
  select * from private.claim_notification_deliveries(batch_limit);
$$;

create or replace function public.complete_notification_delivery(
  delivery_uuid uuid,
  outcome text,
  safe_error_code text default null,
  retry_at timestamptz default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.complete_notification_delivery(delivery_uuid, outcome, safe_error_code, retry_at);
$$;

revoke all on function public.claim_notification_deliveries(integer) from public, anon, authenticated;
revoke all on function public.complete_notification_delivery(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_notification_deliveries(integer) to service_role;
grant execute on function public.complete_notification_delivery(uuid, text, text, timestamptz) to service_role;

create view public.notification_delivery_metrics
with (security_barrier = true)
as
select e.kind, d.status, count(*)::bigint as delivery_count, max(d.updated_at) as last_updated_at
from public.notification_deliveries d
join public.notification_events e on e.id = d.event_id
where private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
  and private.current_session_is_aal2()
group by e.kind, d.status;

create view public.pending_action_metrics
with (security_barrier = true)
as
select m.id as match_id, count(*)::bigint as pending_presence_count
from public.matches m
join public.match_presences mp on mp.match_id = m.id
where m.status = 'SCHEDULED'
  and mp.call_status = 'CALLED'
  and mp.presence_status = 'PENDING'
  and private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
  and private.current_session_is_aal2()
group by m.id;

create view public.notification_dispatch_health
with (security_barrier = true)
as
select
  max(d.sent_at) filter (where d.status = 'SENT') as last_successful_dispatch_at,
  count(*) filter (where d.status = 'FAILED' and d.attempt_count >= 5)::bigint as failed_delivery_count
from public.notification_deliveries d
having private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
  and private.current_session_is_aal2();

create view public.notification_failure_metrics
with (security_barrier = true)
as
select
  e.kind,
  d.last_error_code,
  count(*)::bigint as failure_count,
  max(d.updated_at) as last_updated_at
from public.notification_deliveries d
join public.notification_events e on e.id = d.event_id
where d.status in ('FAILED', 'SKIPPED')
  and d.last_error_code is not null
  and private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
  and private.current_session_is_aal2()
group by e.kind, d.last_error_code;

revoke all on public.notification_delivery_metrics, public.pending_action_metrics,
  public.notification_dispatch_health, public.notification_failure_metrics
  from public, anon, authenticated;
grant select on public.notification_delivery_metrics, public.pending_action_metrics,
  public.notification_dispatch_health, public.notification_failure_metrics to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notices'
    ) then
    alter publication supabase_realtime add table public.notices;
  end if;
end;
$$;
