-- Feature 003 · US3 (Súmula Live) · T059
-- Estatística consolidada da súmula, ligada a `match_consolidations(id)` — mesma
-- ancoragem de `match_goals`. Preenchidas em bloco por `finalize_sumula` (B7) dentro da
-- mesma transação da consolidação, de modo que não há cópia posterior (SC-004).
-- Imutáveis após o fecho: herdam `private.reject_statistics_history_mutation` do MVP;
-- correção só via `reopen_statistics` + nova revisão (data-model.md §"Tabelas de
-- estatística consolidada").

create table public.match_cards (
  id uuid primary key default gen_random_uuid(),
  consolidation_id uuid not null references public.match_consolidations (id) on update restrict on delete restrict,
  athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  card_type public.card_type not null,
  minute smallint not null,
  constraint match_cards_minute_range check (minute between 0 and 200)
);

create table public.match_substitutions (
  id uuid primary key default gen_random_uuid(),
  consolidation_id uuid not null references public.match_consolidations (id) on update restrict on delete restrict,
  out_athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  in_athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  minute smallint not null,
  constraint match_substitutions_minute_range check (minute between 0 and 200),
  constraint match_substitutions_distinct_athletes check (in_athlete_id <> out_athlete_id)
);

create table public.match_goalkeeper_assignments (
  id uuid primary key default gen_random_uuid(),
  consolidation_id uuid not null references public.match_consolidations (id) on update restrict on delete restrict,
  athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  from_minute smallint not null,
  to_minute smallint,
  constraint match_goalkeeper_assignments_from_minute_nonnegative check (from_minute >= 0),
  constraint match_goalkeeper_assignments_window check (to_minute is null or to_minute > from_minute)
);

create index match_cards_consolidation_idx on public.match_cards (consolidation_id);
create index match_substitutions_consolidation_idx on public.match_substitutions (consolidation_id);
create index match_goalkeeper_assignments_consolidation_idx on public.match_goalkeeper_assignments (consolidation_id);

create trigger guard_match_card_immutability before update or delete on public.match_cards
for each row execute function private.reject_statistics_history_mutation();
create trigger guard_match_substitution_immutability before update or delete on public.match_substitutions
for each row execute function private.reject_statistics_history_mutation();
create trigger guard_match_goalkeeper_assignment_immutability before update or delete on public.match_goalkeeper_assignments
for each row execute function private.reject_statistics_history_mutation();

alter table public.match_cards enable row level security;
alter table public.match_substitutions enable row level security;
alter table public.match_goalkeeper_assignments enable row level security;
revoke all on public.match_cards, public.match_substitutions, public.match_goalkeeper_assignments from anon, authenticated;
grant select on public.match_cards, public.match_substitutions, public.match_goalkeeper_assignments to authenticated;

create policy match_cards_select_active_accounts on public.match_cards
  for select to authenticated using (private.current_user_is_active());
create policy match_substitutions_select_active_accounts on public.match_substitutions
  for select to authenticated using (private.current_user_is_active());
create policy match_goalkeeper_assignments_select_active_accounts on public.match_goalkeeper_assignments
  for select to authenticated using (private.current_user_is_active());
