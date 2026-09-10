# Phase 1 — Data Model: Post-MVP Modules Expansion (MBJ)

Convenções do MVP mantidas: `public.` para tabelas de domínio, `private.` para helpers/funções,
`snake_case`, PKs `id uuid default gen_random_uuid()`, tabelas no plural, FKs reais com
`on update restrict on delete restrict`, `created_at/updated_at timestamptz`, RLS habilitada e
`revoke all ... from public, anon, authenticated` + `grant select` seletivo. Toda escrita
privilegiada passa por função `security definer` com checagem de papel/AAL2 e cache em
`private.command_results`. Enums e status vêm de tipos PostgreSQL centralizados.

Papéis: `PRESIDENT`, `COACH`, `ATHLETE` (enum `public.app_role`, inalterado).

---

## Extensão: `public.seasons`

| Coluna | Tipo | Regras |
|---|---|---|
| `starts_on` | `date not null` | default `date_trunc('year', now())` na migração para linhas existentes |
| `ends_on` | `date` | nulo enquanto `status='ACTIVE'`; `>= starts_on` quando preenchido |
| `status` | `public.season_status` | enum novo `('ACTIVE','CLOSED')`; default `'CLOSED'` |

- Mantém `seasons_one_active_key` (índice parcial único em `is_active`).
- Trigger `sync_season_is_active`: `is_active := (status = 'ACTIVE')` — preserva consultas do MVP.
- Constraint: `ends_on is null when status='ACTIVE'`; `ends_on is not null when status='CLOSED'`.
- **Transições**: `CLOSED → ACTIVE` (via `open_season`, exige nenhuma outra ACTIVE) ;
  `ACTIVE → CLOSED` (via `close_season`). Sem outra transição. Histórico da temporada anterior
  intocado ao abrir a próxima.

---

## Módulo 1 — Financeiro

### `public.dues_settings` (linha única)

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `boolean primary key default true` | `check (id)` — garante linha única (padrão singleton) |
| `default_amount` | `numeric(10,2) not null` | `> 0` |
| `updated_by` | `uuid not null → profiles(id)` | |
| `updated_at` | `timestamptz not null` | |

- RLS: `select` para contas ativas; escrita só via RPC `set_default_dues_amount` (PRESIDENT+AAL2).
- Alterar o valor **não** afeta cobranças já geradas (FR-009).

### `public.dues_exemptions`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `uuid` | |
| `athlete_id` | `uuid not null → athletes(id)` | |
| `period` | `text` | `~ '^\d{4}-\d{2}$'`; **nulo = isenção indefinida** (aplica todo período até remoção) |
| `reason` | `text not null` | 1–500, trim |
| `created_by` | `uuid not null → profiles(id)` | |
| `created_at` | `timestamptz` | |

- Unicidade: `unique (athlete_id, period)` + índice parcial `unique (athlete_id) where period is null`.
- A geração mensal pula o atleta se existir isenção para o `period` alvo **ou** isenção indefinida.

### `public.athlete_charges`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `uuid` | |
| `athlete_id` | `uuid not null → athletes(id)` | |
| `season_id` | `uuid not null → seasons(id)` | temporada ativa no momento da criação |
| `amount` | `numeric(10,2) not null` | `> 0` |
| `due_date` | `date not null` | |
| `status` | `public.charge_status not null` | enum `('PENDING','PAID','OVERDUE','CANCELLED')`, default `'PENDING'` |
| `type` | `public.charge_type not null` | enum `('MONTHLY_AUTOMATIC','MANUAL_OVERRIDE','EVENT_FEE')` |
| `period` | `text` | `~ '^\d{4}-\d{2}$'`; obrigatório quando `type='MONTHLY_AUTOMATIC'`, senão nulo |
| `social_event_id` | `uuid → social_events(id)` | preenchido só se `type='EVENT_FEE'` |
| `settled_by` | `uuid → profiles(id)` | não-nulo sse `status='PAID'` |
| `settled_at` | `timestamptz` | idem |
| `created_by` | `uuid → profiles(id)` | nulo para geração automática (ator = sistema/cron) |
| `created_at` | `timestamptz not null` | |
| `updated_at` | `timestamptz not null` | `>= created_at` |

