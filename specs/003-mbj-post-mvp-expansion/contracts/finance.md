# Contract — Módulo Financeiro & Mensalidades

Segue o **Common contract** de `../../001-mbj-mvp-core/contracts/commands.md`: ator derivado da
sessão verificada; resultado `{ data, traceId }` / erro seguro `{ error: { code, message,
fieldErrors }, traceId }`; toda operação de escrita aceita `idempotencyKey` gerado uma vez por ação.
Códigos de erro reutilizados: `UNAUTHENTICATED`, `MFA_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`,
`VALIDATION_ERROR`, `CONFLICT`. Novos: `CHARGE_LOCKED` (transição inválida para o status atual),
`NO_ACTIVE_SEASON`.

Leituras são via views/queries tipadas com RLS (`athlete_charges`, `dues_settings`,
`dues_exemptions`). Comandos abaixo são funções RPC `security definer`.

## RPC `set_default_dues_amount(amount numeric, idempotency_key uuid)`

- **Autorização**: `PRESIDENT` + AAL2.
- **Efeito**: grava a linha única `dues_settings`. Não altera cobranças existentes (FR-009).
- **Retorno**: `{ defaultAmount }`.
- **Erros**: `VALIDATION_ERROR` se `amount <= 0`.

## RPC `create_manual_charge(athlete_id uuid, amount numeric, due_date date, type text, idempotency_key uuid)`

- **Autorização**: `PRESIDENT` + AAL2.
- **`type`** ∈ `{ MANUAL_OVERRIDE, EVENT_FEE }` (FR-003). `MONTHLY_AUTOMATIC` é recusado
  (`VALIDATION_ERROR`).
- **Efeito**: insere `athlete_charges` com `status='PENDING'`, `season_id` = temporada ativa,
  `created_by = actor`; audit `CHARGE_CREATED`.
- **Retorno**: `{ chargeId, status: "PENDING" }`.
- **Erros**: `NO_ACTIVE_SEASON`, `NOT_FOUND` (atleta), `VALIDATION_ERROR`.

## RPC `adjust_charge_amount(charge_id uuid, amount numeric, reason text, idempotency_key uuid)`

- **Autorização**: `PRESIDENT` + AAL2.
- **Efeito**: só quando `status ∈ {PENDING, OVERDUE}`; atualiza `amount`; audit `CHARGE_ADJUSTED`
  com `reason` (FR-1.2).
- **Erros**: `CHARGE_LOCKED` se `PAID`/`CANCELLED`.

## RPC `settle_charge(charge_id uuid, reason text, idempotency_key uuid)`

- **Autorização**: `PRESIDENT` + AAL2.
- **Efeito**: `PENDING|OVERDUE → PAID`; grava `settled_by = actor`, `settled_at = now()`; audit
  `CHARGE_SETTLED` (FR-1.4, FR-008). O badge do atleta some se não sobrar `PENDING`/`OVERDUE`.
- **Retorno**: `{ chargeId, status: "PAID", settledAt }`.
- **Erros**: `CHARGE_LOCKED` se já `PAID` ou `CANCELLED`.

## RPC `reverse_charge_settlement(charge_id uuid, reason text, idempotency_key uuid)`

- **Autorização**: `PRESIDENT` + AAL2.
- **Efeito**: `PAID → OVERDUE` se `due_date < current_date`, senão `PAID → PENDING`; limpa
  `settled_by/at`; audit `CHARGE_SETTLEMENT_REVERSED` com `reason` (Clarificação Q1, SC-015).
- **Erros**: `CHARGE_LOCKED` se não estiver `PAID`.

## RPC `cancel_charge(charge_id uuid, reason text, idempotency_key uuid)`

- **Autorização**: `PRESIDENT` + AAL2.
- **Efeito**: `PENDING|OVERDUE|PAID → CANCELLED` (estado final); audit `CHARGE_CANCELLED` com
  `reason`. `CANCELLED` sai de badges e totais (SC-015).
- **Erros**: `CHARGE_LOCKED` se já `CANCELLED`.

## RPC `grant_dues_exemption(athlete_id uuid, period text | null, reason text, idempotency_key uuid)` / `revoke_dues_exemption(exemption_id uuid, idempotency_key uuid)`

- **Autorização**: `PRESIDENT` + AAL2.
- **`period`**: `'YYYY-MM'` para um mês; `null` = indefinida (FR-004). Unicidade por
  `(athlete_id, period)`.
- **Efeito**: a geração mensal pula atletas com isenção para o período alvo ou indefinida. Audit
  `DUES_EXEMPTION_GRANTED` / `_REVOKED`.

## RPC `run_monthly_dues_generation(period text | null, idempotency_key uuid)`

- **Autorização**: `PRESIDENT` + AAL2. Mesmo corpo que o job cron (FR-002 — "rodar agora").
- **`period`**: default = mês corrente em `America/Sao_Paulo`.
- **Efeito** (transacional, idempotente): para a temporada ativa e cada atleta `status <>
  'INACTIVE'` sem isenção aplicável e **sem** `athlete_charges` `MONTHLY_AUTOMATIC` no `period`,
  insere cobrança `amount = dues_settings.default_amount`, `due_date = <ano-mês>-10`,
  `status='PENDING'`. Re-execução no mesmo período não cria duplicata (`unique (athlete_id, period)
  where type='MONTHLY_AUTOMATIC'`).
- **Retorno**: `{ period, created: n, skippedExempt: n, skippedExisting: n, activeAthletes: n }`
  (SC-001).
- **Erros**: `NO_ACTIVE_SEASON`.

## Agendamentos (pg_cron, sem interface)

| Job | Cadência | Ação |
|---|---|---|
| `generate_monthly_dues` | dia 1, 06:00 America/Sao_Paulo | chama a mesma rotina de `run_monthly_dues_generation` para o mês corrente |
| `mark_overdue_charges` | diário, 03:00 | `update athlete_charges set status='OVERDUE' where status='PENDING' and due_date < current_date` (FR-007) |

## Leituras (views/queries com RLS)

- `athlete_charges` — `PRESIDENT` lê tudo; `ATHLETE` lê só as próprias linhas.
- `public.athlete_delinquency_badge(athlete_id)` → `{ badge: "NONE" | "PENDING" | "OVERDUE" }`
  (deriva de cobranças não `PAID`/`CANCELLED`; puramente visual — FR-006/SC-006).
- `public.finance_overview` — para o painel da diretoria: por atleta, totais `pending`, `overdue`,
  `paidThisSeason`, `badge`.
