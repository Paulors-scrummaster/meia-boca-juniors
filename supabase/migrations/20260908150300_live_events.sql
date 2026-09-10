-- Feature 003 · US3 (Súmula Live) · T058
-- `live_match_events`: fluxo append-only de eventos do cronômetro. Undo é soft
-- (`undone=true`), nunca DELETE (trilha de auditoria — data-model.md §"Undo"). A
-- coluna `client_event_id` é `unique`: o clique gera o id no cliente e a sincronização
-- offline reenvia com `on conflict (client_event_id) do nothing` (B6 `log_live_event`,
-- FR-037a). Edição de `minute`/autor só na revisão (`amend_live_event`, B6).
--
-- Escrita apenas por RPC `security definer`; `authenticated` só lê (RLS) — é o que a
-- assinatura Realtime dos torcedores/atletas consome.

create table public.live_match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on update restrict on delete restrict,
  client_event_id uuid not null,
  minute smallint not null,
  event_type public.live_event_type not null,
  athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  target_athlete_id uuid references public.athletes (id) on update restrict on delete restrict,
  team_side public.team_side not null default 'MBJ',
  recorded_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  recorded_at timestamptz not null default statement_timestamp(),
  undone boolean not null default false,
  undone_at timestamptz,
  constraint live_match_events_client_event_id_key unique (client_event_id),
  constraint live_match_events_minute_range check (minute between 0 and 200),
  constraint live_match_events_target_differs check (
    target_athlete_id is null or target_athlete_id <> athlete_id
  ),
  constraint live_match_events_substitution_has_target check (
    event_type <> 'SUBSTITUTION' or target_athlete_id is not null
  ),
  constraint live_match_events_undone_metadata check (
    (undone = false and undone_at is null)
    or (undone = true and undone_at is not null)
  )
);

create index live_match_events_match_recorded_idx
  on public.live_match_events (match_id, recorded_at desc);
create index live_match_events_match_active_idx
  on public.live_match_events (match_id) where not undone;

create or replace function private.reject_live_event_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception using errcode = '55000', message = 'live match events are append-only (use undo)';
end;
$$;

create trigger guard_live_match_events_no_delete
before delete on public.live_match_events
for each row execute function private.reject_live_event_delete();

alter table public.live_match_events enable row level security;
revoke all on public.live_match_events from anon, authenticated;
grant select on public.live_match_events to authenticated;

create policy live_match_events_select_active_accounts on public.live_match_events
  for select to authenticated
  using (private.current_user_is_active());

-- Realtime: Postgres Changes em `public.live_match_events`; o cliente assina com filtro
-- `match_id=eq.<uuid>` (R7, FR-031, SC-003). `replica identity full` para que a virada de
-- `undone` também chegue com a linha completa.
alter table public.live_match_events replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'live_match_events'
  ) then
    alter publication supabase_realtime add table public.live_match_events;
  end if;
end;
$$;
