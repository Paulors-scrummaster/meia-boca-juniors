# Phase 0 — Research: Post-MVP Modules Expansion (MBJ)

Todas as escolhas de stack já estão fixadas por `TECH_STACK.md`. Esta pesquisa resolve as decisões
em aberto do spec/clarificações e reconcilia o desenho com o schema real do MVP.

## R1. Entidade Season — estender a tabela existente, não criar nova

- **Contexto**: a clarificação Q3 pediu "uma nova entidade Season com start_date, end_date e flag
  active; admin abre/fecha; uma ativa por vez". A migração `20260825000700_matches_attendance.sql`
  **já define** `public.seasons (id, year, is_active, created_at)` com índice parcial único
  `seasons_one_active_key` garantindo uma ativa, e `public.matches.season_id` referencia-a.
- **Decisão**: estender `public.seasons` com `starts_on date`, `ends_on date null`,
  `status public.season_status` (`ACTIVE`/`CLOSED`) e comandos RPC `open_season(year, starts_on)` e
  `close_season(season_id, ends_on)`. Reaproveitar o índice parcial de "uma ativa". `is_active`
  passa a ser derivado de `status = 'ACTIVE'` (mantido por constraint/trigger para não quebrar
  consultas do MVP).
- **Racional**: criar uma segunda tabela de temporada duplicaria a FK de `matches` e fragmentaria a
  fonte de verdade — viola Princípio II. O MVP já trata "uma temporada ativa"; só falta o ciclo de
  vida explícito e as datas.
- **Alternativas**: (a) nova tabela `competitions` paralela — rejeitada (duplicação, migração de
  `matches`); (b) "season" como janela móvel de 12 meses — rejeitada pela clarificação (admin
  controla explicitamente).
- **Impacto no spec**: a redação "nova entidade dedicada" passa a significar "entidade Season
  dedicada, materializada estendendo `public.seasons`". Comportamento idêntico ao clarificado.

## R2. Finalização da súmula reutiliza a cadeia de consolidação existente

- **Contexto**: FR-034/FR-035/SC-004 exigem que a estatística oficial reflita exatamente a súmula
  revisada, atomicamente. O MVP já tem `public.consolidate_match(match_uuid, mbj_score,
  opponent_score, goals_input jsonb, idempotency_key)` — `security definer`, exige PRESIDENT+AAL2 e
  lineup `PUBLISHED`, cria uma revisão imutável em `match_consolidations` + `match_goals`, abre
  votação MVP, marca a partida `COMPLETED`, enfileira notificação e grava audit log. Há também
  `reopen_statistics`.
- **Decisão**: os `live_match_events` são uma **camada de rascunho**. "Confirmar e Finalizar Súmula"
  chama uma função nova `finalize_sumula(match_id, reviewed_payload jsonb, idempotency_key)` que,
  numa única transação: valida papel (COACH **ou** PRESIDENT) + AAL2; deriva `mbj_score` da contagem
  de eventos `GOAL` do time; **invoca a mesma lógica de `consolidate_match`** (refatorada para uma
  rotina interna `private.write_consolidation(...)`) para gravar consolidação + gols; grava
  `match_cards`, `match_substitutions` e `match_goalkeeper_assignments` vinculados à
  `consolidation_id`; chama `private.evaluate_trophies(season_id, affected_athletes)`; grava audit
  log; cacheia em `command_results`.
- **Racional**: uma segunda tabela de estatística "ao vivo consolidada" criaria divergência
  estrutural com o MVP. Reusar `match_consolidations` torna SC-004 uma garantia de schema, não de
  código de aplicação.
- **Ajuste necessário**: `consolidate_match` hoje exige `PRESIDENT`; a finalização de súmula é
  permitida à **comissão técnica (COACH) ou admin**. A rotina interna passa a receber o ator já
  autorizado pela função chamadora; a função pública antiga mantém `require_president_aal2()` para
  não afrouxar o fluxo manual atual.
- **Registrador sem papel de comissão**: pode abrir a tela de revisão e **editar eventos**
  (`log`/`undo`/`amend` em `live_match_events` enquanto `setup.status='IN_REVIEW'`), mas o RPC
  `finalize_sumula` rejeita quem não for COACH/PRESIDENT (FR-034, SC-013, cenário 9).
