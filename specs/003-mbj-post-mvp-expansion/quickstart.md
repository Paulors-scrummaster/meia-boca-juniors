# Quickstart — Validação do Post-MVP Modules Expansion (MBJ)

Guia de validação ponta a ponta. Não contém código de implementação — cada cenário aponta para o
requisito/critério de sucesso que prova. Detalhes de schema em `data-model.md`; assinaturas de
comando em `contracts/`.

## Pré-requisitos

- Stack local do MVP: `npm ci`, `npm run db:start` (Supabase local via Docker), `npm run db:reset`
  aplicando as migrações desta feature.
- Seed de teste (`supabase/seed.sql` estendido): 1 temporada `ACTIVE`, ≥ 20 atletas `ACTIVE`, 1
  goleiro identificável, ≥ 2 partidas `COMPLETED` contra um mesmo adversário (para o Raio-X) e 1
  partida `SCHEDULED` com lineup `PUBLISHED` (para a súmula ao vivo).
- Usuários de teste com AAL2 (TOTP) para `PRESIDENT` e `COACH`; um `ATHLETE` comum; um `ATHLETE`
  extra para atuar como Registrador sem papel de comissão.
- `npm run dev` para a interface; push desabilitado em ambiente local (fallback visual).

## Comandos

| Ação | Comando |
|---|---|
| Testes de banco (RLS, constraints, funções, idempotência) | `npm run test:db` |
| Testes unitários (rateio display, relógio da partida, fila offline, formatação pt-BR) | `npm run test:unit` |
| Testes ponta a ponta (fluxos abaixo) | `npm run test:e2e` |
| Lint / tipos / build | `npm run lint && npm run typecheck && npm run build` |
| Regenerar tipos do schema | `npm run db:types` |

---

## Cenário 1 — Geração mensal e baixa manual (Módulo 1 · US1 · SC-001, SC-006, SC-015)

1. Como `PRESIDENT`, definir o valor padrão da mensalidade (`set_default_dues_amount`).
2. Executar `run_monthly_dues_generation` para o mês corrente.
   **Esperado**: uma cobrança por atleta `ACTIVE`, `type=MONTHLY_AUTOMATIC`, `due_date` = dia 10,
   `status=PENDING`; retorno `created = nº de atletas ativos`, `skippedExisting = 0`.
3. Executar de novo o mesmo período.
   **Esperado**: `created = 0`, `skippedExisting = nº de atletas` — nenhuma duplicata (idempotência).
4. Conceder isenção (`grant_dues_exemption`, `period` do mês) a um atleta e rodar para o mês
   seguinte. **Esperado**: aquele atleta é pulado (`skippedExempt = 1`).
5. Como `ATHLETE` com cobrança `PENDING`: o painel mostra o badge "Pendente"; navegar para uma
   partida / escalação / votação **funciona normalmente** (SC-006).
6. Avançar o relógio além do `due_date` e rodar `mark_overdue_charges`.
   **Esperado**: a cobrança vira `OVERDUE`, badge "Em Atraso", acesso ainda liberado.
7. Como `PRESIDENT`, `settle_charge` na cobrança.
   **Esperado**: `status=PAID`, `settled_by/at` gravados, audit `CHARGE_SETTLED`, badge some.
8. `reverse_charge_settlement` na mesma cobrança.
   **Esperado**: volta para `OVERDUE` (pois `due_date` já passou), `settled_*` limpos, audit
   `CHARGE_SETTLEMENT_REVERSED` (SC-015).
9. `cancel_charge` numa outra cobrança `PENDING`.
   **Esperado**: `status=CANCELLED`, sai do badge e dos totais de `finance_overview` (SC-015).

## Cenário 2 — Churrasco e rateio (Módulo 2 · US2 · SC-002, SC-008)

1. Como `PRESIDENT`, `create_social_event("Churrasco da Vitória", ..., total_cost = 600.00)`.
2. 10 atletas `set_event_presence(CONFIRMED, guests_count = 0)`; 5 deles ajustam para
   `guests_count = 1` (15 pessoas).
   **Esperado**: `social_event_split` → `peopleCount = 15`, `costPerPerson = 40.00`; todo
   participante confirmado vê **R$ 40,00** (SC-008).
