# Contract — Módulo Súmula Live

Segue o **Common contract** de `../../001-mbj-mvp-core/contracts/commands.md`. Novos códigos de erro:
`RECORDER_ONLY`, `UNDO_WINDOW_EXPIRED`, `SUMULA_NOT_IN_REVIEW`, `PENDING_OFFLINE_EVENTS`,
`LIVE_NOT_ENABLED`. Reutiliza `MATCH_LOCKED`, `PUBLISHED_LINEUP_REQUIRED`.

## RPC `enable_live_recording(match_id uuid, recorder_user_id uuid, starting_goalkeeper_athlete_id uuid, idempotency_key uuid)`

- **Autorização**: `COACH` ou `PRESIDENT` + AAL2.
- **Efeito**: pré-jogo. Exige `matches.status='SCHEDULED'` e lineup `PUBLISHED`. Cria
  `live_match_setups` com `status='RECORDING'`. `recorder_user_id` pode ser **qualquer conta ativa**
  (FR-028); a designação é que é restrita. `starting_goalkeeper_athlete_id` deve estar no lineup
  publicado.
- **Retorno**: `{ matchId, recorderUserId, status: "RECORDING" }`.
- **Erros**: `PUBLISHED_LINEUP_REQUIRED`, `CONFLICT` (já habilitado), `VALIDATION_ERROR`.

## RPC `assign_field_recorder(match_id uuid, recorder_user_id uuid, idempotency_key uuid)`

- **Autorização**: `COACH` ou `PRESIDENT` + AAL2.
- **Efeito**: regrava `recorder_user_id` enquanto `status='RECORDING'`. A autorização do Registrador
  anterior deixa de valer imediatamente (FR-028b, SC-013). Audit `FIELD_RECORDER_ASSIGNED`.

## RPC `log_live_event(match_id uuid, client_event_id uuid, minute int, event_type text, athlete_id uuid, target_athlete_id uuid | null, team_side text, idempotency_key uuid)`

- **Autorização**: `setup.recorder_user_id = auth.uid()` **e** `setup.status='RECORDING'`; ou
  `COACH`/`PRESIDENT`. Caso contrário `RECORDER_ONLY`.
- **`event_type`** ∈ `{ GOAL, ASSIST, YELLOW_CARD, RED_CARD, SUBSTITUTION }`; `team_side` ∈
  `{ MBJ, OPPONENT }`. `minute` `0..200`. `target_athlete_id` obrigatório para `SUBSTITUTION`
  (quem sai) e opcional para `GOAL` (assistente); deve diferir de `athlete_id` (FR-029, FR-4.2).
- **Efeito**: `insert into live_match_events (...) on conflict (client_event_id) do nothing
  returning *` → idempotente para a sincronização offline (FR-037a). Propaga por Supabase Realtime
  (Postgres Changes, filtro `match_id`) → telas de torcedor/atleta em < 2 s (FR-031, SC-003).
- **Retorno**: `{ eventId, clientEventId, deduped: bool, minute, eventType }`.

## RPC `undo_live_event(match_id uuid, idempotency_key uuid)`

- **Autorização**: mesma de `log_live_event`.
- **Efeito**: marca `undone=true, undone_at=now()` no evento mais recente **não desfeito** com
  `recorded_at >= now() - interval '30 seconds'`. O evento não é deletado; sai de toda leitura de
  torcedor/revisão e da consolidação (FR-030, E-01, SC-005). A mudança propaga por Realtime.
- **Erros**: `UNDO_WINDOW_EXPIRED` (nenhum evento elegível na janela de 30 s).

## RPC `amend_live_event(event_id uuid, {minute?, athlete_id?, target_athlete_id?}, idempotency_key uuid)`

- **Autorização**: Registrador **ou** `COACH`/`PRESIDENT`, e `setup.status='IN_REVIEW'`.
- **Efeito**: corrige campos do evento na tela de revisão pós-jogo (FR-033).
- **Erros**: `SUMULA_NOT_IN_REVIEW`.

