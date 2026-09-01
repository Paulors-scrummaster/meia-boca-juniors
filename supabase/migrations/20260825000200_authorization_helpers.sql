create table private.rate_limit_counters (
  scope text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  attempt_count integer not null default 0,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (scope, subject_hash, window_started_at),
  constraint rate_limit_scope_format check (scope ~ '^[a-z][a-z0-9:_-]{2,79}$'),
  constraint rate_limit_subject_is_safe_key check (
    subject_hash ~ '^[0-9a-f]{64}$'
    or subject_hash ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  constraint rate_limit_attempt_count_nonnegative check (attempt_count >= 0)
);

revoke all on private.rate_limit_counters from public, anon, authenticated;

create or replace function private.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and account_status = 'ACTIVE'
  );
$$;

create or replace function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_user_is_active()
    and exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role = required_role
    );
$$;

create or replace function private.has_any_role(required_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_user_is_active()
    and exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role = any(required_roles)
    );
$$;

create or replace function private.current_session_is_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

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
      if not private.payload_is_safe(item.value) then
        return false;
      end if;
    end loop;
    return true;
  end if;

  for item in select key, value from jsonb_each(payload)
  loop
    normalized_key := regexp_replace(lower(item.key), '[^a-z0-9]', '', 'g');
    if normalized_key similar to '%(password|passwd|secret|token|email|mailaddress|invitationlink|actionlink|absencereason|declinereason|providerpayload)%' then
      return false;
    end if;
    if not private.payload_is_safe(item.value) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter table public.audit_logs
  add constraint audit_logs_before_state_is_safe check (private.payload_is_safe(before_state)),
  add constraint audit_logs_after_state_is_safe check (private.payload_is_safe(after_state));

create or replace function private.append_audit_log(
  action_code text,
  resource_kind text,
  resource_uuid uuid,
  previous_state jsonb,
  resulting_state jsonb,
  request_trace_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_id uuid;
begin
  if auth.uid() is null or not private.current_user_is_active() then
    raise exception using errcode = '42501', message = 'active authenticated actor required';
  end if;

  if not private.payload_is_safe(previous_state) or not private.payload_is_safe(resulting_state) then
    raise exception using errcode = '22023', message = 'audit payload contains forbidden fields';
  end if;

  insert into public.audit_logs (
    actor_user_id,
    action,
    resource_type,
    resource_id,
    before_state,
    after_state,
    trace_id
  ) values (
    auth.uid(),
    action_code,
    resource_kind,
    resource_uuid,
    previous_state,
    resulting_state,
    request_trace_id
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function private.consume_rate_limit(
  counter_scope text,
  subject_key text,
  maximum_attempts integer,
  window_seconds integer
)
returns table (allowed boolean, remaining integer, resets_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window timestamptz;
  current_count integer;
begin
  if counter_scope !~ '^[a-z][a-z0-9:_-]{2,79}$'
    or subject_key is null
    or not (
      lower(subject_key) ~ '^[0-9a-f]{64}$'
      or lower(subject_key) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    )
    or maximum_attempts not between 1 and 10000
    or window_seconds not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'invalid rate-limit configuration';
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from statement_timestamp()) / window_seconds) * window_seconds
  );
  insert into private.rate_limit_counters (
    scope,
    subject_hash,
    window_started_at,
    attempt_count,
    updated_at
  ) values (
    counter_scope,
    lower(subject_key),
    current_window,
    1,
    statement_timestamp()
  )
  on conflict (scope, subject_hash, window_started_at)
  do update set
    attempt_count = private.rate_limit_counters.attempt_count + 1,
    updated_at = statement_timestamp()
  returning attempt_count into current_count;

  return query select
    current_count <= maximum_attempts,
    greatest(maximum_attempts - current_count, 0),
    current_window + make_interval(secs => window_seconds);
end;
$$;

revoke all on function private.append_audit_log(text, text, uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function private.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function private.append_audit_log(text, text, uuid, jsonb, jsonb, uuid) to service_role;
grant execute on function private.consume_rate_limit(text, text, integer, integer) to service_role;

grant usage on schema private to authenticated, service_role;
grant execute on function private.current_user_is_active() to authenticated, service_role;
grant execute on function private.has_role(public.app_role) to authenticated, service_role;
grant execute on function private.has_any_role(public.app_role[]) to authenticated, service_role;
grant execute on function private.current_session_is_aal2() to authenticated, service_role;

create policy profiles_select_self
on public.profiles for select
to authenticated
using (private.current_user_is_active() and id = auth.uid());

create policy user_roles_select_self
on public.user_roles for select
to authenticated
using (private.current_user_is_active() and user_id = auth.uid());

create policy athletes_select_active_accounts
on public.athletes for select
to authenticated
using (private.current_user_is_active());

create policy audit_logs_select_president_aal2
on public.audit_logs for select
to authenticated
using (private.has_role('PRESIDENT') and private.current_session_is_aal2());
