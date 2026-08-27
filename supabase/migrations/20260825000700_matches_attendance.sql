create table private.command_results (
  command_name text not null,
  actor_user_id uuid not null,
  idempotency_key uuid not null,
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (command_name, actor_user_id, idempotency_key),
  constraint command_results_name_format check (command_name ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint command_results_result_is_object check (jsonb_typeof(result) = 'object')
);

revoke all on private.command_results from public, anon, authenticated;

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  year integer not null unique,
  is_active boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  constraint seasons_year_is_four_digits check (year between 1000 and 9999)
);

create unique index seasons_one_active_key on public.seasons (is_active) where is_active;

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on update restrict on delete restrict,
  opponent_name text not null,
  competition_name text,
  location_name text,
  match_date timestamptz not null,
  confirmation_deadline timestamptz not null,
  status public.match_status not null default 'SCHEDULED',
  schedule_revision integer not null default 1,
  current_consolidation_id uuid,
  created_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  updated_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint matches_opponent_format check (
    char_length(opponent_name) between 2 and 120
    and opponent_name = btrim(opponent_name)
    and opponent_name !~ '[[:space:]]{2,}'
  ),
  constraint matches_competition_format check (
    competition_name is null
    or (char_length(competition_name) between 1 and 120 and competition_name = btrim(competition_name))
  ),
  constraint matches_location_format check (
    location_name is null
    or (char_length(location_name) between 1 and 160 and location_name = btrim(location_name))
  ),
  constraint matches_deadline_before_kickoff check (confirmation_deadline < match_date),
  constraint matches_schedule_revision_positive check (schedule_revision > 0),
  constraint matches_updated_after_created check (updated_at >= created_at)
);

create index matches_season_date_idx on public.matches (season_id, match_date desc);
create index matches_next_scheduled_idx on public.matches (match_date) where status = 'SCHEDULED';

create table public.match_presences (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on update restrict on delete restrict,
  athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  call_status public.call_status not null default 'NOT_CALLED',
  presence_status public.presence_status not null default 'PENDING',
  called_at timestamptz,
  call_revision integer not null default 0,
  is_exceptional_call boolean not null default false,
  individual_deadline timestamptz,
  responded_at timestamptz,
  last_changed_by uuid references public.profiles (id) on update restrict on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (match_id, athlete_id),
  constraint match_presences_call_revision_nonnegative check (call_revision >= 0),
  constraint match_presences_call_revision_timestamp check (
    (call_revision = 0 and called_at is null and call_status = 'NOT_CALLED')
    or (call_revision > 0 and called_at is not null)
  ),
  constraint match_presences_exceptional_deadline check (
    (not is_exceptional_call and individual_deadline is null)
    or (
      is_exceptional_call
      and call_status = 'CALLED'
      and individual_deadline is not null
      and called_at is not null
      and individual_deadline > called_at
    )
  ),
  constraint match_presences_response_timestamp check (
    (presence_status = 'PENDING' and responded_at is null)
    or (presence_status <> 'PENDING' and responded_at is not null)
  ),
  constraint match_presences_updated_after_created check (updated_at >= created_at)
);

create index match_presences_match_status_idx
  on public.match_presences (match_id, call_status, presence_status);

create table public.presence_justifications (
  presence_id uuid primary key references public.match_presences (id) on update restrict on delete cascade,
  reason text not null,
  created_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint presence_justifications_reason_format check (
    char_length(reason) between 1 and 500
    and reason = btrim(reason)
    and reason !~ '[[:space:]]{2,}'
  ),
  constraint presence_justifications_updated_after_created check (updated_at >= created_at)
);

create or replace function private.validate_match_presence_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  presence_record public.match_presences%rowtype;
  kickoff_at timestamptz;
  target_presence_id uuid;
begin
  if tg_table_name = 'match_presences' then
    target_presence_id := new.id;
  elsif tg_op = 'DELETE' then
    target_presence_id := old.presence_id;
  else
    target_presence_id := new.presence_id;
  end if;

  select * into presence_record
  from public.match_presences
  where id = target_presence_id;

  if not found then return null; end if;

  if presence_record.is_exceptional_call then
    select match_date into kickoff_at from public.matches where id = presence_record.match_id;
    if presence_record.individual_deadline > kickoff_at then
      raise exception using errcode = '23514', message = 'exceptional deadline must not exceed kickoff';
    end if;
  end if;

  if presence_record.presence_status = 'DECLINED'
    and not exists (
      select 1 from public.presence_justifications where presence_id = presence_record.id
    ) then
    raise exception using errcode = '23514', message = 'declined presence requires a reason';
  end if;

  if presence_record.presence_status <> 'DECLINED'
    and exists (
      select 1 from public.presence_justifications where presence_id = presence_record.id
    ) then
    raise exception using errcode = '23514', message = 'only declined presence may keep a reason';
  end if;

  return null;