3. Um atleta muda `guests_count` de 1 para 2.
   **Esperado**: `costPerPerson` recalcula imediatamente (16 pessoas → R$ 37,50).
4. Zerar todas as confirmações e ler o split.
   **Esperado**: `splitUnavailable = true`, `costPerPerson = null` — sem erro/divisão por zero
   (FR-016).
5. Restaurar as 16 pessoas; `close_social_event`.
   **Esperado**: `status=CLOSED`; `Σ shares == 600.00` exatamente (distribuição de centavos), com
   diferença R$ 0,00 (SC-002); mudanças de presença posteriores retornam `EVENT_CLOSED` e não
   alteram os valores congelados.

## Cenário 3 — Súmula ao vivo, desfazer e offline (Módulo 4 · US3 · SC-003, SC-005, SC-012, SC-013)

1. Como `COACH`, `enable_live_recording(matchScheduled, recorder = atletaExtra, startingGk)`.
   **Esperado**: `live_match_setups.status=RECORDING`; a tela de cronômetro aparece só para partidas
   com setup (partida sem setup → sem interface).
2. Como o **Registrador (atleta extra, sem papel de comissão)**: iniciar o cronômetro (00:00);
   `log_live_event(GOAL, athlete #9, minute 14)`; em seguida `log_live_event(GOAL, athlete #9,
   minute 14)` de novo (clique acidental).
3. Numa segunda aba autenticada (torcedor), observar o feed em tempo real.
   **Esperado**: os eventos aparecem em < 2 s (SC-003).
4. Registrador clica **"Desfazer"** imediatamente (`undo_live_event`).
   **Esperado**: o 2º gol fica `undone`; feed do torcedor passa a mostrar **1 gol aos 14'**
   (SC-005). Repetir "Desfazer" após 30 s → `UNDO_WINDOW_EXPIRED`.
5. Simular perda de conexão (DevTools offline); registrar `YELLOW_CARD` e `SUBSTITUTION`.
   **Esperado**: eventos gravados na store IndexedDB `pending_events`; contador "pendências de
   sincronização" > 0; botão "Confirmar e Finalizar Súmula" **desabilitado**.
6. Restaurar a conexão.
   **Esperado**: a fila drena automaticamente; cada `log_live_event` com o mesmo `client_event_id`
   é idempotente (`deduped=true` se reenviado); contador zera (SC-012).
7. `end_live_recording` → `status=IN_REVIEW`. Como Registrador, `amend_live_event` corrigindo o
   minuto de uma assistência. **Esperado**: permitido.
8. Como Registrador, tentar `finalize_sumula`.
   **Esperado**: `FORBIDDEN` — finalização é da comissão/admin (SC-013, cenário 9).

## Cenário 4 — Revisão pós-jogo e consolidação (Módulo 4 + 3 · US3/US4 · SC-004, SC-011)

1. Como `COACH` (AAL2), abrir a tela de revisão da partida em `IN_REVIEW`; conferir gols, cartões,
   substituições e o goleiro da partida.
2. Ajustar o autor de uma assistência; `finalize_sumula`.
   **Esperado**: retorno `{ consolidationId, revision, mbjScore, opponentScore, trophiesAwarded }`;
   `matches.status=COMPLETED`; `match_consolidations` (revisão nova) + `match_goals` +
   `match_cards` + `match_substitutions` + `match_goalkeeper_assignments` **refletem exatamente** o
   revisado — 0 % de divergência (SC-004); votação MVP aberta; notificação enfileirada.
3. Repetir `finalize_sumula` com o mesmo `idempotencyKey`.
   **Esperado**: mesmo resultado, sem segunda consolidação (idempotência).
4. Preparar dados para um gatilho (ex.: atleta atinge 10 gols na temporada; ou 3 gols nesta
   partida). Finalizar.
   **Esperado**: `athlete_trophies` recebe o troféu correspondente marcado com a temporada ativa,
   sem duplicar se já existir na mesma temporada (SC-011).
5. `open_season(next year)` e repetir o gatilho na nova temporada.
   **Esperado**: contadores recomeçam do zero; o troféu da temporada anterior continua visível na
   galeria; o mesmo tipo pode ser conquistado de novo (SC-011).