- **Idempotência mensal**: `unique (athlete_id, period) where type = 'MONTHLY_AUTOMATIC'`.
- **Máquina de estado** (só via RPC, cada transição → `append_audit_log` com `reason`):
  - `PENDING ⇄ OVERDUE` — automático pelo cron diário (`due_date < current_date`).
  - `PENDING|OVERDUE → PAID` — `settle_charge` (PRESIDENT+AAL2), grava `settled_by/at`.
  - `PAID → PENDING|OVERDUE` — `reverse_charge_settlement`; alvo = `OVERDUE` se `due_date <
    current_date`, senão `PENDING`; limpa `settled_by/at`.
  - `PENDING|OVERDUE|PAID → CANCELLED` — `cancel_charge`; estado final.
  - `CANCELLED` — sem saída.
- **Badge de inadimplência** (FR-005, FR-1.3): atleta é "Pendente" se tem ≥1 `PENDING`, "Em Atraso"
  se tem ≥1 `OVERDUE`; `CANCELLED` e `PAID` nunca contam (SC-015). O badge é apenas visual — nenhuma
  policy RLS de partidas/escalação/votação consulta `athlete_charges` (FR-006, SC-006).
- **Totais financeiros** excluem `CANCELLED`.
- RLS: PRESIDENT lê tudo; `ATHLETE` lê só as próprias linhas
  (`exists (select 1 from athletes a where a.id = athlete_id and a.user_id = auth.uid())`).
- Trigger de imutabilidade parcial: fora dos RPCs, `update`/`delete` direto é rejeitado.

---

## Módulo 2 — Resenha / Churrasco

### `public.social_events`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `uuid` | |
| `title` | `text not null` | 2–120, trim, sem espaço duplo |
| `event_at` | `timestamptz not null` | armazenado em UTC |
| `location_name` | `text not null` | 1–160, trim |
| `total_cost` | `numeric(10,2) not null` | `>= 0` |
| `status` | `public.social_event_status not null` | enum `('OPEN','CLOSED')`, default `'OPEN'` |
| `frozen_cost_per_person` | `numeric(10,2)` | preenchido só quando `CLOSED` |
| `frozen_people_count` | `integer` | idem; `>= 0` |
| `closed_by` | `uuid → profiles(id)` | idem |
| `closed_at` | `timestamptz` | idem |
| `created_by` | `uuid not null → profiles(id)` | PRESIDENT |
| `created_at` / `updated_at` | `timestamptz` | |

- **`cost_per_person` enquanto `OPEN`**: derivado por função
  `public.social_event_split(event_id)` → `{ people_count, cost_per_person, split_unavailable }`.
  `people_count = coalesce(sum(1 + guests_count) filter (where status='CONFIRMED'), 0)`.
  Se `people_count = 0` → `cost_per_person = null`, `split_unavailable = true` (FR-016).
- **Fechamento** (`close_social_event`, PRESIDENT+AAL2, transacional): calcula `people_count`,
  `base = floor(total_cost * 100 / people_count)` centavos, distribui o resto `r = total_cost*100 -
  base*people_count` adicionando 1 centavo às `r` primeiras cotas (ordem determinística por
  `athlete_id`) — garante `Σ cotas = total_cost` exatamente (SC-002). Grava `frozen_*`, muda
  `status='CLOSED'`. Não cria `athlete_charges` (FR-017).
- RLS: contas ativas leem; escrita só via RPC.

### `public.social_event_presences`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `uuid` | |
| `social_event_id` | `uuid not null → social_events(id)` | |
| `athlete_id` | `uuid not null → athletes(id)` | |
| `status` | `public.event_presence_status not null` | enum `('CONFIRMED','DECLINED')` |
| `guests_count` | `integer not null default 0` | `check (guests_count between 0 and 20)` — cap decidido: 20 acompanhantes por atleta por evento (Clarificação 2026-09-08, spec FR-012) |
| `responded_at` | `timestamptz not null` | |
| `updated_at` | `timestamptz not null` | |

- Unicidade: `unique (social_event_id, athlete_id)`.
- Escrita via RPC `set_event_presence(event_id, status, guests_count)`: o próprio atleta; permitido
  só enquanto o evento está `OPEN` (mudança após `CLOSED` é registrada mas não altera `frozen_*` —
  E-02; nesta fase o RPC simplesmente rejeita com `EVENT_CLOSED` se `CLOSED`).
