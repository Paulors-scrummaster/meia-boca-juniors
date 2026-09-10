-- Feature 003 · US4 (UX & Gamificação) · T081
-- Troféus conquistados. Preenchido só por `private.evaluate_trophies(...)` (T082,
-- roda dentro de `finalize_sumula`). Único por `(athlete, code, season)` — FR-021,
-- SC-011 — e permanente: nunca atualizado nem apagado (FR-027), garantido pelo
-- gatilho de imutabilidade do MVP.

create table public.athlete_trophies (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  trophy_code text not null references public.trophy_catalog (code) on update restrict on delete restrict,
  season_id uuid not null references public.seasons (id) on update restrict on delete restrict,
  awarded_at timestamptz not null default statement_timestamp(),
  trigger_context jsonb not null,
  unique (athlete_id, trophy_code, season_id),
  constraint athlete_trophies_trigger_context_is_object check (jsonb_typeof(trigger_context) = 'object')
);

create index athlete_trophies_athlete_idx on public.athlete_trophies (athlete_id);
create index athlete_trophies_season_code_idx on public.athlete_trophies (season_id, trophy_code);

create trigger guard_athlete_trophy_immutability
before update or delete on public.athlete_trophies
for each row execute function private.reject_statistics_history_mutation();

alter table public.athlete_trophies enable row level security;
revoke all on public.athlete_trophies from anon, authenticated;
grant select on public.athlete_trophies to authenticated;

create policy athlete_trophies_select_active_accounts on public.athlete_trophies
  for select to authenticated
  using (private.current_user_is_active());