- **Alternativas**: tabela de estatística ao vivo independente + job de cópia — rejeitada (janela de
  divergência, dobra a superfície de teste de SC-004).

## R3. "Jogou a partida", "goleiro" e clean sheet a partir da súmula finalizada (Q4)

- **Decisão**: derivar de dados já vinculados à `consolidation_id`:
  - **Jogou**: atleta presente em `lineup_players` da `lineup_id` consolidada (STARTER ou RESERVE)
    **e** com participação efetiva — STARTER, ou RESERVE que entrou via `match_substitutions`.
    Contador "Veterano" conta partidas finalizadas distintas na temporada ativa.
  - **Goleiro da partida**: registro em `match_goalkeeper_assignments (consolidation_id,
    athlete_id, from_minute, to_minute null)`. O Registrador marca o goleiro inicial no pré-jogo
    (a partir do lineup) e cada troca de goleiro gera novo registro + um `SUBSTITUTION`.
  - **Clean sheet (Muralha)**: `opponent_score = 0` na consolidação **e** o goleiro cobriu a
    partida inteira (um único `match_goalkeeper_assignments` com `to_minute is null`). Qualquer
    substituição de goleiro na partida ⇒ nenhum clean sheet creditado a nenhum dos goleiros
    daquela partida.
- **Racional**: a súmula finalizada é a única fonte que passou pela confirmação explícita da
  comissão (Princípio II). `lineup_players` e `match_substitutions` já bastam para "jogou".
- **Alternativas**: usar `match_presences` (compareceu) — rejeitada (comparecer ≠ jogar); flag
  manual de goleiro por partida sem vínculo com substituição — rejeitada (não permite anular clean
  sheet em troca de goleiro).

## R4. Fórmula do overall do cartão de atributos

- **Decisão**: `overall = round((pace + shooting + passing + dribbling + defending + physical) / 6)`
  — média aritmética simples, arredondada, calculada como coluna gerada no banco
  (`athlete_card_attributes.overall generated always as (...) stored`). Cartão exibe estado
  "incompleto" enquanto qualquer um dos seis for nulo (FR-020).
- **Racional**: EA FC usa pesos por posição, mas isso exigiria um mapa posição→pesos e decisões de
  produto que o spec adiou; a média simples é determinística, testável (SC-009) e trivial de
  evoluir depois. Princípio III (simplicidade).
- **Alternativas**: pesos por posição — adiado; overall editável à mão — rejeitado (SC-009 exige
  consistência com a derivação).

## R5. Rateio do evento social — somente exibição, recálculo dinâmico, congelamento no fechamento

- **Decisão**: enquanto `social_events.status = 'OPEN'`, `cost_per_person` é **derivado em leitura**
  (view/função) = `total_cost / max(sum(1 + guests_count) filter (status='CONFIRMED'), 0)`; com 0
  confirmados a API retorna `cost_per_person = null` + flag `split_unavailable` (FR-016). O comando
  `close_social_event` grava `cost_per_person` e `people_count` congelados na linha do evento e
  muda `status` para `CLOSED`; mudanças posteriores de presença/acompanhantes não alteram os
  valores congelados (FR-015, E-02). Não cria cobrança `EVENT_FEE` (FR-017).
- **Racional**: manter o valor "vivo" fora do banco evita escrita a cada mudança de acompanhante;
  congelar na transação de fechamento dá o R$ 0,00 de erro exigido por SC-002 (a soma das cotas
  congeladas = `total_cost` por construção, distribuindo o resto de centavos de forma determinística
  — ver data-model).
- **Alternativas**: materializar `cost_per_person` a cada mudança — rejeitada (escrita desnecessária,
  corrida); lançar `EVENT_FEE` no fechamento — fora de escopo nesta fase por FR-017.
- **Cap de acompanhantes**: `guests_count` restrito a `0..20` por atleta por evento — valor
  confirmado pelo responsável em 2026-09-08 (spec FR-012, Clarifications).

## R6. Geração mensal de cobranças, transição OVERDUE e destaques semanais via Supabase Cron

