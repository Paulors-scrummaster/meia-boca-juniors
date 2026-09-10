# Implementation Plan: Post-MVP Modules Expansion (MBJ)

**Branch**: `003-mbj-post-mvp-expansion` | **Date**: 2026-09-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-mbj-post-mvp-expansion/spec.md`

## Summary

Quatro pilares pós-MVP construídos sobre o mesmo webapp React/Vite + Supabase, reutilizando
`athletes`, `user_roles`, `matches`, `match_presences`, `lineups`, `seasons` e a cadeia de
consolidação existente:

1. **Financeiro & Mensalidades** — geração automática mensal de cobranças (Supabase Cron), cobranças
   manuais, isenções por período, transição diária para `OVERDUE`, badge discreto de inadimplência
   sem bloqueio de acesso, baixa manual e estorno auditados, além de `CANCELLED`.
2. **Resenha / Churrasco** — eventos sociais desacoplados de partidas, confirmação com acompanhantes,
   rateio recalculado dinamicamente e congelado no fechamento (somente exibição, sem lançar no
   ledger nesta fase).
3. **UX & Gamificação** — cartão colecionável premium de jogador com identidade MBJ (inspirado em
   EA FC, **sem** logos/marcas de terceiros; ver referências `exemplo card ea fifa*.jpeg` na raiz),
   nos formatos detalhado e compacto, editado pela comissão; catálogo fixo de 5 troféus com
   contadores por temporada ativa, card "Raio-X" de confronto direto derivado das partidas
   concluídas, aba "Histórico & Conquistas" e notificações push semanais geradas por regra
   determinística.
4. **Súmula Live** — marcação de partida como registrada ao vivo, designação de Registrador por
   partida (autorização pontual, não papel global), cronômetro com ações rápidas e desfazer de 30 s,
   transmissão em tempo real por Supabase Realtime, buffer offline **restrito a esta tela**, e tela
   de revisão pós-jogo cuja finalização (exclusiva da comissão/admin) chama a transação de
   consolidação existente — estendida para cartões, substituições, goleiro da partida e reavaliação
   de troféus.

**Abordagem técnica**: nenhuma dependência de runtime nova. Regras críticas (geração de cobranças,
transição de status, rateio consolidado, finalização de súmula, atribuição de troféus) vivem em
funções PostgreSQL `security definer` transacionais, com o padrão de idempotência
`private.command_results` já em uso. A estatística oficial continua tendo `match_consolidations` /
`match_goals` como fonte única — a camada ao vivo é apenas rascunho até a finalização. O buffer
offline usa IndexedDB com UUID gerado no cliente para deduplicação na sincronização.

**Uma** exceção constitucional permanece ativa e está registrada em **Complexity Tracking** com
remediation/migration plan: o buffer offline da súmula perante o Princípio V. O Módulo Financeiro
**deixou de ser um desvio** — a Constituição foi emendada para **v1.1.0** (2026-09-08) com um limite
explicitamente permitido "Internal Financial Bookkeeping" no Princípio III; o módulo é ledger
interno (registra quem deve, quanto, vencimento e baixa manual) e nunca processa a transação.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), React 19.2, Node `>=24 <25`, PostgreSQL 15 (Supabase)

**Primary Dependencies**: `@supabase/supabase-js` 2.112, TanStack Query 5, Zustand 5, React Hook
Form 7 + Zod 3, React Router 7.18, Tailwind 4.3 + shadcn/ui, `lucide-react`, `vite-plugin-pwa` 1.3.
Adapters existentes: Supabase, OneSignal Web Push, Sentry. **Nenhuma dependência de runtime nova
(npm).** IndexedDB é acessado por um wrapper próprio fino em `src/features/live-match/lib/` (sem
`idb`). **Novos assets estáticos** (não são dependências npm): um tipo de exibição esportivo
self-hosted SIL OFL (`public/fonts/`, exposto como token `--font-display`) e alguns SVGs do cartão
de jogador (moldura, camadas de fundo, bandeira do Brasil, silhueta placeholder) — ver Project
Structure. As imagens de referência `exemplo card ea fifa*.jpeg` permanecem na raiz como referência
visual e **não** são empacotadas.

**Storage**: Supabase PostgreSQL. Novas tabelas em `public.` com RLS: `athlete_charges`,
`dues_settings`, `dues_exemptions`, `social_events`, `social_event_presences`,
`athlete_card_attributes`, `trophy_catalog` (seed estático), `athlete_trophies`,
`live_match_setups`, `live_match_events`, `match_cards`, `match_substitutions`,
`match_goalkeeper_assignments`. Extensão de `public.seasons` (novas colunas `starts_on`, `ends_on`,
`status` + comandos de abrir/encerrar). Migrações SQL versionadas via Supabase CLI.

**Testing**: Vitest 4 + Testing Library (unidade/integração, jsdom); `supabase test db` (pgTAP) para
RLS, constraints, funções transacionais e idempotência; Playwright 1.62 + `@axe-core/playwright`
para fluxos críticos e acessibilidade (projetos desktop-chromium e mobile-chromium).

**Target Platform**: PWA web responsiva mobile-first, navegadores perene-atuais. Produção em
`https://meiabocajuniors.dbidigital.com.br`. React Native / lojas fora de escopo (Princípio III).