- RLS: atleta lê/gerencia a própria linha; PRESIDENT lê todas do evento.

---

## Módulo 3 — UX & Gamificação

### `public.athlete_card_attributes` (1:1 com atleta)

| Coluna | Tipo | Regras |
|---|---|---|
| `athlete_id` | `uuid primary key → athletes(id)` | |
| `pace` `shooting` `passing` `dribbling` `defending` `physical` | `smallint` | cada `null` ou `between 1 and 99` |
| `overall` | `smallint generated always as (case when pace is null or shooting is null or passing is null or dribbling is null or defending is null or physical is null then null else round((pace+shooting+passing+dribbling+defending+physical)/6.0) end) stored` | — |
| `updated_by` | `uuid not null → profiles(id)` | |
| `updated_at` | `timestamptz not null` | |

- Cartão exibe estado "incompleto" quando `overall is null` (FR-020, SC-009).
- Escrita via RPC `set_athlete_attributes(...)` — COACH/PRESIDENT+AAL2, `append_audit_log`.
- RLS: contas ativas leem (o cartão é público ao elenco); escrita só via RPC.

### `public.trophy_catalog` (seed estático, sem CRUD)

| Coluna | Tipo | Conteúdo |
|---|---|---|
| `code` | `text primary key` | `ARTILHEIRO`, `GARCOM`, `HAT_TRICK`, `VETERANO`, `MURALHA` |
| `title_pt` | `text not null` | rótulo pt-BR |
| `description_pt` | `text not null` | regra do gatilho em pt-BR |
| `scope` | `public.trophy_scope not null` | `SEASON_CUMULATIVE` (Artilheiro/Garçom/Veterano/Muralha) ou `SINGLE_MATCH` (Hat-trick) |
| `threshold` | `integer not null` | 10 / 10 / 10 / 5 / 3 |
| `display_order` | `integer not null unique` | |

- Sem RPC de escrita; alterar o catálogo = nova migração (FR-021c).

### `public.athlete_trophies`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `uuid` | |
| `athlete_id` | `uuid not null → athletes(id)` | |
| `trophy_code` | `text not null → trophy_catalog(code)` | |
| `season_id` | `uuid not null → seasons(id)` | temporada em que foi conquistado |
| `awarded_at` | `timestamptz not null` | |
| `trigger_context` | `jsonb not null` | ex.: `{ "matchId": "...", "seasonGoals": 10 }` |

- **Unicidade**: `unique (athlete_id, trophy_code, season_id)` (FR-021, SC-011).
- **Permanente**: trigger de imutabilidade (`before update or delete → raise`). Nunca revogado
  (FR-027).
- Preenchido só por `private.evaluate_trophies(season_id, athlete_id[])`, chamado dentro de
  `finalize_sumula` após gravar a consolidação. Para cada atleta afetado e cada troféu do catálogo:
  - `ARTILHEIRO`: `count(GOAL do atleta na temporada ativa) >= 10`.
  - `GARCOM`: `count(ASSIST do atleta na temporada ativa) >= 10`.
  - `VETERANO`: `count(distinct partidas finalizadas na temporada em que jogou) >= 10` (R3).
  - `MURALHA`: `count(clean sheets do atleta como goleiro na temporada) >= 5` (R3).
  - `HAT_TRICK`: `count(GOAL do atleta nesta consolidação) >= 3`.
  - Insere `on conflict (athlete_id, trophy_code, season_id) do nothing` → sem duplicata.
- RLS: contas ativas leem (galeria pública ao elenco).

### Views derivadas (não armazenadas)

- **`public.head_to_head_record`** (Raio-X, FR-022/023): por `opponent_name`, agrega as `matches`
  com `status='COMPLETED'` e consolidação `VALID` → `wins`, `draws`, `losses`, `goal_diff`,
  `matches_played`. Consulta para uma partida agendada por `opponent_name`; se `matches_played = 0`,
  a API responde `{ has_history: false }` (FR-023, SC-010).
- **`public.club_all_time_record`**: mesmo agregado sem filtro de adversário, para a aba
  "Histórico & Conquistas" (FR-024).
- **`public.season_scoring_leaders`**: por temporada, gols/assistências/participações por atleta —
  base dos destaques semanais e do progresso dos troféus.
