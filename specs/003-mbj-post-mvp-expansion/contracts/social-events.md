# Contract — Módulo Resenha / Churrasco

Segue o **Common contract** de `../../001-mbj-mvp-core/contracts/commands.md`. Novos códigos de erro:
`EVENT_CLOSED`, `SPLIT_UNAVAILABLE` (informativo em leitura, não em comando).

## RPC `create_social_event(title text, event_at timestamptz, location_name text, total_cost numeric, idempotency_key uuid)`

- **Autorização**: `PRESIDENT` + AAL2 (organizador — Assumptions).
- **Efeito**: insere `social_events` com `status='OPEN'`. `event_at` em UTC; `total_cost >= 0`
  (FR-2.1).
- **Retorno**: `{ eventId, status: "OPEN" }`.

## RPC `update_social_event(event_id uuid, {title?, event_at?, location_name?, total_cost?}, idempotency_key uuid)`

- **Autorização**: `PRESIDENT` + AAL2.
- **Efeito**: só quando `status='OPEN'`. Alterar `total_cost` recalcula o rateio derivado em
  leitura (E-02).
- **Erros**: `EVENT_CLOSED`.

## RPC `set_event_presence(event_id uuid, status text, guests_count integer, idempotency_key uuid)`

- **Autorização**: qualquer `ATHLETE` ativo, agindo sobre a própria linha.
- **`status`** ∈ `{ CONFIRMED, DECLINED }`; **`guests_count`** inteiro `0..20` (FR-2.2).
- **Efeito**: upsert em `social_event_presences (unique event_id + athlete_id)`; grava
  `responded_at`. Recusado com `EVENT_CLOSED` se o evento não está `OPEN`.
- **Retorno**: `{ presenceId, status, guestsCount }`.

## RPC `close_social_event(event_id uuid, idempotency_key uuid)`

- **Autorização**: `PRESIDENT` + AAL2.
- **Efeito** (transacional): calcula `peopleCount = Σ (1 + guests_count)` das presenças
  `CONFIRMED`; distribui `total_cost` em centavos de forma determinística (base + 1 centavo nas
  primeiras `resto` cotas, ordenadas por `athlete_id`), de modo que `Σ cotas = total_cost`
  exatamente (SC-002); grava `frozen_cost_per_person`, `frozen_people_count`, `closed_by`,
  `closed_at`; `status='CLOSED'`. **Não** cria cobrança `EVENT_FEE` (FR-017).
- **Retorno**: `{ eventId, status: "CLOSED", peopleCount, costPerPerson, shares: [{ athleteId,
  share }] }`.
- **Erros**: `EVENT_CLOSED` (já fechado); `VALIDATION_ERROR` se `peopleCount = 0`.

## Leituras (views/queries com RLS)

- `social_events` — contas ativas leem.
- `public.social_event_split(event_id)` → enquanto `OPEN`:
  `{ peopleCount, costPerPerson, splitUnavailable }`;
  `costPerPerson = round(total_cost / peopleCount, 2)` para exibição, `splitUnavailable = true` e
  `costPerPerson = null` quando `peopleCount = 0` (FR-016). Quando `CLOSED`, retorna os valores
  congelados.
- `public.social_event_participants(event_id)` → lista de `{ athleteId, shirtName, status,
  guestsCount, share }` (`share` derivado enquanto OPEN, congelado quando CLOSED). Todo participante
  confirmado vê o mesmo `costPerPerson` (FR-013, SC-008).