**Project Type**: Aplicação web de página única, monolito modular por feature, projeto único.

**Performance Goals**: SC-003 — evento ao vivo visível nas telas de torcedores/atletas em < 2 s no
p95. SC-001 — lote mensal cobre 100 % dos atletas ativos em uma execução. Geração mensal e varredura
diária de `OVERDUE` concluídas dentro da janela de um agendamento Supabase Cron sem timeout para o
volume de um clube (< 60 atletas). Sem regressão nos orçamentos de `tests/e2e/performance.spec.ts`.

**Constraints**: escrita offline permanece desabilitada em todo o app **exceto** na tela de súmula
ao vivo (exceção registrada); inadimplência nunca bloqueia acesso a partidas, escalação ou votação
(FR-006/SC-006); estatística oficial nunca depende só do cliente (Princípio II); finalização de
súmula é atômica e idempotente (SC-004); RLS + RBAC em toda operação, ID nunca autoriza sozinho;
auditoria de ator/data/ação/recurso em toda ação administrativa e transição de status de cobrança;
2FA (AAL2) obrigatório para ações de PRESIDENT/COACH; interface pt-BR, código/identificadores em
inglês; datas em UTC exibidas em `America/Sao_Paulo`; valores em `pt-BR`; WCAG AA.

**Scale/Scope**: 1 clube, ~20–60 atletas, ~1–2 partidas/semana. 4 módulos, ~15 tabelas novas + 1
extensão, ~10 funções RPC transacionais, 3 agendamentos Cron (mensal, diário, semanal), 3 papéis
existentes (`PRESIDENT`, `COACH`, `ATHLETE`) sem papel novo. ~9 telas/áreas novas de interface.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Antes da Fase 0

