create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  kind public.notification_kind not null,
  resource_type text not null,
  resource_id uuid not null,
  deduplication_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  constraint notification_events_resource_type_format check (resource_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint notification_events_deduplication_key_format check (
    char_length(deduplication_key) between 8 and 512
    and deduplication_key = btrim(deduplication_key)
  ),
  constraint notification_events_payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint notification_events_payload_is_safe check (private.payload_is_safe(payload))
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events (id) on update restrict on delete restrict,
  user_id uuid not null references public.profiles (id) on update restrict on delete restrict,
  status public.notification_status not null default 'PENDING',
  attempt_count integer not null default 0,
  last_error_code text,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (event_id, user_id),
  constraint notification_deliveries_attempt_count_nonnegative check (attempt_count >= 0),
  constraint notification_deliveries_error_code_format check (
    last_error_code is null or last_error_code ~ '^[A-Z][A-Z0-9_]{2,63}$'
  ),
  constraint notification_deliveries_sent_at_matches_status check (
    (status = 'SENT' and sent_at is not null)
    or (status <> 'SENT' and sent_at is null)
  ),
  constraint notification_deliveries_updated_after_created check (updated_at >= created_at)
);

create index notification_deliveries_dispatch_idx
  on public.notification_deliveries (status, next_attempt_at, created_at)
  where status in ('PENDING', 'FAILED');

alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on public.notification_events, public.notification_deliveries from public, anon, authenticated;