- **Decisão**: três agendamentos `cron.schedule` (pg_cron, já disponível no Supabase, previsto em
  TECH_STACK §10):
  - **Mensal** (dia 1, 06:00 America/Sao_Paulo → configurar em UTC): `generate_monthly_dues()` —
    para a temporada ativa e cada atleta `status <> 'INACTIVE'` sem isenção no período, insere
    `athlete_charges (type='MONTHLY_AUTOMATIC', amount=dues_settings.default_amount,
    due_date = date_trunc('month', now()) + interval '9 days', status='PENDING',
    period = to_char(now(),'YYYY-MM'))`. Idempotência: `unique (athlete_id, period) where type =
    'MONTHLY_AUTOMATIC'`; a função também é exposta como RPC "rodar agora" para a diretoria (FR-001,
    FR-002, SC-001).
  - **Diário** (03:00): `mark_overdue_charges()` — `update athlete_charges set status='OVERDUE'
    where status='PENDING' and due_date < current_date` (FR-007).
  - **Semanal** (segunda, 08:00): `generate_weekly_highlights()` — regra determinística sobre as
    consolidações da temporada ativa dos últimos 7 dias: artilheiro (mais `GOAL`), garçom (mais
    `ASSIST`), goleiro (menor `opponent_score` somado entre partidas em que foi goleiro; empate →
    mais partidas; ainda empatado → categoria omitida). Enfileira 1 item em
    `notification_outbox` via `private.enqueue_notification(...)`, consumido pela Edge Function
    `dispatch-notifications` existente (FR-025, FR-025a/b, SC-014).
- **Racional**: pg_cron + função `security definer` é o padrão do MVP para "prazos que não podem
  depender de alguém abrir o painel". Sem broker de fila (Princípio III / TECH_STACK §3).
- **Alternativas**: Edge Function agendada externamente (n8n) — rejeitada (n8n é só para backup;
  acoplar rotina de domínio a ele aumenta o fator ônibus); cálculo on-read dos destaques — rejeitado
  (precisa disparar push num instante fixo).

## R7. Transmissão em tempo real dos eventos ao vivo

- **Decisão**: Supabase Realtime **Postgres Changes** na tabela `live_match_events` filtrado por
  `match_id`, com RLS de `select` liberando qualquer conta ativa (torcedores/atletas autenticados —
  Assumptions). O `undo` marca `undone_at`/`undone = true` (não deleta) e essa própria alteração é
  um evento de mudança propagado (FR-030, FR-031). Tela de torcedor ignora eventos `undone`.
- **Racional**: reusa exatamente o mecanismo já ligado no MVP para telas administrativas
  (TECH_STACK §10). p95 < 2 s (SC-003) é folgado para o volume de um jogo.
- **Alternativas**: canal Broadcast efêmero — rejeitado (perde o histórico persistente que a tela de
  revisão e a sincronização offline precisam); WebSocket próprio — fora do TECH_STACK.

## R8. Fila offline da súmula — IndexedDB + UUID de cliente

- **Decisão**: `live-match/lib/offline-queue.ts` — wrapper próprio fino sobre IndexedDB (uma store
  `pending_events`, chave = `client_event_id` UUID v4 gerado no clique). Ao registrar um evento
  offline: grava na store e tenta o RPC `log_live_event`; o RPC recebe `client_event_id` e faz
  `insert ... on conflict (client_event_id) do nothing returning` → idempotente (FR-037a). Um
  listener de `online` drena a store em ordem de `created_at`. `finalize_sumula` rejeita se
  `exists(select 1 from pending client events not yet acked)` — na prática a tela mantém um contador
  local e desabilita "Finalizar" enquanto a store não esvazia (FR-037b, cenário 7, SC-012).
  Conflito básico: se o servidor já tem o evento (mesmo `client_event_id`), o cliente marca como
  sincronizado; se um `undo` chega antes do `log` correspondente, o servidor aceita e reconcilia por
  `client_event_id` alvo.
- **Racional**: IndexedDB sobrevive a recarregar/fechar a aba (ao contrário de memória) e tem
  capacidade folgada; sem `localStorage` (limite pequeno, serialização síncrona). Sem lib `idb` —
  o uso é uma única store simples (Princípio III, "nenhuma dependência nova").