## RPC `end_live_recording(match_id uuid, idempotency_key uuid)`

- **Autorização**: Registrador **ou** `COACH`/`PRESIDENT`.
- **Efeito**: `RECORDING → IN_REVIEW`. Abre a tela de revisão. Não consolida nada.

## RPC `finalize_sumula(match_id uuid, reviewed_payload jsonb, idempotency_key uuid)`

- **Autorização**: **`COACH` ou `PRESIDENT` + AAL2** — um Registrador sem esse papel recebe
  `FORBIDDEN` mesmo podendo editar eventos (FR-034, cenário 9, SC-013).
- **Pré-condições**: `setup.status='IN_REVIEW'`; `matches.current_consolidation_id is null`;
  `match_date <= now()`; lineup `PUBLISHED`; **nenhum evento offline pendente** (a interface só
  habilita o botão quando a fila IndexedDB local está vazia — FR-037b; o servidor também recusa com
  `PENDING_OFFLINE_EVENTS` se o payload declarar pendências).
- **Efeito** (uma transação — ver `data-model.md` §"Fluxo transacional `finalize_sumula`"):
  deriva `mbjScore`/`opponentScore`/`goalsInput` dos `live_match_events` não desfeitos revisados;
  chama a rotina interna de consolidação (cria `match_consolidations` + `match_goals`, abre votação
  MVP, marca a partida `COMPLETED`, enfileira notificação); grava `match_cards`,
  `match_substitutions`, `match_goalkeeper_assignments`; roda `private.evaluate_trophies`;
  `setup.status='FINALIZED'`; audit `SUMULA_FINALIZED`. Idempotente por `command_results`.
- **Retorno**: `{ matchId, consolidationId, revision, mbjScore, opponentScore,
  trophiesAwarded: [{ athleteId, trophyCode }] }`.
- **Garantia**: 0 % de divergência entre o revisado e a estatística consolidada (SC-004), porque a
  consolidação **é** a escrita — não há cópia posterior.
- **Erros**: `SUMULA_NOT_IN_REVIEW`, `MATCH_LOCKED`, `PUBLISHED_LINEUP_REQUIRED`,
  `PENDING_OFFLINE_EVENTS`, `FORBIDDEN`, `MFA_REQUIRED`.

## RPC `cancel_live_recording(match_id uuid, reason text, idempotency_key uuid)`

- **Autorização**: `COACH` ou `PRESIDENT` + AAL2.
- **Efeito**: qualquer status não-final → `CANCELLED`. A autorização do Registrador cessa. Nenhuma
  estatística é gravada. Audit `LIVE_RECORDING_CANCELLED`.

## Correção pós-finalização

Reusa o fluxo do MVP: `reopen_statistics` invalida a consolidação (`INVALIDATED`) e permite nova
`finalize_sumula` / `consolidate_match` gerando nova `revision`. Troféus já concedidos permanecem
(FR-027); `evaluate_trophies` reavalia e só **acrescenta** o que passar a qualificar.

## Realtime / leitura

- Canal: Supabase Realtime **Postgres Changes**, tabela `public.live_match_events`, filtro
  `match_id=eq.<uuid>`. RLS `select` = qualquer conta ativa (torcedores/atletas autenticados —
  Assumptions). Cliente ignora linhas `undone=true`.
- `public.live_sumula_view(match_id)` → estado atual para a tela de revisão e para torcedores:
  eventos não desfeitos ordenados por `minute, recorded_at`, placar corrente derivado, `status` do
  setup, `pendingSync` (informativo).
- Fila offline: `src/features/live-match/lib/offline-queue.ts` (IndexedDB, store `pending_events`,
  chave `client_event_id`). Drena em `online`; `finalize_sumula` fica desabilitado na UI enquanto a
  store não esvazia (R8).
