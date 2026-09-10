-- Feature 003 · US1 (Financeiro) · T019
-- Tabelas do ledger interno: configuração de mensalidade (singleton), isenções e
-- cobranças. Escritas só por RPCs `security definer` (padrão do MVP: `grant select`
-- para `authenticated`, sem DML; a função definer escreve fora do RLS).

-- Configuração club-wide do valor padrão da mensalidade (linha única).
create table public.dues_settings (
  id boolean primary key default true,
  default_amount numeric(10, 2) not null,
  updated_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  updated_at timestamptz not null default statement_timestamp(),
  constraint dues_settings_singleton check (id),
  constraint dues_settings_amount_positive check (default_amount > 0)
);

-- Isenções por atleta. `period` NULL = isenção indefinida (aplica todo período
-- até ser removida).
create table public.dues_exemptions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  period text,
  reason text not null,
  created_by uuid not null references public.profiles (id) on update restrict on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  constraint dues_exemptions_period_format check (period is null or period ~ '^\d{4}-\d{2}$'),
  constraint dues_exemptions_reason_format check (
    char_length(btrim(reason)) between 1 and 500 and reason = btrim(reason)
  )
);

create unique index dues_exemptions_athlete_period_key
  on public.dues_exemptions (athlete_id, period) where period is not null;
create unique index dues_exemptions_athlete_indefinite_key
  on public.dues_exemptions (athlete_id) where period is null;

-- Cobranças.
create table public.athlete_charges (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes (id) on update restrict on delete restrict,
  season_id uuid not null references public.seasons (id) on update restrict on delete restrict,
  amount numeric(10, 2) not null,
  due_date date not null,
  status public.charge_status not null default 'PENDING',
  type public.charge_type not null,
  period text,
  -- FK adicionada na US2, quando `public.social_events` existir.
  social_event_id uuid,
  settled_by uuid references public.profiles (id) on update restrict on delete restrict,
  settled_at timestamptz,
  created_by uuid references public.profiles (id) on update restrict on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint athlete_charges_amount_positive check (amount > 0),
  constraint athlete_charges_period_format check (period is null or period ~ '^\d{4}-\d{2}$'),
  constraint athlete_charges_period_matches_type check (
    (type = 'MONTHLY_AUTOMATIC') = (period is not null)
  ),
  constraint athlete_charges_event_link_only_for_event_fee check (
    social_event_id is null or type = 'EVENT_FEE'
  ),
  constraint athlete_charges_settlement_metadata check (
    (status = 'PAID' and settled_by is not null and settled_at is not null)
    or (status <> 'PAID' and settled_by is null and settled_at is null)
  ),
  constraint athlete_charges_updated_after_created check (updated_at >= created_at)
);

-- Idempotência da geração mensal: no máximo uma cobrança automática por atleta/período.
create unique index athlete_charges_monthly_period_key
  on public.athlete_charges (athlete_id, period)
  where type = 'MONTHLY_AUTOMATIC';

create index athlete_charges_athlete_status_idx on public.athlete_charges (athlete_id, status);
create index athlete_charges_pending_due_idx
  on public.athlete_charges (due_date) where status = 'PENDING';
create index athlete_charges_season_type_period_idx
  on public.athlete_charges (season_id, type, period);

alter table public.dues_settings enable row level security;
alter table public.dues_exemptions enable row level security;
alter table public.athlete_charges enable row level security;

revoke all on public.dues_settings, public.dues_exemptions, public.athlete_charges
  from anon, authenticated;
grant select on public.dues_settings, public.dues_exemptions, public.athlete_charges
  to authenticated;

-- Diretoria (PRESIDENT) enxerga tudo; atleta enxerga apenas as próprias linhas.
create policy dues_settings_select_staff on public.dues_settings
  for select to authenticated
  using (private.has_any_role(array['PRESIDENT', 'COACH']::public.app_role[]));

create policy dues_exemptions_select_scoped on public.dues_exemptions
  for select to authenticated
  using (
    private.has_role('PRESIDENT')
    or exists (
      select 1 from public.athletes a
      where a.id = dues_exemptions.athlete_id and a.user_id = auth.uid()
    )
  );

create policy athlete_charges_select_scoped on public.athlete_charges
  for select to authenticated
  using (
    private.has_role('PRESIDENT')
    or exists (
      select 1 from public.athletes a
      where a.id = athlete_charges.athlete_id and a.user_id = auth.uid()
    )
  );
