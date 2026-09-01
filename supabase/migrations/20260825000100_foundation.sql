create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create type public.app_role as enum ('PRESIDENT', 'COACH', 'ATHLETE');
create type public.account_status as enum ('ACTIVE', 'DISABLED');
create type public.athlete_status as enum ('ACTIVE', 'INJURED', 'SUSPENDED', 'INACTIVE');
create type public.match_status as enum ('SCHEDULED', 'COMPLETED', 'CANCELLED');
create type public.call_status as enum ('CALLED', 'NOT_CALLED');
create type public.presence_status as enum ('PENDING', 'CONFIRMED', 'DECLINED');
create type public.lineup_status as enum ('DRAFT', 'PUBLISHED', 'SUPERSEDED');
create type public.lineup_assignment as enum ('STARTER', 'RESERVE');
create type public.voting_round_status as enum ('OPEN', 'CLOSED', 'INVALIDATED');
create type public.notification_status as enum ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED');
create type public.notification_kind as enum (
  'CALL_UP',
  'DEADLINE_24H',
  'DEADLINE_6H',
  'MATCH_CHANGED',
  'LINEUP_PUBLISHED',
  'VOTING_OPENED',
  'NOTICE_PUBLISHED'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on update restrict on delete restrict,
  account_status public.account_status not null default 'ACTIVE',
  must_change_password boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  disabled_at timestamptz,
  constraint profiles_disabled_at_matches_status check (
    (account_status = 'DISABLED' and disabled_at is not null)
    or (account_status = 'ACTIVE' and disabled_at is null)
  ),
  constraint profiles_updated_after_created check (updated_at >= created_at)
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on update restrict on delete restrict,
  role public.app_role not null,
  assigned_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  assigned_at timestamptz not null default statement_timestamp(),
  primary key (user_id, role)
);

create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on update restrict on delete set null,
  full_name text not null,
  shirt_name text not null,
  shirt_number smallint not null,
  primary_position text not null,
  status public.athlete_status not null default 'ACTIVE',
  photo_path text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  inactivated_at timestamptz,
  anonymized_at timestamptz,
  constraint athletes_full_name_format check (
    char_length(full_name) between 2 and 120
    and full_name = btrim(full_name)
    and full_name !~ '\\s{2,}'
  ),
  constraint athletes_shirt_name_format check (
    char_length(shirt_name) between 1 and 40
    and shirt_name = btrim(shirt_name)
    and shirt_name !~ '\\s{2,}'
  ),
  constraint athletes_shirt_number_range check (shirt_number between 1 and 99),
  constraint athletes_primary_position_format check (
    char_length(primary_position) between 2 and 40
    and primary_position = btrim(primary_position)
    and primary_position !~ '\\s{2,}'
  ),
  constraint athletes_photo_path_format check (
    photo_path is null
    or (
      char_length(photo_path) between 1 and 512
      and photo_path = btrim(photo_path)
      and photo_path !~ '^(https?:)?//'
      and photo_path !~ '(^|/)\.\.(/|$)'
    )
  ),
  constraint athletes_inactivated_at_matches_status check (
    (status = 'INACTIVE' and inactivated_at is not null)
    or (status <> 'INACTIVE' and inactivated_at is null)
  ),
  constraint athletes_updated_after_created check (updated_at >= created_at)
);

create unique index athletes_active_shirt_number_key
  on public.athletes (shirt_number)
  where status <> 'INACTIVE' and anonymized_at is null;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles (id) on update restrict on delete restrict,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  before_state jsonb,
  after_state jsonb,
  trace_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint audit_logs_action_format check (action ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  constraint audit_logs_resource_type_format check (resource_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint audit_logs_state_is_object check (
    (before_state is null or jsonb_typeof(before_state) = 'object')
    and (after_state is null or jsonb_typeof(after_state) = 'object')
  )
);

create or replace function private.reject_audit_log_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'audit logs are immutable';
end;
$$;

create trigger audit_logs_are_immutable
before update or delete on public.audit_logs
for each row execute function private.reject_audit_log_mutation();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.athletes enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.profiles, public.user_roles, public.athletes, public.audit_logs from anon, authenticated;
grant select on public.profiles, public.user_roles, public.athletes, public.audit_logs to authenticated;