end;
$$;

create constraint trigger match_presences_integrity_at_commit
after insert or update on public.match_presences
deferrable initially deferred
for each row execute function private.validate_match_presence_integrity();

create constraint trigger presence_justifications_integrity_at_commit
after insert or update or delete on public.presence_justifications
deferrable initially deferred
for each row execute function private.validate_match_presence_integrity();

alter table public.seasons enable row level security;
alter table public.matches enable row level security;
alter table public.match_presences enable row level security;
alter table public.presence_justifications enable row level security;

revoke all on public.seasons, public.matches, public.match_presences, public.presence_justifications
from public, anon, authenticated;
grant select on public.seasons, public.matches, public.match_presences, public.presence_justifications
to authenticated;

create policy seasons_select_active_accounts
on public.seasons for select to authenticated
using (private.current_user_is_active());

create policy matches_select_active_accounts
on public.matches for select to authenticated
using (private.current_user_is_active());

create policy match_presences_select_active_accounts
on public.match_presences for select to authenticated
using (private.current_user_is_active());

create policy presence_justifications_select_owner_or_staff
on public.presence_justifications for select to authenticated
using (
  private.current_user_is_active()
  and (
    private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[])
    or exists (
      select 1
      from public.match_presences mp
      join public.athletes a on a.id = mp.athlete_id
      where mp.id = presence_justifications.presence_id
        and a.user_id = auth.uid()
        and private.has_role('ATHLETE')
    )
  )
);

create or replace function private.require_staff_aal2()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if not private.current_session_is_aal2() then
    raise exception using errcode = '42501', message = 'MFA_REQUIRED';
  end if;
end;
$$;

create or replace function private.enqueue_notification(
  event_kind public.notification_kind,
  resource_kind text,
  resource_uuid uuid,
  event_deduplication_key text,
  event_payload jsonb,
  recipient_user_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_uuid uuid;
begin
  insert into public.notification_events (
    kind, resource_type, resource_id, deduplication_key, payload
  ) values (
    event_kind, resource_kind, resource_uuid, event_deduplication_key, event_payload
  )
  on conflict (deduplication_key) do update
    set deduplication_key = excluded.deduplication_key
  returning id into event_uuid;

  insert into public.notification_deliveries (event_id, user_id)
  select event_uuid, recipient_id
  from unnest(coalesce(recipient_user_ids, '{}'::uuid[])) recipient_id
  where recipient_id is not null
  on conflict (event_id, user_id) do nothing;

  return event_uuid;
end;
$$;

create or replace function public.create_match(
  season_uuid uuid,
  opponent_name_input text,
  match_date_input timestamptz,
  confirmation_deadline_input timestamptz,
  competition_name_input text,
  location_name_input text,
  command_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cached_result jsonb;
  created_match public.matches%rowtype;
  result_value jsonb;
begin
  perform private.require_staff_aal2();

  select result into cached_result
  from private.command_results
  where command_name = 'create_match'
    and actor_user_id = auth.uid()
    and idempotency_key = command_idempotency_key;
  if found then return cached_result; end if;

  insert into public.matches (
    season_id, opponent_name, competition_name, location_name,
    match_date, confirmation_deadline, created_by, updated_by
  ) values (
    season_uuid,
    regexp_replace(btrim(opponent_name_input), '[[:space:]]+', ' ', 'g'),
    nullif(regexp_replace(btrim(coalesce(competition_name_input, '')), '[[:space:]]+', ' ', 'g'), ''),
    nullif(regexp_replace(btrim(coalesce(location_name_input, '')), '[[:space:]]+', ' ', 'g'), ''),
    match_date_input, confirmation_deadline_input, auth.uid(), auth.uid()
  ) returning * into created_match;

  perform private.append_audit_log(
    'MATCH_CREATED', 'match', created_match.id, null,
    jsonb_build_object('status', created_match.status, 'scheduleRevision', created_match.schedule_revision),
    command_idempotency_key
  );

  result_value := to_jsonb(created_match);
  insert into private.command_results values (
    'create_match', auth.uid(), command_idempotency_key, result_value, statement_timestamp()
  );
  return result_value;
end;
$$;

revoke all on function public.create_match(uuid, text, timestamptz, timestamptz, text, text, uuid)
from public, anon;
grant execute on function public.create_match(uuid, text, timestamptz, timestamptz, text, text, uuid)
to authenticated;