| Princípio | Portão | Veredito |
|---|---|---|
| I. Segurança imposta pelo servidor | Autorização, RLS, auditoria e segredos tratados no servidor? | **PASS** — toda tabela nova tem RLS; comandos privilegiados são funções `security definer` com checagem de papel + AAL2; toda transição de status de cobrança, baixa, estorno, cancelamento, isenção, finalização de súmula e abertura/encerramento de temporada grava audit log (ator, data, ação, recurso, motivo). Nenhum segredo novo; push continua encapsulado no adapter OneSignal. Autorização do Registrador é pontual por partida e revogada em finalize/cancel/redesignação. |
| II. Integridade de domínio e preservação da história | Invariantes, atomicidade e cálculos oficiais protegidos no banco? | **PASS** — FKs reais com `on delete restrict`; unicidade composta (`athlete_charges` por atleta+período mensal; `athlete_trophies` por atleta+tipo+temporada; `social_event_presences` por evento+atleta). Rateio consolidado, finalização de súmula e reavaliação de troféus rodam em uma função transacional única reutilizando `match_consolidations`/`match_goals` como fonte única. Histórico de troféus e de temporadas anteriores é imutável; nada é apagado ao abrir nova temporada. |
| III. Simplicidade do MVP e escopo controlado | Sem infra nova injustificada; TECH_STACK respeitado; escrituração financeira interna dentro do limite permitido | **PASS** — a Constituição **v1.1.0** (2026-09-08) define no Princípio III o limite permitido "Internal Financial Bookkeeping": geração/controle de mensalidades, registros de cobrança, estados PENDING/PAID/OVERDUE/CANCELLED, baixa manual, reversão de baixa, cancelamento, isenções, inadimplência, rateios internos, histórico/auditoria financeira e os cron jobs internos dessas funções. O Módulo Financeiro fica inteiramente dentro desse limite: **sem** gateway, PIX, cartão, boleto externo, checkout, wallet/saldo, movimentação real de dinheiro, integração externa de billing ou e-mail transacional que exija novo provedor. Custo incremental de infraestrutura R$ 0. Demais itens: monolito modular por feature mantido, Supabase Cron/Realtime/Edge já previstos no TECH_STACK (§10), nenhuma dependência de runtime nova, nenhum papel RBAC novo. |
| IV. Portões automáticos de qualidade | TS estrito, CI, testes dos fluxos críticos, WCAG AA | **PASS (planejado)** — fluxos críticos com teste no nível adequado: geração mensal e idempotência, transição `OVERDUE`, baixa/estorno/cancelamento, rateio exato (SC-002/SC-008), desfazer 30 s (SC-005), sincronização offline sem duplicata (SC-012), finalização de súmula sem divergência (SC-004), autorização do Registrador (SC-013), determinismo dos destaques (SC-014). Regressão para cada bug reproduzível. `lint`/`typecheck`/`test:unit`/`test:db`/`build` no CI. Cartões, badges e telas novas em WCAG AA. |
| V. Resiliência, privacidade e operabilidade | Falha externa degrada bem; offline read-only; logs sem PII | **DESVIO APROVADO PELO RESPONSÁVEL** — o buffer offline da tela de súmula ao vivo enfileira escritas, o que o Princípio V proíbe. Aprovação do responsável registrada no spec desde a `/speckit-specify` (E-03, Assumptions, Dependencies: "Owner-approved exception to constitution Principle V"). Escopo mínimo: só esta tela, só eventos não sincronizados da partida ativa, dedupe por UUID de cliente, finalização bloqueada até o buffer esvaziar. Ver Complexity Tracking (inclui remediation/migration plan formal com review triggers e removal path). Demais itens: falha de push/realtime não bloqueia nenhum fluxo (FR-026); persistência offline segue allowlist versionada com expiração e purga no logout; logs/Sentry sem dados pessoais desnecessários; nenhum segredo em log. |

**Resultado do portão**: PROSSEGUE para a Fase 0. **Um único desvio constitucional ativo** — o
buffer offline da súmula perante o Princípio V — com aprovação do responsável registrada no spec
desde a `/speckit-specify`, necessidade demonstrada, alternativa mais simples avaliada, escopo
estritamente delimitado e remediation/migration plan em Complexity Tracking, conforme a Governança
da Constituição. O Módulo Financeiro deixou de ser desvio com a emenda da Constituição para v1.1.0.

### Depois da Fase 1

| Princípio | Reavaliação |
|---|---|
| I | **PASS** — `data-model.md` define RLS por tabela e `contracts/` define cada RPC com papel exigido, AAL2, idempotência e entradas de auditoria. Nenhuma leitura de dado pessoal alheio pelo cliente. |
| II | **PASS** — `data-model.md` fixa FKs, `on delete restrict`, unicidades compostas, máquinas de estado (`athlete_charges`, `social_events`, `live_match_setups`, `seasons`) e a transação única de finalização. Views de Raio-X e agregados de troféu são derivadas, não armazenadas. |
| III | **PASS (inalterado)** — dentro do limite "Internal Financial Bookkeeping" da Constituição v1.1.0; o rateio permanece somente exibição (FR-017), sem lançamento automático no ledger. |
| IV | **PASS** — `quickstart.md` enumera os cenários de validação ponta a ponta ligados a cada SC. |
| V | **DESVIO APROVADO, INALTERADO** — buffer offline permanece confinado a `live_match_events` na tela de súmula; o restante do offline continua read-only. Remediation/migration plan formal em Complexity Tracking. |

## Project Structure

### Documentation (this feature)

```text
specs/003-mbj-post-mvp-expansion/
├── plan.md              # Este arquivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/           # Fase 1
│   ├── finance.md
│   ├── social-events.md
│   ├── gamification.md
│   └── live-match.md
├── checklists/
│   └── requirements.md  # do /speckit-specify + /speckit-clarify
└── tasks.md             # Fase 2 (/speckit-tasks — não criado aqui)
```

### Source Code (repository root)