6. Substituição de goleiro no meio de um jogo + 0 gols sofridos.
   **Esperado**: **nenhum** clean sheet creditado a nenhum goleiro naquele jogo (R3).

## Cenário 5 — Cartões, Raio-X e histórico (Módulo 3 · US4 · SC-009, SC-010)

1. Como `COACH`, `set_athlete_attributes` com os seis valores (1..99) de um atleta; abrir o **cartão
   detalhado** no perfil.
   **Esperado**: formato retrato colecionável ≈ 2:3 com moldura dourada e topo ornamental; coluna de
   informação (overall grande = `round(média dos seis)`, sigla de posição, bandeira do Brasil,
   escudo MBJ); foto do atleta como elemento central sobreposto à moldura/fundo; nome grande
   centralizado embaixo; tira de atributos `RIT/FIN/PAS/CON/DEF/FÍS` com valores; tudo por tokens
   Dark Navy + gold; **nenhum** logo/marca EA/FIFA e nenhum JPEG de referência no DOM/bundle
   (SC-009).
2. Deixar um atributo nulo.
   **Esperado**: cartão (detalhado e compacto) em estado "incompleto" — "—" por atributo não
   definido, sem número de `overall` (FR-020).
2a. Abrir uma listagem com vários atletas (grade do elenco).
   **Esperado**: cada atleta como **cartão compacto** preservando foto, `overall`, nome, posição e a
   identidade gold-on-navy; a grade reflui em desktop/tablet/mobile.
3. Abrir o detalhe da partida `SCHEDULED` contra o adversário com histórico.
   **Esperado**: card "Raio-X" com vitórias/empates/derrotas/saldo iguais a uma contagem
   independente das partidas concluídas contra aquele adversário (SC-010).
4. Abrir o detalhe de uma partida contra adversário inédito.
   **Esperado**: "sem histórico" (não zeros).
5. Abrir a aba "Histórico & Conquistas".
   **Esperado**: retrospecto agregado do clube + galeria de troféus de todas as temporadas.

## Cenário 6 — Destaques semanais/pré-jogo e resiliência de push (Módulo 3 · SC-007, SC-014)

1. Consolidar partidas na última semana; executar `generate_weekly_highlights` duas vezes sobre os
   mesmos dados.
   **Esperado**: conjunto idêntico de categorias e atletas nomeados — determinístico (SC-014); 1
   item em `notification_outbox` com `route=/app/historico`.
2. Disparar `generate_pre_match_highlights(match_id)` para a partida `SCHEDULED` (via a rotina de
   lembrete ~24 h antes; sem novo scheduler).
   **Esperado**: 1 item `PRE_MATCH_HIGHLIGHTS` com `route=/app/partidas/:matchId`, payload =
   estatísticas-chave da temporada ativa do MBJ + Raio-X vs o adversário (sem estatísticas de
   temporada do adversário); re-disparar para o mesmo `match_id` **não** enfileira segundo item
   (idempotência).
3. Simular indisponibilidade do provedor de push (adapter OneSignal retornando erro).
   **Esperado**: geração de mensalidades, criação de evento, registro ao vivo, `finalize_sumula` e a
   própria rotina de lembrete continuam funcionando (SC-007, FR-026).

---

## Portões antes de abrir PR

- [ ] `npm run lint && npm run typecheck && npm run test:unit && npm run test:db && npm run build` — verde.
- [ ] `npm run test:e2e` cobrindo os Cenários 1–6.
- [ ] Revisão de RLS/privacidade das novas tabelas registrada no PR.
- [ ] Backup verificado do Supabase de produção **antes** de aplicar as migrações críticas.
- [ ] `plan.md` Complexity Tracking — o único desvio constitucional ativo (Princípio V, buffer
      offline da súmula) revisto, com remediation/migration plan formal. O Módulo Financeiro **não**
      é desvio: compatível pela Constituição v1.1.0 (limite "Internal Financial Bookkeeping" do
      Princípio III).
- [ ] Preview do Cloudflare validado para as telas novas (WCAG AA: contraste, foco, teclado, alvos
      de toque).
