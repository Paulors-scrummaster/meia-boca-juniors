# 003 — Post-MVP Modules Expansion · Nota de revisão para o PR

Cobre T098 (revisão de Sentry/log e armazenamento offline) e T099 (revisão de RLS e
privacidade). Feita sobre o branch `003-mbj-post-mvp-expansion`.

---

## Code review pré-merge — dispositions (PR #209)

Revisão de code-review / release-readiness realizada sobre o diff completo contra `main`.
Achados classificados BLOCKER / HIGH / MEDIUM / LOW / INFO. Nenhum BLOCKER.

### HIGH — H1 · `ASSIST` avulso não consolidado → **CORRIGIDO (UI-only)**

- **Problema:** a UI da Súmula Live oferecia um botão "Assistência" que criava um
  evento `event_type='ASSIST'`; `finalize_sumula` só consolida GOAL/YELLOW/RED/SUB e
  deriva a assistência de `GOAL.target_athlete_id`. Fluxo "Gol #9" → "Assistência #10"
  gerava um gol **sem** assistência ⇒ GARCOM / leaderboards de assistência subcontavam
  (risco a SC-004).
- **Correção (solução preferencial, sem tocar no servidor):**
  - `src/features/live-match/lib/event-labels.ts` — `LIVE_EVENT_TYPES` deixa de incluir
    `'ASSIST'` (passa a `['GOAL','YELLOW_CARD','RED_CARD','SUBSTITUTION']`).
    `LIVE_EVENT_LABEL` mantém a chave `ASSIST` só para rotular linhas legadas no feed /
    revisão.
  - `src/features/live-match/components/QuickActions.tsx` — some o botão "Assistência";
    o segundo campo do gol passa a se chamar **"Assistência (opcional)"** e continua
    mapeando para `target_athlete_id`. Gol sem assistência segue válido
    (`requiresTargetAthlete` só é `true` para SUBSTITUTION).
  - `finalize_sumula` **não** foi alterado — a consolidação já lê a assistência do
    `target_athlete_id` do gol; o enum `live_event_type` do banco mantém `ASSIST` (sem
    migração).
- **Garantias:** não há mais fluxo visível que crie `ASSIST` avulso; gol com
  assistência consolida `match_goals.assistant_athlete_id`; gol sem assistência
  permanece válido; revisão e consolidação sem divergência nesse aspecto (pgTAP
  `011_finalize_sumula`, e2e `live-match-recording` / `live-match-finalize`).

### MEDIUM — M7 · labels de substituição ambíguas → **CORRIGIDO**

- **Problema:** campo principal genérico "Atleta" e secundário "Assistência / quem sai"
  serviam a dois papéis; inverter a substituição corrompia `match_substitutions` e a
  linha do tempo do goleiro (MURALHA / VETERANO).
- **Correção (sem tocar no contrato server-side):**
  - `QuickActions.tsx` — "Substituição" abre um passo dedicado (`aria-pressed`); nesse
    modo o campo principal vira **"Quem entra"** e o secundário **"Quem sai"**, com botão
    "Registrar substituição". Gol/cartão continuam a um toque. `athlete_id` = quem
    entra, `target_athlete_id` = quem sai — igual a `log_live_event` / `finalize_sumula`.
  - `ReviewScreen.tsx` — na linha de um evento `SUBSTITUTION` os rótulos de edição viram
    "Quem entra" / "Quem sai"; nos demais, "Autor" / "Assistência".
  - e2e ajustados: `live-match-recording.spec.ts` (passo de substituição) e
    `live-match-finalize.spec.ts` (`combobox` "Assistência").

### MEDIUM — M4 · `generate_attendance_reminders` `create or replace` → **CONFIRMADO OK**

- Só existem **duas** definições da função em migrações: `20260825002400`
  (`notification_reminders`, MVP) e `20260908160700` (`highlights_cron`, 003). Nenhuma
  migração intermediária a toca — não há mudança pós-MVP para reverter.
- O corpo da rotina de lembrete de presença em 003 é **idêntico** ao MVP (mesmo SELECT,
  mesmos filtros, mesma dedup key, mesmo payload, mesma contagem `event_before/after`);
  a única diferença é `declare upcoming record;` + um laço guardado
  (`exception when others then null`) que dispara `generate_pre_match_highlights` ~24 h
  antes do apito. O valor de retorno (`generated_count`) **não muda**.
- O cron que invoca a rotina (`generate-attendance-reminders`, criado em
  `20260825002400`) roda a cada **5 minutos** (`*/5 * * * *`) — ≤ 10 min, dentro da
  janela de 10 min do laço de pré-jogo. 003 não re-agenda o job; o `create or replace`
  só troca o corpo que o job existente chama.
- **Sem alteração** — apenas documentado.

### MEDIUM — M6 · dois seasons `ACTIVE` via `status`/`is_active` → **CONFIRMADO OK**