```text
src/
├── features/
│   ├── finance/                     # Módulo 1
│   │   ├── api/                     # service layer -> supabase-js / RPC
│   │   ├── queries/                 # TanStack Query hooks
│   │   ├── components/              # DelinquencyBadge, ChargeList, SettleDialog...
│   │   ├── pages/                   # painel financeiro da diretoria
│   │   └── lib/                     # formatação pt-BR de moeda, período
│   ├── social-events/              # Módulo 2
│   │   ├── api/ queries/ components/ pages/
│   │   └── lib/                     # cálculo de rateio (espelho do SQL, só display)
│   ├── gamification/               # Módulo 3
│   │   ├── api/ queries/ components/ pages/
│   │   ├── components/AttributeCard/  # cartão colecionável premium MBJ (tokens Dark Navy + gold)
│   │   │   ├── AttributeCard.tsx          # orquestrador; prop variant: 'detailed' | 'compact'
│   │   │   ├── CardFrame.tsx              # moldura ornamental (SVG inline, stroke por token)
│   │   │   ├── CardBackdrop.tsx           # fundo premium (gradiente + glow + raios + partículas + marca d'água do escudo)
│   │   │   ├── CardInfoRail.tsx           # overall + posição + bandeira BR + escudo MBJ (detailed)
│   │   │   ├── CardPhoto.tsx              # foto do atleta com fallback: cutout → avatar → silhueta
│   │   │   ├── CardNameplate.tsx          # nome + réguas douradas
│   │   │   ├── CardAttributes.tsx         # tira RIT/FIN/PAS/CON/DEF/FÍS + estado "incompleto"
│   │   │   └── attributeCard.constants.ts # mapa sigla↔atributo, proporção 2:3, breakpoints
│   │   ├── components/RaioXCard/
│   │   ├── pages/HistoryAchievements/
│   │   └── assets/                    # SVGs próprios do cartão (card-frame, card-backdrop, br-flag, card-photo-placeholder)
│   └── live-match/                 # Módulo 4
│       ├── api/ queries/ components/ pages/
│       ├── components/Stopwatch/ QuickActions/ UndoButton/ ReviewScreen/
│       └── lib/                     # relógio da partida, fila offline IndexedDB, dedupe
├── shared/
│   ├── adapters/                    # supabase, push, monitoring (existentes; reutilizados)
│   └── types/                      # tipos gerados do schema (npm run db:types)
└── app/
    ├── router/                     # novas rotas /app/financeiro, /app/resenhas, /app/historico, súmula
    └── layouts/navigation/         # novo item de menu "Histórico & Conquistas"

supabase/
├── migrations/
│   ├── 20260908xxxx00_seasons_lifecycle.sql        # colunas + comandos abrir/encerrar temporada
│   ├── 20260908xxxx10_finance_schema.sql            # tabelas + RLS + constraints
│   ├── 20260908xxxx11_finance_commands.sql          # RPC: create/settle/reverse/cancel/exempt/config
│   ├── 20260908xxxx12_finance_cron.sql              # geração mensal + varredura OVERDUE
│   ├── 20260908xxxx20_social_events_schema.sql
│   ├── 20260908xxxx21_social_events_commands.sql    # RPC: create/confirm/close (rateio consolidado)
│   ├── 20260908xxxx30_card_attributes.sql
│   ├── 20260908xxxx31_trophies_schema_seed.sql      # trophy_catalog seed + athlete_trophies + RLS
│   ├── 20260908xxxx32_trophy_evaluation.sql         # função chamada na consolidação
│   ├── 20260908xxxx33_raio_x_views.sql              # view de confronto direto
│   ├── 20260908xxxx34_weekly_highlights_cron.sql    # regra determinística -> notification_outbox
│   ├── 20260908xxxx40_live_match_schema.sql         # setups, events, cards, subs, gk assignment
│   ├── 20260908xxxx41_live_match_commands.sql       # RPC: enable/assign/log/undo/finalize
│   └── 20260908xxxx42_finalize_sumula.sql           # estende consolidate_match p/ cards/subs/gk/troféus
└── tests/                                            # pgTAP por área

tests/
├── unit/          # regras de formatação, cálculo de rateio (display), relógio da partida, fila offline
└── e2e/           # quickstart -> Playwright: financeiro, resenha, súmula live, histórico
```

