-- Feature 003 · US4 (UX & Gamificação) · T080
-- Catálogo fixo dos cinco troféus (FR-021c). Seed estático, sem CRUD: alterar o
-- catálogo = nova migração. `threshold` segue a tabela de gatilhos do
-- `contracts/gamification.md` (ARTILHEIRO/GARCOM/VETERANO ≥ 10, MURALHA ≥ 5,
-- HAT_TRICK ≥ 3) — a linha "10 / 10 / 10 / 5 / 3" do data-model desalinha os
-- rótulos e é substituída pelos gatilhos detalhados, que são consistentes.

create type public.trophy_scope as enum ('SEASON_CUMULATIVE', 'SINGLE_MATCH');

create table public.trophy_catalog (
  code text primary key,
  title_pt text not null,
  description_pt text not null,
  scope public.trophy_scope not null,
  threshold integer not null,
  display_order integer not null unique,
  constraint trophy_catalog_code_format check (code ~ '^[A-Z][A-Z0-9_]{2,31}$'),
  constraint trophy_catalog_threshold_positive check (threshold > 0),
  constraint trophy_catalog_title_not_blank check (char_length(btrim(title_pt)) between 1 and 60),
  constraint trophy_catalog_description_not_blank check (char_length(btrim(description_pt)) between 1 and 240)
);

insert into public.trophy_catalog (code, title_pt, description_pt, scope, threshold, display_order) values
  ('ARTILHEIRO', 'Artilheiro', 'Marcou 10 gols ou mais na temporada.', 'SEASON_CUMULATIVE', 10, 1),
  ('GARCOM', 'Garçom', 'Deu 10 assistências ou mais na temporada.', 'SEASON_CUMULATIVE', 10, 2),
  ('HAT_TRICK', 'Hat-trick', 'Marcou 3 gols ou mais em uma única partida finalizada.', 'SINGLE_MATCH', 3, 3),
  ('VETERANO', 'Veterano', 'Jogou 10 partidas finalizadas ou mais na temporada.', 'SEASON_CUMULATIVE', 10, 4),
  ('MURALHA', 'Muralha', 'Fez 5 jogos sem sofrer gols como goleiro na temporada.', 'SEASON_CUMULATIVE', 5, 5);

alter table public.trophy_catalog enable row level security;
revoke all on public.trophy_catalog from anon, authenticated;
grant select on public.trophy_catalog to authenticated;

create policy trophy_catalog_select_active_accounts on public.trophy_catalog
  for select to authenticated
  using (private.current_user_is_active());