- **`public.athlete_card`** (FR-019a–h): payload de renderização do cartão por atleta — os seis
  atributos, `overall` (coluna gerada de `athlete_card_attributes`), flag `incomplete`,
  `primary_position` (texto livre de `athletes.primary_position`; a sigla é derivada no cliente),
  `shirt_name`, `shirt_number`, `photo_path`. Somente leitura, contas ativas.
- **`public.season_trophy_progress`** e **`public.athlete_trophy_gallery`**: progresso por troféu
  vs. `threshold` na temporada ativa, e galeria de troféus de todas as temporadas por atleta.

---

## Módulo 4 — Súmula Live

### `public.live_match_setups` (1:1 com partida marcada como ao vivo)

| Coluna | Tipo | Regras |
|---|---|---|
| `match_id` | `uuid primary key → matches(id)` | |
| `recorder_user_id` | `uuid not null → profiles(id)` | qualquer conta ativa; designada por COACH/PRESIDENT |
| `status` | `public.live_sumula_status not null` | enum `('RECORDING','IN_REVIEW','FINALIZED','CANCELLED')`, default `'RECORDING'` |
| `pending_sync` | `boolean not null default false` | espelho de conveniência; a verdade é a store IndexedDB do dispositivo |
| `starting_goalkeeper_athlete_id` | `uuid not null → athletes(id)` | do lineup publicado |
| `enabled_by` | `uuid not null → profiles(id)` | |
| `created_at` / `updated_at` | `timestamptz` | |

- **Transições** (RPC): `RECORDING → IN_REVIEW` (`end_live_recording`, Registrador ou comissão);
  `IN_REVIEW → FINALIZED` (`finalize_sumula`, **só COACH/PRESIDENT+AAL2**); qualquer → `CANCELLED`
  (`cancel_live_recording`, comissão). `FINALIZED`/`CANCELLED` são finais.
- **Autorização do Registrador expira** quando `status` sai de `RECORDING`/`IN_REVIEW` ou quando
  `recorder_user_id` é regravado (FR-028b, SC-013).
- Só existe para partidas marcadas ao vivo → a tela de cronômetro só aparece se houver setup
  (FR-029, cenário 6).

### `public.live_match_events`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `uuid` | |
| `match_id` | `uuid not null → matches(id)` | |
| `client_event_id` | `uuid not null` | **`unique`** — gerado no clique; dedupe da sincronização offline (R8, FR-037a) |
| `minute` | `smallint not null` | `between 0 and 200` |
| `event_type` | `public.live_event_type not null` | enum `('GOAL','ASSIST','YELLOW_CARD','RED_CARD','SUBSTITUTION')` |
| `athlete_id` | `uuid not null → athletes(id)` | autor |
| `target_athlete_id` | `uuid → athletes(id)` | assistente (para `GOAL`), quem sai (para `SUBSTITUTION`); `<> athlete_id` |
| `team_side` | `public.team_side not null default 'MBJ'` | `('MBJ','OPPONENT')` — gol do adversário conta no placar sem exigir atleta MBJ |
| `recorded_by` | `uuid not null → profiles(id)` | ator (Registrador) |
| `recorded_at` | `timestamptz not null` | |
| `undone` | `boolean not null default false` | |
| `undone_at` | `timestamptz` | não-nulo sse `undone` |

- **Undo (FR-030, E-01, SC-005)**: `undo_live_event(match_id)` marca `undone=true` no evento mais
  recente **não desfeito** cujo `recorded_at >= now() - interval '30 seconds'`; fora da janela →
  `UNDO_WINDOW_EXPIRED`. Evento desfeito não é deletado (auditoria) mas é filtrado de toda leitura
  de torcedor/revisão e ignorado na consolidação.
- **Realtime**: RLS `select` para contas ativas; inserts e a mudança de `undone` propagam por
  Postgres Changes filtrado por `match_id` (R7, FR-031).
- **Edição na revisão**: enquanto `setup.status='IN_REVIEW'`, `amend_live_event(id, {minute?,
  athlete_id?, target_athlete_id?})` — Registrador ou comissão (FR-033).
- Escrita só via RPC (`log_live_event`, `undo_live_event`, `amend_live_event`); `insert` direto
  negado.

### Tabelas de estatística consolidada (imutáveis, ligadas à `consolidation_id`)