**Structure Decision**: mantém-se o monolito modular por feature já adotado (`src/features/*` com
`api/queries/components/pages/lib`), a camada de serviço no front, e regras privilegiadas em
funções SQL/Edge — exatamente o padrão do MVP (TECH_STACK §1). Cada módulo é uma feature
autocontida; o `shared/` recebe apenas os tipos gerados do schema. Nenhuma reorganização de
diretórios existentes.

> Os nomes de arquivo de migração na árvore acima (`20260908xxxx*_*.sql`) são **ilustrativos**;
> `tasks.md` contém a decomposição final e os nomes concretos (ex.: os comandos financeiros são
> divididos em `_finance_commands_admin` / `_finance_commands_settlement` / `_finance_exemptions`).

### Cartão de jogador (US4) — abordagem de UI e assets

- **Composição** derivada das referências `exemplo card ea fifa*.jpeg` (raiz, referência apenas):
  formato retrato colecionável ≈ 2:3, moldura dourada dupla com topo ornamental, coluna de
  informação à esquerda (overall grande, sigla de posição, bandeira do Brasil, escudo MBJ), foto do
  atleta como herói central sobreposta à moldura, nome grande centralizado embaixo, tira dos seis
  atributos (`RIT/FIN/PAS/CON/DEF/FÍS`) na base. **Interpretação MBJ original** — sem logos EA/FIFA,
  sem silhueta de moldura proprietária, sem nomenclatura protegida.
- **Técnica**: moldura e fundo montados de **primitivas do projeto** — SVG inline + gradientes/CSS,
  cores **somente por token** (`--background`, `--card`, `--accent`, `--secondary`, `--ring`), para
  passar na varredura estática de tema da feature 002 (`tests/unit/theme-static-scan.test.ts`). Os
  JPEGs de referência nunca entram no bundle nem viram fundo do cartão.
- **Escala fluida** via CSS **container queries** no contêiner do cartão + `clamp()`/unidades
  relativas ao contêiner, para que o mesmo componente sirva desktop/tablet/mobile sem breakpoints
  manuais. `AttributeCard` recebe `variant`:
  - `detailed` — cartão completo (perfil do atleta, modal "ver cartão").
  - `compact` — para grade/listagem de vários atletas (grade CSS `repeat(auto-fill, minmax(...))`);
    preserva foto, `overall`, nome, posição e identidade gold-on-navy; simplifica moldura/fundo e
    omite bandeira/tira de atributos completa.
- **Sigla de posição**: derivada no cliente de `athletes.primary_position` (texto livre, já
  existente; passa a ser exposto pela leitura `athlete_card`) via um mapa pt-BR em
  `attributeCard.constants.ts` (Goleiro→GOL, Zagueiro→ZAG, Lateral→LAT, Volante→VOL, Meia→MEI,
  Atacante→ATA…), com fallback para as 3 primeiras letras maiúsculas. **Sem** campo de nacionalidade
  — a bandeira do Brasil é fixa para todo atleta.
- **Tipografia**: adiciona **um** tipo de exibição esportivo self-hosted (SIL OFL, ex. família
  condensada/wide), em `public/fonts/*.woff2`, com `@font-face` local e `font-display: swap`,
  exposto como `--font-display` em `src/index.css` (com o mapeamento em `@theme inline`) **e**
  espelhado em `src/config/club.config.ts` (teste de paridade `club.config.test.ts`); os `.woff2`
  entram no precache do `vite-plugin-pwa` (`vite.config.ts`) para funcionar offline. Sem provedor
  externo, sem dep npm.
- **Foto do atleta**: `CardPhoto` tenta, em ordem, um recorte transparente (slot futuro), depois o
  avatar existente `athletes.photo_path` (bucket `athlete-avatars`), depois `card-photo-placeholder.svg`.
  **Nenhuma mudança de schema/storage nesta fase**; recortes por atleta ficam como evolução futura.
