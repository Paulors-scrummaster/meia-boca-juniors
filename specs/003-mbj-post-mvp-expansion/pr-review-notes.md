# 003 — Post-MVP Modules Expansion · Nota de revisão para o PR

Cobre T098 (revisão de Sentry/log e armazenamento offline) e T099 (revisão de RLS e
privacidade). Feita sobre o branch `003-mbj-post-mvp-expansion`.

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
