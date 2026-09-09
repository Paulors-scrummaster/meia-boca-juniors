-- Feature 003 · US2 (Resenha / Churrasco) · T039
-- Eventos sociais desacoplados de partidas + presenças com acompanhantes.
-- Escrita só por RPC `security definer`; `authenticated` só lê (RLS).

create table public.social_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_at timestamptz not null,
  location_name text not null,
  total_cost numeric(10, 2) not null,
  status public.social_event_status not null default 'OPEN',
  frozen_cost_per_person numeric(10, 2),
  frozen_people_count integer,
  closed_by uuid references public.profiles (id) on update restrict on delete restrict,
  closed_at timestamptz,
  created_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint social_events_title_format check (
    char_length(btrim(title)) between 2 and 120
    and title = btrim(title)
    and title !~ '[[:space:]]{2,}'
  ),
  constraint social_events_location_format check (
    char_length(btrim(location_name)) between 1 and 160 and location_name = btrim(location_name)
  ),
  constraint social_events_total_cost_nonnegative check (total_cost >= 0),
  constraint social_events_frozen_metadata check (
    (status = 'OPEN' and frozen_cost_per_person is null and frozen_people_count is null
      and closed_by is null and closed_at is null)
    or (status = 'CLOSED' and frozen_cost_per_person is not null and frozen_people_count is not null
      and closed_by is not null and closed_at is not null)
  ),
  constraint social_events_frozen_people_count_nonnegative check (
    frozen_people_count is null or frozen_people_count >= 0
  ),
  constraint social_events_updated_after_created check (updated_at >= created_at)
);

create index social_events_status_date_idx on public.social_events (status, event_at desc);

create table public.social_event_presences (
  id uuid primary key default gen_random_uuid(),
  social_event_id uuid not null references public.social_events (id) on update restrict on delete restrict,
  athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  status public.event_presence_status not null,
  guests_count integer not null default 0,
  frozen_share numeric(10, 2),
  responded_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (social_event_id, athlete_id),
  constraint social_event_presences_guests_count_range check (guests_count between 0 and 20),
  constraint social_event_presences_updated_after_responded check (updated_at >= responded_at)
);

create index social_event_presences_event_status_idx
  on public.social_event_presences (social_event_id, status);

-- FK adiada da US1: cobranças EVENT_FEE podem referenciar um evento social.
alter table public.athlete_charges
  add constraint athlete_charges_social_event_fk
  foreign key (social_event_id) references public.social_events (id)
  on update restrict on delete restrict;

alter table public.social_events enable row level security;
alter table public.social_event_presences enable row level security;

revoke all on public.social_events, public.social_event_presences from anon, authenticated;
grant select on public.social_events, public.social_event_presences to authenticated;

create policy social_events_select_active_accounts on public.social_events
  for select to authenticated
  using (private.current_user_is_active());

create policy social_event_presences_select_scoped on public.social_event_presences
  for select to authenticated
  using (
    private.has_role('PRESIDENT')
    or exists (
      select 1 from public.athletes a
      where a.id = social_event_presences.athlete_id and a.user_id = auth.uid()
    )
  );
