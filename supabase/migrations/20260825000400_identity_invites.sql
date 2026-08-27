create table public.athlete_invites (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  auth_user_id uuid unique references auth.users (id) on update restrict on delete restrict,
  email_normalized text not null,
  created_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  redeemed_at timestamptz,
  revoked_at timestamptz,
  redeemed_by uuid references public.profiles (id) on update restrict on delete restrict,
  constraint athlete_invites_email_is_normalized check (
    char_length(email_normalized) between 3 and 320
    and email_normalized = lower(btrim(email_normalized))
    and email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint athlete_invites_terminal_state_is_exclusive check (
    not (redeemed_at is not null and revoked_at is not null)
  ),
  constraint athlete_invites_redemption_is_complete check (
    (redeemed_at is null and redeemed_by is null)
    or (redeemed_at is not null and redeemed_by is not null)
  )
);

create unique index athlete_invites_one_pending_per_athlete_key
  on public.athlete_invites (athlete_id)
  where redeemed_at is null and revoked_at is null;

create index athlete_invites_created_by_idx
  on public.athlete_invites (created_by, created_at desc);

create table private.identity_command_results (
  scope text not null,
  actor_user_id uuid not null references public.profiles (id) on update restrict on delete restrict,
  idempotency_key uuid not null,
  target_id uuid not null,
  result jsonb not null,
  completed_at timestamptz not null default statement_timestamp(),
  primary key (scope, actor_user_id, idempotency_key),
  constraint identity_command_results_scope_format check (
    scope ~ '^identity:[a-z][a-z0-9:_-]{2,63}$'
  ),
  constraint identity_command_results_payload_safe check (private.payload_is_safe(result))
);

revoke all on private.identity_command_results from public, anon, authenticated;

alter table public.athlete_invites enable row level security;

revoke all on public.athlete_invites from public, anon, authenticated;
grant select on public.athlete_invites to authenticated;
grant insert, delete on public.user_roles to authenticated;

create policy athlete_invites_select_president_aal2
on public.athlete_invites for select
to authenticated
using (
  private.has_role('PRESIDENT')
  and private.current_session_is_aal2()
);

create policy user_roles_insert_president_aal2
on public.user_roles for insert
to authenticated
with check (
  private.has_role('PRESIDENT')
  and private.current_session_is_aal2()
  and assigned_by = auth.uid()
);

create policy user_roles_delete_president_aal2
on public.user_roles for delete
to authenticated
using (
  private.has_role('PRESIDENT')
  and private.current_session_is_aal2()
);

create or replace function private.audit_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  affected_user_id uuid := coalesce(new.user_id, old.user_id);
  affected_role public.app_role := coalesce(new.role, old.role);
begin
  if actor_id is not null
    and (tg_op = 'DELETE' or new.assigned_by = actor_id) then
    perform private.append_audit_log(
      case when tg_op = 'INSERT' then 'ROLE_ASSIGNED' else 'ROLE_REMOVED' end,
      'profile',
      affected_user_id,
      case when tg_op = 'DELETE' then jsonb_build_object('role', affected_role) else null end,
      case when tg_op = 'INSERT' then jsonb_build_object('role', affected_role) else null end,
      gen_random_uuid()
    );
  end if;

  return coalesce(new, old);
end;
$$;

create trigger user_roles_audit_changes
after insert or delete on public.user_roles
for each row execute function private.audit_role_change();

create or replace function public.accept_athlete_invitation(
  invitation_uuid uuid,
  request_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  invitation_record public.athlete_invites%rowtype;
  athlete_user_id uuid;
  resulting_roles jsonb;
  must_change boolean;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'authenticated invitation identity required';
  end if;

  select *
  into invitation_record
  from public.athlete_invites
  where id = invitation_uuid
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'invitation not found';
  end if;

  if invitation_record.auth_user_id is distinct from actor_id then
    raise exception using errcode = '42501', message = 'invitation does not belong to authenticated user';
  end if;

  if invitation_record.redeemed_at is not null or invitation_record.revoked_at is not null then
    raise exception using errcode = 'P0001', message = 'invitation is not pending';
  end if;

  select user_id
  into athlete_user_id
  from public.athletes
  where id = invitation_record.athlete_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'athlete not found';
  end if;

  if athlete_user_id is not null and athlete_user_id <> actor_id then
    raise exception using errcode = '23505', message = 'athlete already linked to another user';
  end if;

  insert into public.profiles (id)
  values (actor_id)
  on conflict (id) do nothing;

  if not exists (
    select 1 from public.profiles
    where id = actor_id and account_status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'active profile required';
  end if;

  update public.athletes
  set user_id = actor_id,
      updated_at = statement_timestamp()
  where id = invitation_record.athlete_id;

  insert into public.user_roles (user_id, role, assigned_by)
  values (actor_id, 'ATHLETE', invitation_record.created_by)
  on conflict (user_id, role) do nothing;

  update public.athlete_invites
  set redeemed_at = statement_timestamp(),
      redeemed_by = actor_id
  where id = invitation_uuid;

  perform private.append_audit_log(
    'INVITATION_REDEEMED',
    'athlete_invite',
    invitation_uuid,
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object(
      'status', 'REDEEMED',
      'athleteId', invitation_record.athlete_id,
      'userId', actor_id
    ),
    request_trace_id
  );

  select coalesce(jsonb_agg(role order by role), '[]'::jsonb)
  into resulting_roles
  from public.user_roles
  where user_id = actor_id;

  select must_change_password
  into must_change
  from public.profiles
  where id = actor_id;

  return jsonb_build_object(
    'athleteId', invitation_record.athlete_id,
    'roles', resulting_roles,
    'mustChangePassword', must_change
  );
end;
$$;

create or replace function public.set_user_role(
  target_user_id uuid,
  target_role public.app_role,
  should_assign boolean,
  request_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  resulting_roles jsonb;
begin
  if not private.has_role('PRESIDENT') or not private.current_session_is_aal2() then
    raise exception using errcode = '42501', message = 'President with AAL2 required';
  end if;

  perform 1 from public.profiles where id = target_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'target profile not found';
  end if;

  if should_assign then
    insert into public.user_roles (user_id, role, assigned_by)
    values (target_user_id, target_role, actor_id)
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles
    where user_id = target_user_id and role = target_role;
  end if;

  select coalesce(jsonb_agg(role order by role), '[]'::jsonb)
  into resulting_roles
  from public.user_roles
  where user_id = target_user_id;

  return jsonb_build_object('userId', target_user_id, 'roles', resulting_roles, 'traceId', request_trace_id);
end;
$$;

create or replace function public.complete_forced_password_change(request_trace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not private.current_user_is_active() then
    raise exception using errcode = '42501', message = 'active authenticated actor required';
  end if;

  update public.profiles
  set must_change_password = false,
      updated_at = statement_timestamp()
  where id = actor_id;

  perform private.append_audit_log(
    'PASSWORD_CHANGED',
    'profile',
    actor_id,
    jsonb_build_object('credentialChangeRequired', true),
    jsonb_build_object('credentialChangeRequired', false),
    request_trace_id
  );

  return jsonb_build_object('mustChangePassword', false);
end;
$$;

create or replace function private.assert_service_identity_actor(actor_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    join public.user_roles r on r.user_id = p.id
    where p.id = actor_id
      and p.account_status = 'ACTIVE'
      and r.role = 'PRESIDENT'
  ) then
    raise exception using errcode = '42501', message = 'active President required';
  end if;
end;
$$;

create or replace function private.append_identity_audit_for_actor(
  actor_id uuid,
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
  if not private.payload_is_safe(previous_state) or not private.payload_is_safe(resulting_state) then
    raise exception using errcode = '22023', message = 'audit payload contains forbidden fields';
  end if;

  insert into public.audit_logs (
    actor_user_id, action, resource_type, resource_id,
    before_state, after_state, trace_id
  ) values (
    actor_id, action_code, resource_kind, resource_uuid,
    previous_state, resulting_state, request_trace_id
  ) returning id into inserted_id;

  return inserted_id;
end;
$$;

create or replace function public.consume_identity_rate_limit(
  counter_scope text,
  subject_key text,
  maximum_attempts integer,
  window_seconds integer
)
returns table (allowed boolean, remaining integer, resets_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select *
  from private.consume_rate_limit(counter_scope, subject_key, maximum_attempts, window_seconds);
$$;

create or replace function public.create_identity_invite(
  actor_user_id uuid,
  athlete_uuid uuid,
  invitation_auth_user_id uuid,
  normalized_email text,
  command_idempotency_key uuid,
  request_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_result jsonb;
  invitation_id uuid;
  athlete_linked_user uuid;
  result_payload jsonb;
begin
  perform private.assert_service_identity_actor(actor_user_id);

  select result into existing_result
  from private.identity_command_results command_result
  where command_result.scope = 'identity:invite-create'
    and command_result.actor_user_id = create_identity_invite.actor_user_id
    and command_result.idempotency_key = command_idempotency_key;

  if found then
    if (existing_result ->> 'athleteId')::uuid <> athlete_uuid then
      raise exception using errcode = '22023', message = 'idempotency key reused for another target';
    end if;
    return existing_result;
  end if;

  select user_id into athlete_linked_user
  from public.athletes
  where id = athlete_uuid
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'athlete not found';
  end if;
  if athlete_linked_user is not null then
    raise exception using errcode = '23505', message = 'athlete already activated';
  end if;

  insert into public.athlete_invites (
    athlete_id, auth_user_id, email_normalized, created_by
  ) values (
    athlete_uuid, invitation_auth_user_id, normalized_email, actor_user_id
  ) returning id into invitation_id;

  result_payload := jsonb_build_object(
    'invitationId', invitation_id,
    'athleteId', athlete_uuid,
    'authUserId', invitation_auth_user_id,
    'logicalStatus', 'PENDING'
  );

  insert into private.identity_command_results (
    scope, actor_user_id, idempotency_key, target_id, result
  ) values (
    'identity:invite-create', actor_user_id, command_idempotency_key, athlete_uuid, result_payload
  );

  perform private.append_identity_audit_for_actor(
    actor_user_id,
    'INVITATION_CREATED',
    'athlete_invite',
    invitation_id,
    null,
    jsonb_build_object('athleteId', athlete_uuid, 'status', 'PENDING'),
    request_trace_id
  );

  return result_payload;
end;
$$;

create or replace function public.record_identity_invite_resend(
  actor_user_id uuid,
  invitation_uuid uuid,
  command_idempotency_key uuid,
  request_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_result jsonb;
  result_payload jsonb;
begin
  perform private.assert_service_identity_actor(actor_user_id);

  select result into existing_result
  from private.identity_command_results command_result
  where command_result.scope = 'identity:invite-resend'
    and command_result.actor_user_id = record_identity_invite_resend.actor_user_id
    and command_result.idempotency_key = command_idempotency_key;
  if found then return existing_result; end if;

  perform 1 from public.athlete_invites
  where id = invitation_uuid and redeemed_at is null and revoked_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'invitation is not pending';
  end if;

  result_payload := jsonb_build_object('invitationId', invitation_uuid, 'logicalStatus', 'PENDING');
  insert into private.identity_command_results (
    scope, actor_user_id, idempotency_key, target_id, result
  ) values (
    'identity:invite-resend', actor_user_id, command_idempotency_key,
    invitation_uuid, result_payload
  );

  perform private.append_identity_audit_for_actor(
    actor_user_id, 'INVITATION_RESENT', 'athlete_invite', invitation_uuid,
    null, jsonb_build_object('status', 'PENDING'), request_trace_id
  );

  return result_payload;
end;
$$;

create or replace function public.revoke_identity_invite(
  actor_user_id uuid,
  athlete_uuid uuid,
  command_idempotency_key uuid,
  request_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_result jsonb;
  invitation_record public.athlete_invites%rowtype;
  result_payload jsonb;
begin
  perform private.assert_service_identity_actor(actor_user_id);

  select result into existing_result
  from private.identity_command_results command_result
  where command_result.scope = 'identity:invite-revoke'
    and command_result.actor_user_id = revoke_identity_invite.actor_user_id
    and command_result.idempotency_key = command_idempotency_key;
  if found then return existing_result; end if;

  select * into invitation_record
  from public.athlete_invites
  where athlete_id = athlete_uuid and redeemed_at is null and revoked_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'active invitation not found';
  end if;

  update public.athlete_invites
  set revoked_at = statement_timestamp()
  where id = invitation_record.id;

  result_payload := jsonb_build_object(
    'invitationId', invitation_record.id,
    'authUserId', invitation_record.auth_user_id,
    'logicalStatus', 'REVOKED'
  );
  insert into private.identity_command_results (
    scope, actor_user_id, idempotency_key, target_id, result
  ) values (
    'identity:invite-revoke', actor_user_id, command_idempotency_key,
    athlete_uuid, result_payload
  );

  perform private.append_identity_audit_for_actor(
    actor_user_id, 'INVITATION_REVOKED', 'athlete_invite', invitation_record.id,
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object('status', 'REVOKED'),
    request_trace_id
  );

  return result_payload;
end;
$$;

create or replace function public.complete_admin_password_reset(
  actor_user_id uuid,
  target_user_id uuid,
  command_idempotency_key uuid,
  request_trace_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_result jsonb;
  result_payload jsonb;
  revoked_session_count integer;
begin
  perform private.assert_service_identity_actor(actor_user_id);

  select result into existing_result
  from private.identity_command_results command_result
  where command_result.scope = 'identity:admin-password-reset'
    and command_result.actor_user_id = complete_admin_password_reset.actor_user_id
    and command_result.idempotency_key = command_idempotency_key;
  if found then
    if (existing_result ->> 'userId')::uuid <> target_user_id then
      raise exception using errcode = '22023', message = 'idempotency key reused for another target';
    end if;
    return existing_result;
  end if;

  update public.profiles
  set must_change_password = true,
      updated_at = statement_timestamp()
  where id = target_user_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'target profile not found';
  end if;

  delete from auth.sessions where user_id = target_user_id;
  get diagnostics revoked_session_count = row_count;

  result_payload := jsonb_build_object(
    'userId', target_user_id,
    'credentialChangeRequired', true,
    'sessionsRevoked', revoked_session_count
  );
  insert into private.identity_command_results (
    scope, actor_user_id, idempotency_key, target_id, result
  ) values (
    'identity:admin-password-reset', actor_user_id, command_idempotency_key,
    target_user_id, result_payload
  );

  perform private.append_identity_audit_for_actor(
    actor_user_id, 'ADMIN_PASSWORD_RESET', 'profile', target_user_id,
    null,
    jsonb_build_object('credentialChangeRequired', true, 'sessionsRevoked', revoked_session_count),
    request_trace_id
  );

  return result_payload;
end;
$$;

revoke all on function public.accept_athlete_invitation(uuid, uuid) from public, anon;
grant execute on function public.accept_athlete_invitation(uuid, uuid) to authenticated;

revoke all on function public.set_user_role(uuid, public.app_role, boolean, uuid) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role, boolean, uuid) to authenticated;

revoke all on function public.complete_forced_password_change(uuid) from public, anon;
grant execute on function public.complete_forced_password_change(uuid) to authenticated;

revoke all on function public.consume_identity_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.create_identity_invite(uuid, uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.record_identity_invite_resend(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.revoke_identity_invite(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_admin_password_reset(uuid, uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.consume_identity_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.create_identity_invite(uuid, uuid, uuid, text, uuid, uuid) to service_role;
grant execute on function public.record_identity_invite_resend(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.revoke_identity_invite(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.complete_admin_password_reset(uuid, uuid, uuid, uuid) to service_role;

revoke all on function private.assert_service_identity_actor(uuid) from public, anon, authenticated;
revoke all on function private.append_identity_audit_for_actor(uuid, text, text, uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
