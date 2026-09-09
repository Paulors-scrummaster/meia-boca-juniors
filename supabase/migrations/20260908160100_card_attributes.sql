-- Feature 003 · US4 (UX & Gamificação) · T079
-- Atributos do cartão colecionável, 1:1 com o atleta. `overall` é coluna gerada
-- (média aritmética simples dos seis, arredondada — R4); é `null` enquanto
-- qualquer atributo for `null`, o que a UI mostra como cartão "incompleto"
-- (FR-020, SC-009). Escrita só via `set_athlete_attributes` (T083); contas ativas
-- leem (o cartão é público ao elenco).

create table public.athlete_card_attributes (
  athlete_id uuid primary key references public.athletes (id) on update restrict on delete restrict,
  pace smallint,
  shooting smallint,
  passing smallint,
  dribbling smallint,
  defending smallint,
  physical smallint,
  overall smallint generated always as (
    case
      when pace is null or shooting is null or passing is null
        or dribbling is null or defending is null or physical is null
      then null
      else round((pace + shooting + passing + dribbling + defending + physical) / 6.0)
    end
  ) stored,
  updated_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  updated_at timestamptz not null default statement_timestamp(),
  constraint athlete_card_attributes_pace_range check (pace is null or pace between 1 and 99),
  constraint athlete_card_attributes_shooting_range check (shooting is null or shooting between 1 and 99),
  constraint athlete_card_attributes_passing_range check (passing is null or passing between 1 and 99),
  constraint athlete_card_attributes_dribbling_range check (dribbling is null or dribbling between 1 and 99),
  constraint athlete_card_attributes_defending_range check (defending is null or defending between 1 and 99),
  constraint athlete_card_attributes_physical_range check (physical is null or physical between 1 and 99)
);

alter table public.athlete_card_attributes enable row level security;
revoke all on public.athlete_card_attributes from anon, authenticated;
grant select on public.athlete_card_attributes to authenticated;

create policy athlete_card_attributes_select_active_accounts on public.athlete_card_attributes
  for select to authenticated
  using (private.current_user_is_active());