`public.match_cards`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `uuid` | |
| `consolidation_id` | `uuid not null → match_consolidations(id)` | |
| `athlete_id` | `uuid not null → athletes(id)` | deve estar no `lineup_players` da consolidação |
| `card_type` | `public.card_type not null` | `('YELLOW','RED')` |
| `minute` | `smallint not null` | `between 0 and 200` |

`public.match_substitutions`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `uuid` | |
| `consolidation_id` | `uuid not null → match_consolidations(id)` | |
| `out_athlete_id` | `uuid not null → athletes(id)` | no lineup da consolidação |
| `in_athlete_id` | `uuid not null → athletes(id)` | no lineup da consolidação; `<> out_athlete_id` |
| `minute` | `smallint not null` | `between 0 and 200` |

`public.match_goalkeeper_assignments`

| Coluna | Tipo | Regras |
|---|---|---|
| `id` | `uuid` | |
| `consolidation_id` | `uuid not null → match_consolidations(id)` | |
| `athlete_id` | `uuid not null → athletes(id)` | |
| `from_minute` | `smallint not null` | `>= 0` |
| `to_minute` | `smallint` | nulo = até o fim; `> from_minute` quando preenchido |

- **Clean sheet (Muralha)**: creditado a `athlete_id` sse `to_minute is null`, se é o **único**
  registro de goleiro da consolidação, e se `match_consolidations.opponent_score = 0` (R3).
- As três tabelas herdam o trigger `private.reject_statistics_history_mutation` (padrão do MVP):
  correção pós-fecho só por `reopen_statistics` + nova revisão.

---

## Fluxo transacional `finalize_sumula`

`public.finalize_sumula(match_id uuid, reviewed_payload jsonb, idempotency_key uuid)`
— `security definer`, `set search_path = ''`. Convenção de parâmetros única em todos os artefatos
desta feature: `match_id` / `idempotency_key` (as demais RPCs de súmula em `contracts/live-match.md`
usam a mesma).

1. Papel: `COACH` ou `PRESIDENT` **e** `current_session_is_aal2()`; senão `FORBIDDEN`/`MFA_REQUIRED`.
2. Idempotência: retorna `command_results` cacheado se `idempotency_key` já visto.
3. `select ... for update` em `matches` e `live_match_setups`; exige `setup.status='IN_REVIEW'`,
   `matches.current_consolidation_id is null`, `match_date <= now()`.
4. Deriva dos `live_match_events` **não desfeitos** revisados: `goals_input` (eventos `GOAL`
   `team_side='MBJ'` com autor/assistente), `mbj_score = count`, `opponent_score = count(GOAL
   team_side='OPPONENT')`.
5. `private.write_consolidation(match, lineup PUBLISHED, mbj_score, opponent_score, goals_input,
   idempotency_key, actor)` — rotina extraída de `consolidate_match`: cria revisão `match_consolidations` +
   `match_goals`, abre `mvp_voting_rounds`, marca `matches.status='COMPLETED'` +
   `current_consolidation_id`, enfileira notificação de votação.
6. Insere `match_cards`, `match_substitutions`, `match_goalkeeper_assignments` a partir dos eventos.
7. `private.evaluate_trophies(active_season_id, distinct athletes afetados)`.
8. `live_match_setups.status := 'FINALIZED'`.
9. `append_audit_log('SUMULA_FINALIZED', 'match', match_id, ..., idempotency_key)`.
10. `insert into private.command_results (...)`; retorna
    `{ matchId, consolidationId, revision, mbjScore, opponentScore, trophiesAwarded[] }`.

Atômico: qualquer falha (RLS, `client_event_id` pendente, lineup ausente) faz rollback total
(SC-004, SC-012).

---

## Índices adicionais

- `athlete_charges (athlete_id, status)`, `athlete_charges (status, due_date) where status='PENDING'`,
  `athlete_charges (season_id, type, period)`.
- `social_event_presences (social_event_id, status)`.
- `athlete_trophies (athlete_id)`, `athlete_trophies (season_id, trophy_code)`.
- `live_match_events (match_id, recorded_at desc)`, `live_match_events (match_id) where not undone`,
  `unique (client_event_id)`.
- `match_cards (consolidation_id)`, `match_substitutions (consolidation_id)`,
  `match_goalkeeper_assignments (consolidation_id)`.