- Escritores de `public.seasons` em 003: só o backfill único em `20260908120100` e
  `open_season` / `close_season` em `20260908120200`. Nenhum outro caminho 003 escreve
  `status` / `is_active` (views e crons só fazem `select ... where status='ACTIVE'`).
- `open_season` **recusa** (`SEASON_ALREADY_ACTIVE`) se já existe qualquer season
  `ACTIVE` — não abre uma segunda; o operador fecha a anterior com `close_season` e só
  então abre a nova.
- Backstop de banco: `seasons_one_active_key` (`unique index on seasons(is_active)
  where is_active`, MVP `20260825000700`) + o trigger `sync_season_status_and_flag`
  derivando `is_active = (status='ACTIVE')` impedem, no nível do banco, duas linhas
  `ACTIVE` mesmo sob corrida (o segundo INSERT falha com violação de unicidade).
- **Sem alteração** — apenas documentado.

### Demais achados (M1–M3, M5, L1–L8) — não corrigidos neste lote

Fora do escopo desta correção pré-merge (H1 + M7). Recomendados como issues de
follow-up:
- **M1** `finalize_sumula` sempre devolve `trophiesAwarded: '[]'` (dados corretos; só o
  payload de resposta não reflete os troféus — a galeria atualiza no refetch).
- **M2** `/app/roster` faz uma RPC `athlete_card` por tile (N+1; tolerável no porte do
  clube).
- **M3** sem tela de feed ao vivo para torcedor/atleta (transporte Realtime pronto e
  testado; FR-4.4 parcialmente atendido — decisão de escopo do time).
- **M5** lote mensal de mensalidades levanta exceção (não retorna) em
  `NO_ACTIVE_SEASON` / `DUES_NOT_CONFIGURED` no caminho do cron, sem alerta.
- **L1** motivo textual de baixa/estorno validado mas não persistido no audit log.
- **L2** `log_live_event` aceita `idempotency_key` que ignora (dedup é por
  `client_event_id`).
- **L3** `amend_live_event` levanta `NOT_FOUND` antes da autorização.
- **L4** `mark_overdue_charges` vira em meia-noite UTC, não São Paulo.
- **L5** `costPerPerson` do rateio é valor de exibição arredondado (Σ`frozen_share` é
  exato).
- **L6** `exception when others then null` do pré-jogo engole bugs sem log.
- **L7** invariante "conjunto de navegação fechado" da feature 002 agora estendido —
  atualizar `data-model.md` §3.2 / `contracts/navigation-shell.md` da 002.
- **L8** `/app/staff` mudou de placeholder para `SeasonAdminPage` sem renomear o item de
  nav.

INFO: os advisors do Supabase (security e performance) **não** apontam nada novo
introduzido pela feature 003; todos os achados são de tabelas/funções pré-existentes do
MVP. Todas as funções `security definer` de 003 usam `set search_path = ''`.

---

## T099 — RLS & privacidade

### Tabelas novas e políticas

Todas as tabelas de conteúdo/histórico seguem o mesmo padrão fechado:
`revoke all from anon, authenticated;` → `grant select to authenticated;` →
`create policy ... for select to authenticated using (private.current_user_is_active())`.
Nenhuma tem policy de `insert`/`update`/`delete` para `authenticated`: toda escrita passa
por RPC `security definer` com checagem de papel + AAL2.

| Tabela                             | Migração                              | Leitura            | Escrita                                            | Imutabilidade |
| ---------------------------------- | ------------------------------------- | ------------------ | ------------------------------------------------- | ------------- |
| `athlete_charges`                  | `20260908130200_finance_schema`       | próprio atleta (RLS self) + staff | RPC admin/settlement (`require_president_aal2`)   | não (baixa/reversão auditadas) |
| `charge_exemptions`                | `20260908130500_finance_exemptions`   | staff              | RPC (`require_president_aal2`)                     | não           |
| `social_events`, `event_presences` | `20260908140200_social_schema`        | active accounts    | RPC (`require_staff_aal2` / próprio atleta p/ presença) | não     |
| `live_match_setups`                | `20260908150200_live_setups`          | active accounts    | RPC (`enable_live_recording` etc.)                | guard de transição de status |
| `live_match_events`                | `20260908150300_live_events`          | active accounts    | RPC (`log_live_event` etc.)                       | `reject_live_event_delete` (soft-undo apenas) |
| `match_cards` / `match_substitutions` / `match_goalkeeper_assignments` | `20260908150400_live_stats_tables` | active accounts | escritas só dentro de `finalize_sumula` | `reject_statistics_history_mutation` (55000) |
| `athlete_card_attributes`          | `20260908160100_card_attributes`      | active accounts    | RPC `set_athlete_attributes` (COACH/PRESIDENT + AAL2, auditado) | não (upsert) |
| `trophy_catalog`                   | `20260908160200_trophy_catalog`       | active accounts    | seed only, sem RPC                                | efetivamente estático |
| `athlete_trophies`                 | `20260908160300_athlete_trophies`     | active accounts    | só `private.evaluate_trophies` (service_role)     | `reject_statistics_history_mutation` |