- **Assets próprios novos** (SVG autorado à mão; **`scripts/generate-brand-assets.mjs` não é
  tocado** — ele gera rasters de `public/brand/` a partir de arte-fonte, não SVGs autorados;
  orçamento de tamanho verificado por `tests/unit/card-assets.test.ts`):
  - `src/features/gamification/assets/card-frame.svg` — moldura ornamental MBJ (≤ 12 KB).
  - `src/features/gamification/assets/card-backdrop.svg` — camada de raios/glow/partículas do fundo
    (gradientes + `<radialGradient>` + traços; ≤ 20 KB). Sem textura raster se possível; se
    necessária, 1 grão `.webp` ≤ 20 KB.
  - `src/features/gamification/assets/br-flag.svg` — bandeira do Brasil simplificada (domínio
    público; ≤ 3 KB).
  - `src/features/gamification/assets/card-photo-placeholder.svg` — silhueta neutra (≤ 3 KB).
  - **Marca d'água do escudo**: reutiliza `public/brand/mbj-shield.svg` existente com `opacity`/
    `filter` — **sem novo arquivo**.
  - Fonte: `public/fonts/<display>.woff2` (SIL OFL; ≤ ~40 KB por peso, no máximo 2 pesos).

## Complexity Tracking

**Um único desvio constitucional ativo.** (O Módulo Financeiro **não** consta aqui: a Constituição
v1.1.0 o torna compatível pelo limite "Internal Financial Bookkeeping" do Princípio III.)

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Buffer de escrita offline na tela de súmula ao vivo — Princípio V proíbe enfileirar escritas offline** | O registro é feito na beira do campo, onde a conectividade cai com frequência. Sem buffer, um evento (gol, cartão) registrado durante uma queda é perdido, quebrando SC-004 (0 % de divergência) e a confiança na súmula. O buffer é **estritamente confinado**: só a tela de súmula ao vivo, só os eventos ainda não sincronizados da partida ativa, cada evento com UUID gerado no cliente para deduplicação idempotente, e "Confirmar e Finalizar Súmula" fica bloqueado enquanto houver evento pendente. | **Bloquear o registro enquanto offline** (opção B da clarificação Q1): rejeitada pelo responsável — uma queda de sinal de poucos segundos no meio de um lance perderia o registro silenciosamente, e o Registrador não pode parar o jogo para esperar reconexão. **Retry só em memória na sessão** (opção C): rejeitada porque fechar/recarregar a aba pitch-side (bateria, toque acidental) descartaria os eventos não enviados. |

### Remediation / Migration Plan — Princípio V (buffer offline da súmula)

Exigido pela Governança da Constituição ("Deviations MUST be ... accompanied by a remediation or
migration plan").

**Escopo e contenção da exceção (invariantes que a implementação MUST manter):**

- Aplica-se **exclusivamente** à tela de súmula ao vivo (`src/features/live-match/`).
- Persiste **apenas** eventos ainda não sincronizados da **partida ativa**.
- Um único IndexedDB store isolado para esse fluxo (`src/features/live-match/lib/offline-queue.ts`,
  store `pending_events`); **nenhum outro módulo pode reutilizar a fila offline**.
- `finalize_sumula` fica bloqueado enquanto houver itens pendentes (FR-037b).
- Cada evento carrega um `client_event_id` idempotente; o servidor faz
  deduplicação/reconciliação (`insert ... on conflict (client_event_id) do nothing`, FR-037a).
- O restante do app permanece **offline read-only** (cache de próximo jogo / escalação), sem fila
  de escrita.

**Review triggers (reavaliar a exceção quando qualquer um ocorrer):**

1. Qualquer futura alteração da Constituição que toque o Princípio V.
2. Evidência operacional de que a súmula pode ser registrada de forma confiável **sem** persistent
   offline writes (conectividade estável no local dos jogos).
3. Surgimento de uma abordagem técnica (ex.: primitiva de sincronização suportada pelo Supabase,
   ou captura assistida por servidor) que elimine a necessidade do buffer persistente.

**Migration / removal path (quando um review trigger justificar a remoção):**

1. Desabilitar novas gravações offline persistentes na tela de súmula (feature flag / build).
2. Sincronizar todas as filas `pending_events` existentes nos dispositivos assim que possível.
3. Tratar explicitamente itens que não puderem ser sincronizados (relatório ao Registrador +
   entrada de auditoria; nunca descarte silencioso).
4. Remover o IndexedDB store `pending_events` e seu wrapper.
5. Remover o código específico de enqueue / retry / listener de `reconnect`.
6. Preservar intactos todos os eventos já consolidados no servidor (`match_consolidations` /
   `match_goals` / `match_cards` / `match_substitutions` / `match_goalkeeper_assignments`).
7. Manter o fluxo online e o RPC `finalize_sumula` inalterados (a remoção afeta só a camada de
   buffer do cliente).