- **Alternativas**: `localStorage` — rejeitado (5 MB, bloqueia thread); lib `idb`/`dexie` —
  desnecessária para uma store; Service Worker Background Sync — suporte irregular em iOS PWA, que é
  o alvo do vestiário.
- **Escopo da exceção ao Princípio V**: registrado em `plan.md` Complexity Tracking. Nenhuma outra
  tela do app ganha escrita offline; o cache offline read-only existente (próximo jogo / escalação)
  é intocado.

## R9. RBAC — sem papel novo

- **Decisão**: `app_role` permanece `('PRESIDENT','COACH','ATHLETE')`.
  - **Diretoria / Financeiro** (FR-010, FR-1.2) → `PRESIDENT` + AAL2, reusando
    `private.require_president_aal2()`. "Financeiro" é tratado como pessoa que detém o papel
    PRESIDENT nesta fase; um papel `FINANCE` dedicado fica como evolução futura.
  - **Comissão técnica** (atributos, marcar partida ao vivo, designar Registrador, finalizar
    súmula, abrir/encerrar temporada) → `COACH` **ou** `PRESIDENT` + AAL2.
  - **Registrador de Campo** → autorização pontual: linha em `live_match_setups` com
    `recorder_user_id`. `log_live_event`/`undo_live_event` checam
    `setup.recorder_user_id = auth.uid() and setup.status = 'RECORDING'` **ou** papel COACH/PRESIDENT
    (FR-028a/b, SC-013). Sem entrada em `user_roles`; expira ao mudar `status` para
    `IN_REVIEW`/`FINALIZED`/`CANCELLED` ou ao regravar `recorder_user_id`.
- **Racional**: adicionar valor a um enum de papel exige migração de dados e revisão de toda a
  matriz RLS (Princípio I) sem ganho real para um clube. O spec já admite o fallback para PRESIDENT.
- **Alternativas**: enum `FINANCE` — adiado; tabela de permissões finas — excesso para o MVP.

## R10. Cartões, substituições e goleiro no modelo

- **Decisão**: novas tabelas vinculadas à `consolidation_id` (não à partida solta), preenchidas na
  transação `finalize_sumula` a partir dos `live_match_events` revisados:
  `match_cards (consolidation_id, athlete_id, card_type YELLOW/RED, minute)`,
  `match_substitutions (consolidation_id, out_athlete_id, in_athlete_id, minute)`,
  `match_goalkeeper_assignments (consolidation_id, athlete_id, from_minute, to_minute)`.
  Todas com trigger de imutabilidade equivalente a `reject_statistics_history_mutation` do MVP.
- **Racional**: espelha o padrão de `match_goals` (imutável, ligado à revisão de consolidação),
  então `reopen_statistics` + nova revisão continua sendo o único caminho de correção pós-fecho.

## Resumo das decisões

| # | Decisão |
|---|---|
| R1 | Estender `public.seasons` (colunas + `status` + comandos abrir/encerrar); não criar tabela nova |
| R2 | `finalize_sumula` reusa a lógica de `consolidate_match` (rotina interna); COACH/PRESIDENT+AAL2 |
| R3 | "Jogou"/"goleiro"/clean sheet derivados da súmula finalizada; troca de goleiro anula clean sheet |
| R4 | `overall` = média simples arredondada dos 6 atributos, coluna gerada |
| R5 | Rateio derivado em leitura enquanto OPEN; congelado na transação de fechamento; sem `EVENT_FEE` |
| R6 | 3 agendamentos pg_cron: geração mensal (+RPC manual), varredura OVERDUE diária, destaques semanais |
| R7 | Supabase Realtime Postgres Changes em `live_match_events` por `match_id`; undo = soft flag |
| R8 | Fila offline em IndexedDB (store única, UUID de cliente), dedupe `on conflict`, sem lib nova |
| R9 | Sem papel RBAC novo: PRESIDENT+AAL2 (finanças), COACH/PRESIDENT+AAL2 (comissão), Registrador pontual |
| R10 | `match_cards` / `match_substitutions` / `match_goalkeeper_assignments` ligados à `consolidation_id`, imutáveis |

Nenhum item `NEEDS CLARIFICATION` remanescente.