### Views (SECURITY INVOKER)

`club_all_time_record`, `season_scoring_leaders`, `season_trophy_progress`, `athlete_card`,
`athlete_trophy_gallery`, `head_to_head_record`, `finance_overview` — todas
`with (security_invoker = true)` ou funções `stable`/`security definer` sem entrada
sensível; `revoke all from anon` e `grant execute/select to authenticated`. Não expõem
identidade além do já visível no elenco (nome de camisa, número, posição, `photo_path`).

### Funções `pg_cron` (privadas)

`private.generate_monthly_dues`, `private.mark_overdue_charges`,
`private.generate_weekly_highlights`, `private.generate_pre_match_highlights` —
`security definer`, `set search_path = ''`, `revoke all from public, anon, authenticated`,
`grant execute to service_role`. Não recebem entrada de usuário. Idempotência por chave de
deduplicação (`week_key` ISO, `pre-match-highlights:<match_id>`) ou verificação de estado.
Payload de notificação só contém IDs técnicos + agregados de temporada — nenhum dado
pessoal além de nome de camisa/número.

### Desvio constitucional ativo (único)

**Princípio V — escritas offline.** A tela de súmula ao vivo
(`/app/partidas/:matchId/sumula`) mantém um buffer IndexedDB (`mbj-live-sumula:<matchId>`)
e é a única rota isenta do `<fieldset disabled>` de escrita offline em
`AuthenticatedLayout` (`isLiveSumulaRoute`). Justificativa: registro à beira do campo
sem rede confiável (Edge Case E-03, FR-4.3/FR-4.4). Escopo: **só esta tela**.
Plano de remediação (em `plan.md` Complexity Tracking): migrar o buffer para uma fila
de mutação padronizada (`networkMode: 'always'` + persistência) quando a infraestrutura
de sync genérica existir; até lá o buffer carrega apenas `{athleteId, clientEventId,
eventType, matchId, minute, targetAthleteId, teamSide}` — UUIDs + enums, sem PII — e é
limpo no logout (ver T098).

### Módulo Financeiro — **não** é desvio

Sob a Constituição **v1.1.0**, o Princípio III permite "Internal Financial Bookkeeping":
gerar/controlar mensalidades, status `PENDING/PAID/OVERDUE/CANCELLED`, baixa manual,
reversão, cancelamento, isenções, inadimplência, rateios e auditoria financeira, além
dos cron jobs internos que essas funções exigem. Continua proibido: gateway de
pagamento, PIX, cartão, boleto de provedor externo, checkout, carteira/saldo, movimento
real de dinheiro, integração externa de billing. O app registra **quem deve, quanto,
quando venceu e se foi marcado como pago** — não processa a transação. O antigo
tratamento do módulo financeiro como desvio permanente do Princípio III foi **removido**
do plano.

---

## T098 — Revisão de Sentry/log e armazenamento offline

### Logging

`grep` por `console.*`, `captureException`, `Sentry.*`, `logger.*` nas quatro features
novas (`finance`, `social-events`, `live-match`, `gamification`): **nenhuma ocorrência**.
Erros fluem por `AppError` / `mapXError` → `ErrorState` na UI; nenhum payload cru,
token ou dado pessoal é logado. A init do Sentry é global e não foi alterada; as
features novas não adicionam breadcrumbs nem `capture*`.

### `localStorage`

As features novas não escrevem em `localStorage` diretamente. O único uso é o
`PersistQueryClientProvider` já existente (`mbj:query-cache:*`), que serializa respostas
de query — as novas queries carregam os mesmos agregados/identidades já visíveis na UvV
(nome de camisa, número, posição). `shouldPersistOfflineQuery` continua sendo o filtro.

### IndexedDB — buffer da súmula

`mbj-live-sumula:<matchId>`, store `pending_events`, keyPath `clientEventId`. Registro =
`{athleteId, clientEventId, createdAtMs, eventType, matchId, minute, targetAthleteId,
teamSide}`. **Sem nomes, sem texto livre, sem PII** — só UUIDs e enums (`GOAL`,
`ASSIST`, `MBJ`, …). Mínimo necessário para reidratar o evento no servidor.

### Purga no logout

`useLiveOfflineQueue` agora registra `queue.clear()` via
`registerOfflineCleanup(userId, …)`, então o buffer é esvaziado no mesmo caminho que o
cache de query persistido (`purgeRegisteredOfflineState` em `AuthProvider`, disparado no
`signOut` e na troca de conta). Antes desta mudança o banco persistia entre logouts em
dispositivo compartilhado.

### Conclusão

Sem PII ou segredo emitido a logs pelas features novas; armazenamento offline reduzido a
identificadores técnicos e purgado no logout. Nenhum bloqueador.
