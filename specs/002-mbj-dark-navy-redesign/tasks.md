---

description: "Task list for feature implementation"
---

# Tasks: Redesign Visual Dark Navy e Refinamento da Navegação (MBJ)

**Input**: Design documents from `/specs/002-mbj-dark-navy-redesign/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: **Incluídos e obrigatórios.** FR-008a exige ampliar a auditoria de acessibilidade para as
28 rotas, SC-003a define um portão de verificação em quatro camadas, e o Princípio IV da Constituição
exige portões automatizados. Testes não são opcionais nesta feature.

**Organization**: Tarefas agrupadas por user story, permitindo implementação e validação
independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependência pendente)
- **[Story]**: User story a que a tarefa pertence (US1, US2, US3, US4)
- Caminhos de arquivo exatos em cada descrição

## Path Conventions

Projeto único, monolito modular por feature: `src/` e `tests/` na raiz do repositório, assets
estáticos em `public/`, scripts utilitários em `scripts/`.

## Observação decisiva para o esforço

A aplicação já consome tokens semânticos (`bg-background`, `bg-card`, `text-muted-foreground`) em
praticamente toda superfície. **Trocar os valores dos tokens vira o tema da aplicação inteira de uma
vez.** A auditoria do código encontrou apenas 13 ocorrências de cor fixa, em 5 arquivos. O trabalho
arquivo a arquivo é, portanto, pequeno e localizado — o volume real está na reestruturação da
navegação e na ampliação da cobertura de testes.

---

## Phase 1: Setup

**Purpose**: Preparar o ramo e os diretórios previstos no plano

- [X] T001 Criar e publicar o ramo `feature/mbj-ui-redesign-dark-navy` a partir de `main`
- [X] T002 [P] Criar o diretório `src/app/layouts/navigation/` para os subcomponentes da casca de navegação
- [X] T003 [P] Criar o diretório `tests/e2e/support/` para as fixtures compartilhadas de teste

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Definir os tokens e a infraestrutura de teste dos quais todas as user stories dependem

**⚠️ CRÍTICO**: nenhuma user story pode começar antes desta fase terminar. Os tokens são a base de
todo o resto; as fixtures de teste são pré-requisito da validação de qualquer story.

- [X] T004 Substituir pelos valores Dark Navy os 17 tokens que **já existem** em `src/index.css`, conforme as linhas correspondentes da tabela 1.1 de `specs/002-mbj-dark-navy-redesign/data-model.md`; os tokens novos são escopo de T005
- [X] T005 Adicionar em `src/index.css` os tokens novos `elevated`, `overlay`, `success`, `success-foreground`, `warning`, `warning-foreground`, `info`, `info-foreground`, `pitch`, `pitch-foreground` e `pitch-line`, e corrigir `destructive` de `0 72% 51%` para `0 91% 71%` (o valor atual atinge apenas 4,0:1 sobre o novo fundo); desacoplar também `input` de `border`, atribuindo a `input` o valor `220 38% 48%` — no valor anterior, idêntico ao divisor, o contorno de campo atingia apenas 1,4:1 sobre o card e reprovava em WCAG 1.4.11 (FR-042, G-08)
- [X] T006 Mapear todos os tokens novos para utilitários Tailwind no bloco `@theme inline` de `src/index.css`
- [X] T007 Trocar `color-scheme: light` por `color-scheme: dark` em `src/index.css` para alinhar controles nativos e barras de rolagem ao tema
- [X] T008 Estender o array `SEMANTIC_THEME_TOKENS` em `src/config/club.config.ts` com os 11 nomes novos, mantendo a ordem alfabética por família
- [X] T009 Atualizar `clubConfig.theme` em `src/config/club.config.ts` com os mesmos valores declarados em `src/index.css`
- [X] T010 Adicionar em `src/config/club.config.test.ts` o teste de paridade (regra V-02) que lê `src/index.css` e falha se algum valor divergir de `clubConfig.theme`
- [X] T011 [P] Criar `tests/e2e/support/auth-mock.ts` extraindo o padrão hoje duplicado em oito specs (`jwt()`, `user()`, `json()` e interceptação de `user_roles` por `page.route()`), parametrizado por papel `ATHLETE`, `COACH` e `PRESIDENT`
- [X] T012 [P] Criar `tests/e2e/support/route-catalog.ts` com as 28 rotas da seção "Superfícies Impactadas" de `spec.md`, cada uma declarando caminho, papel mínimo que a alcança e dados mínimos para renderizar conteúdo
- [X] T013 [P] Criar `tests/e2e/support/palette.ts` com o helper que lê os valores resolvidos dos tokens em `:root` e monta a lista de cores permitidas (sólidos, derivações a 12%, 40% e 60%, e `rgba(0, 0, 0, 0)`), conforme `contracts/theme-verification.md`

**Checkpoint**: tema virado para Dark Navy em toda superfície que já usa tokens; fixtures de teste
prontas. As user stories podem começar.

---

## Phase 3: User Story 1 - Identidade Dark Navy consistente (Priority: P1) 🎯 MVP

**Goal**: tema Dark Navy aplicado a 100% das superfícies e escudo oficial em todos os pontos de
marca, sem resíduo do escudo antigo nem superfície clara herdada.

**Independent Test**: percorrer as 28 rotas com os três papéis e confirmar fundo navy, escudo oficial
e ausência de superfície clara; instalar a PWA e conferir ícone e favicon; comparar a Landing Page
lado a lado com a referência normativa e confirmar os sete elementos de composição.

### Assets de marca

- [X] T014 [US1] Redesenhar o escudo oficial como SVG otimizado em `public/brand/mbj-shield.svg`, com fundo transparente e `viewBox` quadrado, usando `logo mbj 2.png` como referência: contorno do escudo, campo azul, faixa dourada, letras "MBJ" e conjunto de estrelas por repetição de um único símbolo — orçamento de 20 KB
- [X] T015 [US1] Substituir o conteúdo de `public/favicon.svg` pelo escudo de `public/brand/mbj-shield.svg`, verificando legibilidade do contorno a 32px
- [X] T016 [US1] Criar `scripts/generate-brand-assets.mjs` que abre o SVG no Chromium do Playwright e captura `public/brand/mbj-icon-192.png`, `public/brand/mbj-icon-512.png` (ambos com `omitBackground`) e `public/brand/mbj-icon-maskable-512.png` (escudo a ~60% da largura, centralizado sobre `#0A1325` opaco)
- [X] T017 [US1] Adicionar o script `brand:assets` em `package.json` apontando para `scripts/generate-brand-assets.mjs`, seguindo o padrão já usado por `db:types`
- [X] T018 [US1] Executar a geração e versionar os artefatos em `public/brand/`: as duas variantes do brasão em tela extraídas de `logo mbj 2.png` e os três PNGs de ícone derivados do vetor, confirmando os orçamentos
- [X] T019 [US1] Atualizar `clubConfig.assets` em `src/config/club.config.ts` com `crest`, `crestLarge`, `shield`, favicon e as três entradas de ícone, apontando os consumidores de interface para `crest` (FR-009f)
- [X] T020 [US1] Remover `public/brand/logo.svg` e `public/pwa-192x192.png`, garantindo que nenhum caminho de marca anterior continue publicado (GA-07)
- [X] T021 [US1] Atualizar em `index.html` a `theme-color` para `#0A1325` e o `apple-touch-icon` para `/brand/mbj-icon-192.png`
- [X] T022 [US1] Atualizar o manifesto em `vite.config.ts`: três entradas de ícone conforme `contracts/brand-assets.md`, `theme_color` e `background_color` em `#0A1325`, e `includeAssets` com os novos caminhos
- [X] T023 [US1] Adicionar em `public/_headers` a regra de revalidação obrigatória para `/brand/*` e `/favicon.svg`, garantindo que não herdem a política imutável de `/assets/*`

### Superfícies públicas e de fluxo de autenticação

- [X] T024 [P] [US1] Ajustar `PublicLayout` e `AuthFlowLayout` em `src/app/router/router.tsx` para o tema escuro — apenas classes; nenhuma alteração de caminho, guarda ou elemento de rota
- [X] T025 [P] [US1] Aplicar o tema à Landing Page em `src/features/auth/pages/WelcomePage.tsx`: hero com gradiente sobre a paleta (A-08), escudo oficial, "Entrar no clube" preenchido em dourado e "Ativar convite" contornado, conforme a referência `Sugestão nova interface e tema mbj.png`. Corrigir o card "Acesso somente por convite" (linha 48), hoje `bg-primary` com ícone `text-secondary`: no tema Dark Navy os dois viram dourado e o ícone desaparece — usar superfície navy com borda dourada, como na referência. Substituir `text-primary-foreground/80` (linha 51) pelo valor sólido, conforme FR-003h
### Fidelidade da Landing Page à referência normativa

- [X] T026 [US1] Compor o fundo do hero em `src/features/auth/pages/WelcomePage.tsx` com gradiente base navy, gradiente radial dourado de baixa intensidade simulando refletores na região superior e vinheta nas bordas, derivando todos os stops de tokens do tema e mantendo todo stop sob região de texto abaixo da luminância de 0,030 exigida por FR-041 (GL-01 a GL-03, GL-16)
- [X] T027 [US1] Implementar a textura sutil do hero preferindo CSS puro; apenas se a fidelidade não for atingida, gerar o asset próprio `public/brand/hero-texture.png`, otimizado e versionado, dentro do orçamento de 30 KB — nunca imagem de terceiros (FR-033)
- [X] T028 [US1] Posicionar o escudo em marca d'água no lado direito do hero em `src/features/auth/pages/WelcomePage.tsx`: escala grande, parcialmente sangrado na borda, opacidade reduzida no elemento e `aria-hidden`, sem reduzir o contraste de nenhum texto abaixo de 4,5:1 (FR-034, E-15)
- [X] T029 [US1] Segmentar `institutional.welcomeTitle` em `src/config/club.config.ts` em duas partes cuja concatenação reproduza exatamente o texto atual, renderizar o título bicolor em `WelcomePage.tsx` — primeira parte em `foreground`, nome do clube em `primary` — mantendo um único `<h1>`, e cobrir a igualdade por teste em `src/config/club.config.test.ts` (FR-035, E-16, GL-05)
- [X] T030 [US1] Reproduzir os dois níveis de profundidade dos cards em `src/features/auth/pages/WelcomePage.tsx`: o primeiro com gradiente navy mais claro, o segundo mais profundo, ambos com borda e ícone dourados, preservando textos, ordem e função (FR-037, GL-09, GL-10)
- [X] T031 [US1] Ajustar raio, borda e proporção dos botões da landing em `src/features/auth/pages/WelcomePage.tsx` ao mockup — principal preenchido em dourado com a seta existente, secundário contornado — preservando rótulos, destinos e comportamento (FR-038)
- [X] T032 [US1] Acrescentar a faixa institucional ao rodapé da landing em `src/features/auth/pages/WelcomePage.tsx` usando exclusivamente `clubConfig.identity.fullName` e `clubConfig.identity.slogan`, com régua dourada e espaçamento de letras; nenhum texto novo e sem substituir o slogan oficial (FR-039, GL-13, SC-012)
- [X] T033 [P] [US1] Aplicar estado ativo em dourado com indicador visual à navegação pública em `src/app/router/router.tsx`, convertendo os links para `NavLink` com `aria-current="page"` sobre as rotas já existentes; nenhuma rota nova (FR-036, GL-07, GL-08)
- [X] T034 [US1] Ajustar proporções, espaçamentos e hierarquia da landing — dimensão do escudo, escala tipográfica, largura da coluna direita e relação entre hero, título, chamadas para ação e cards — para corresponder à referência em 1920x1080 e 1366x768, e degradar de forma coerente abaixo de 768px sem rolagem horizontal (FR-040, GL-14, GL-15)
- [X] T035 [US1] Conferir a fidelidade da landing contra `Sugestão nova interface e tema mbj.png` usando a lista de sete itens de `contracts/landing-composition.md`, registrando cada item como presente, e medir o pior caso de luminância do hero confirmando as razões de GL-16; um item ausente ou uma razão abaixo de 4,5:1 reprova (SC-011, SC-013, FR-032)
- [X] T036 [P] [US1] Revisar contraste e superfícies em `src/features/auth/pages/LoginPage.tsx` e `src/features/auth/pages/AcceptInvitationPage.tsx`, normalizando `bg-secondary/20` (AcceptInvitationPage:99) para a opacidade de superfície de 10% definida em FR-003b
- [X] T037 [P] [US1] Revisar contraste e superfícies em `src/features/auth/pages/ChangePasswordPage.tsx`
- [X] T038 [P] [US1] Revisar `src/features/auth/pages/MfaPage.tsx` mantendo deliberadamente o fundo claro do contêiner do QR Code, exceção declarada em FR-003g — é requisito funcional de leitura por scanner, não resíduo de tema; documentar a exceção em comentário
- [X] T039 [US1] Ajustar a classe de componente `.form-input` em `src/index.css` para o tema escuro, preservando altura mínima e contorno de campo

### Verificação da story

- [X] T040 [US1] Criar `tests/e2e/theme-consistency.spec.ts` com o helper de conformidade de paleta, cobrindo nesta fase as rotas públicas e de fluxo de autenticação (`/`, `/login`, `/convite`, `/alterar-senha`, `/mfa` e a rota de captura), falhando se algum elemento visível usar cor fora da lista permitida e declarando como exceção o contêiner do QR Code. A ampliação para as 28 rotas ocorre em T089, depois que US4 sanear as superfícies de conteúdo
- [X] T041 [US1] Ampliar `tests/e2e/accessibility.spec.ts` das 2 rotas públicas atuais para as 28 rotas do catálogo, usando as fixtures de `tests/e2e/support/`, mantendo as tags WCAG já em uso e exigindo zero violações
- [X] T042 [US1] Atualizar em `tests/e2e/app-shell.spec.ts` a asserção de texto alternativo do escudo, se o rótulo derivado de `clubConfig.identity` tiver mudado

**Checkpoint**: tema e marca completos e verificados. Este é o MVP entregável.

---

## Phase 4: User Story 2 - Barra lateral reorganizada no desktop (Priority: P1)

**Goal**: identidade fixa no topo, links imediatamente abaixo sem lacunas, perfil e "Sair" fixos no
rodapé com distinção visual.

**Independent Test**: autenticar como Presidente em 1920x1080 e 1366x768 e confirmar a ordem topo →
links → rodapé, todos os 10 itens visíveis sem rolagem, e o "Sair" no rodapé.

- [X] T043 [P] [US2] Criar `src/app/layouts/navigation/SidebarBrand.tsx` com escudo, nome do clube e subtítulo "Área do clube"
- [X] T044 [P] [US2] Criar `src/app/layouts/navigation/NavigationList.tsx` com o conjunto normativo de 10 itens da seção 3.2 de `data-model.md`, incluindo ícones de `lucide-react`, `aria-current="page"` no item ativo e os estados da seção 3.3
- [X] T045 [P] [US2] Criar `src/app/layouts/navigation/SidebarFooter.tsx` com o nome do usuário vindo de `profile` do `AuthProvider` e o botão "Sair" com contorno próprio, distinto dos links (FR-018)
- [X] T046 [US2] Reestruturar `src/app/layouts/AuthenticatedLayout.tsx` para a coluna contínua de três regiões — topo fixo, corpo com `overflow-y: auto` e rodapé fixo — substituindo o grid atual que separa marca e links em regiões distintas
- [X] T047 [US2] Remover de `src/app/layouts/AuthenticatedLayout.tsx` o botão "Sair" do topo, que hoje fica colado à identidade do clube
- [X] T048 [US2] Garantir em `src/app/layouts/AuthenticatedLayout.tsx` que nenhuma faixa de cabeçalho seja renderizada em larguras ≥ 768px (FR-015a), preservando o link de pular para o conteúdo como primeiro na ordem de tabulação
- [X] T049 [US2] Preservar em `src/app/layouts/AuthenticatedLayout.tsx` o `<fieldset>` de bloqueio de escrita offline, o `id="conteudo-principal"` e a posição de `OfflineIndicator` e `PendingActionsBanner` (contratos C-02 e C-03)
- [X] T050 [US2] Atualizar `src/app/layouts/AuthenticatedLayout.test.tsx` para a nova estrutura de três regiões, cobrindo a presença dos 10 itens por papel e a posição do botão "Sair"
- [X] T051 [US2] Criar `tests/e2e/navigation-shell.spec.ts` (projeto `desktop-chromium`) verificando ordem das regiões, `aria-current`, ausência de faixa superior, visibilidade dos 10 itens do Presidente sem rolagem em 1920x1080 e 1366x768, e área mínima de 44x44 px em cada item da barra lateral e no botão "Sair" (FR-025, E-04)

**Checkpoint**: barra lateral desktop reorganizada e verificada, independente da gaveta mobile.

---

## Phase 5: User Story 3 - Gaveta de navegação mobile (Priority: P2)

**Goal**: abaixo de 768px, faixa superior com botão de menu e gaveta sobreposta que replica a
hierarquia da barra lateral e fecha ao escolher um destino.

**Independent Test**: em 360x640, abrir o menu, escolher "Partidas" e confirmar navegação com
fechamento automático; validar Esc, véu e retorno de foco.

- [X] T052 [P] [US3] Criar `src/app/layouts/navigation/MobileTopBar.tsx` com botão de menu, escudo e nome do clube, exibida apenas abaixo de 768px, com `aria-expanded` refletindo o estado da gaveta
- [X] T053 [US3] Criar `src/app/layouts/navigation/NavigationDrawer.tsx` usando `<dialog>` nativo com `showModal()`, reaproveitando `SidebarBrand`, `NavigationList` e `SidebarFooter` para replicar a hierarquia vertical (FR-022)
- [X] T054 [US3] Estilizar em `NavigationDrawer.tsx` o painel ancorado à esquerda com `100dvh` e o véu via `::backdrop` usando o token `overlay` a 60% (FR-003e), com o corpo central rolando internamente e topo e rodapé fixos (E-02)
- [X] T055 [US3] Implementar em `NavigationDrawer.tsx` o fechamento por seleção de destino (FR-023), por evento `cancel` do Esc, e por clique cujo alvo é o próprio elemento de diálogo (o véu não fecha por padrão)
- [X] T056 [US3] Implementar em `src/app/layouts/AuthenticatedLayout.tsx` o estado `isDrawerOpen` como estado local de UI — não em Zustand nem em TanStack Query, conforme a Constituição — e a exclusividade mútua entre gaveta e barra lateral
- [X] T057 [US3] Fechar a gaveta em `src/app/layouts/AuthenticatedLayout.tsx` quando a largura atingir 768px, liberando a rolagem do corpo e evitando o estado inválido de E-08
- [X] T058 [US3] Remover de `src/app/layouts/AuthenticatedLayout.tsx` a barra de abas fixa no rodapé com rolagem horizontal, substituída pela gaveta (FR-021a)
- [X] T059 [US3] Estender `tests/e2e/navigation-shell.spec.ts` (projeto `mobile-chromium`) cobrindo abertura, fechamento por seleção, Esc, véu, retorno de foco ao botão de menu, inacessibilidade por teclado quando fechada, área mínima de 44x44 px no botão de menu e em cada item da gaveta (FR-025), e que qualquer destino seja alcançável em no máximo dois toques — abrir o menu e escolher o destino (SC-005)
- [X] T060 [US3] Ajustar em `tests/e2e/auth-invitation.spec.ts` e `tests/e2e/offline-privacy.spec.ts` os seletores que dependem da barra de abas do rodapé removida
- [X] T061 [US3] Estender `tests/e2e/accessibility.spec.ts` com a auditoria em largura mobile e gaveta aberta, cobrindo foco contido e véu (SC-003b)

**Checkpoint**: navegação completa em desktop e mobile.

---

## Phase 6: User Story 4 - Superfícies de conteúdo e estados no tema escuro (Priority: P2)

**Goal**: cards com superfície tom sobre tom, realce dourado em hover/ativo/foco, avatar de fallback
legível, e todos os estados de feedback com tokens semânticos.

**Independent Test**: percorrer elenco, partidas e mural conferindo cards e estados; simular offline
e erro de validação; abrir um diálogo modal e confirmar véu escuro.

### Estados compartilhados

- [X] T062 [US4] Substituir o véu `bg-foreground/50` pelo token `overlay` a 60% nos **dois** lugares onde ele aparece: `src/shared/components/feedback.tsx:85` (`ConfirmationDialog`) e `src/features/statistics/components/ReopenMatchDialog.tsx:109` — no tema escuro `foreground` é branco e produziria véu branco sobre a interface (E-09)
- [X] T063 [US4] Dar representação visual ao tom `success` em `ToastRegion` de `src/shared/components/feedback.tsx`, que hoje renderiza igual a texto comum, e mapear `info` ao token correspondente (E-11)
- [X] T064 [US4] Revisar `LoadingState`, `EmptyState` e `ErrorState` em `src/shared/components/feedback.tsx` para superfícies e bordas do tema escuro
- [X] T065 [P] [US4] Substituir em `src/features/offline/components/OfflineIndicator.tsx` o trio fixo `bg-amber-50`, `border-amber-300` e `text-amber-950` pela superfície, borda e texto do token `warning`
- [X] T066 [P] [US4] Substituir em `src/features/attendance/components/RefusalReasonModal.tsx` o véu `bg-black/55` pelo token `overlay` a 60%
- [X] T067 [P] [US4] Revisar `src/features/notifications/components/PendingActionsBanner.tsx`, `src/features/notifications/components/PushPermissionCard.tsx` e `src/app/components/PwaUpdatePrompt.tsx` para os tokens de estado
- [X] T068 [P] [US4] Definir o padrão de elemento desabilitado (FR-007, E-03) em `src/shared/components/OnlineActionGuard.tsx` e no aviso de escrita bloqueada, mantendo-os perceptíveis contra o fundo

### Superfícies de conteúdo

- [X] T069 [P] [US4] Aplicar superfície, borda e realce de hover/ativo/foco aos cards de `src/features/roster/pages/RosterPage.tsx` e `src/features/roster/pages/AthleteProfilePage.tsx`
- [X] T070 [P] [US4] Corrigir em `src/features/roster/components/AthleteAvatar.tsx` a colisão entre `bg-primary` e `ring-secondary`, que no tema Dark Navy tornam fundo e anel ambos dourados e fazem o anel desaparecer: trocar o fundo para superfície navy (`card` ou `elevated`) e manter o anel dourado, espelhando a composição do escudo — campo azul com contorno dourado — e mantendo as iniciais legíveis
- [X] T071 [P] [US4] Aplicar o tema aos cards e formulários de `src/features/matches/pages/MatchesPage.tsx`, `src/features/matches/pages/MatchDetailPage.tsx` e `src/features/matches/components/MatchForm.tsx`
- [X] T072 [P] [US4] Aplicar o tema a `src/features/attendance/components/CallUpManager.tsx`, `src/features/attendance/components/PresenceResponsePanel.tsx` e `src/features/attendance/pages/AttendanceDashboardPage.tsx`
- [X] T073 [P] [US4] Substituir `bg-emerald-700` pelo token `pitch` e converter as marcações do campo em `src/features/lineups/components/LineupEditor.tsx` e `src/features/lineups/components/PublishedLineup.tsx`: `border-white` sólido passa a `pitch-foreground`; `border-white/70` e `border-white/80` passam ao token sólido `pitch-line`, preservando a hierarquia visual sem usar opacidades fora do conjunto fechado de FR-003b
- [X] T074 [P] [US4] Aplicar o tema a `src/features/lineups/components/FormationSelector.tsx`, `src/features/lineups/pages/LineupEditorPage.tsx` e `src/features/lineups/pages/PublishedLineupPage.tsx`, confirmando que `bg-destructive/10` e `bg-primary/10` (FormationSelector:59 e :66) já estão conformes ao conjunto de opacidades de FR-003b
- [X] T075 [P] [US4] Aplicar o tema às tabelas e destaques de `src/features/statistics/pages/SeasonRankingsPage.tsx`, `src/features/statistics/pages/StatisticsAdminPage.tsx`, `src/features/statistics/components/ConsolidationForm.tsx` e `src/features/statistics/components/ReopenMatchDialog.tsx`, normalizando `border-destructive/30` (ReopenMatchDialog:80) para 40%
- [X] T076 [P] [US4] Aplicar o tema a `src/features/notices/pages/NoticesPage.tsx` e `src/features/mvp-voting/pages/MvpVotingPage.tsx`
- [X] T077 [P] [US4] Aplicar o tema a `src/features/auth/components/RoleManager.tsx`, `src/features/auth/components/InvitationManager.tsx`, `src/features/roster/components/AthleteForm.tsx` e `src/features/roster/pages/RosterManagementPage.tsx`

### Verificação da story

- [X] T078 [US4] Criar em `tests/unit/` a varredura estática que percorre `src/` e falha ao encontrar utilitário de cor da paleta padrão do Tailwind ou cor literal, excetuando `src/index.css`, `src/config/club.config.ts` e o contêiner do QR Code em `MfaPage.tsx`, conforme a camada 1 de `contracts/theme-verification.md`

**Checkpoint**: todas as quatro user stories completas e independentes.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T079 Executar a conferência visual dirigida (camada 4 de `contracts/theme-verification.md`) **apenas** no editor de escalação, na escalação publicada, na consolidação de estatísticas e no painel de presenças — a Landing Page tem conferência própria em T035 e não se repete aqui
- [ ] T080 Verificar o orçamento de peso da marca: SVG ≤ 20 KB, cada PNG de ícone ≤ 40 KB, textura condicional do hero ≤ 30 KB, total ≤ 180 KB
- [ ] T081 Reexecutar `npm run brand:icons` e confirmar que `git diff` fica vazio, provando o determinismo da geração (GA-01)
- [ ] T082 Instalar a PWA e conferir o ícone sob máscara circular, confirmando que o contorno do escudo não é cortado (GA-03), e que `/brand/logo.svg` e `/pwa-192x192.png` retornam 404 (GA-07)
- [ ] T083 [P] Confirmar por `git diff` que `supabase/`, todos os arquivos `*.service.ts` e `src/app/router/guards.tsx` têm **zero linhas alteradas** — qualquer diferença viola FR-027 e FR-028
- [ ] T084 [P] Atualizar `TECH_STACK.md` na seção de identidade visual com a paleta Dark Navy e os novos caminhos de marca
- [ ] T085 Executar o portão completo: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` e `npm run test:e2e`
- [ ] T086 Executar os seis cenários de `specs/002-mbj-dark-navy-redesign/quickstart.md` e registrar o resultado
- [ ] T087 Abrir o Pull Request com autorrevisão estruturada e validar o preview do Cloudflare, conforme exigido pelo Princípio IV da Constituição
- [ ] T088 Estender em `tests/e2e/accessibility.spec.ts` o laço de alvos de toque — hoje aplicado apenas a `/` — às rotas autenticadas do catálogo, fechando o item "touch targets" nomeado explicitamente no Princípio IV da Constituição (SC-009)
- [ ] T089 Ampliar `tests/e2e/theme-consistency.spec.ts` para as 28 rotas do catálogo, fechando a camada 2 do portão (SC-003a) agora que todas as superfícies de conteúdo foram saneadas em US4
- [ ] T090 Implementar a camada 2b em `tests/e2e/theme-consistency.spec.ts`: ler o `background-image` computado do hero, compor cada stop sobre o navy base e falhar se algum sob região de texto exceder luminância 0,030, depois calcular as razões dos textos primário, secundário e dourado contra esse pior caso e falhar abaixo de 4,5:1 — sem depender do axe, que devolve *incomplete* sobre gradiente (FR-041, SC-013, GL-16, GL-18)
- [ ] T091 Acrescentar ao mesmo arquivo a verificação dos pares não textuais de FR-042 — contorno de campo, anel de foco e marcações do campo — falhando abaixo de 3:1, e registrar as razões calculadas (SC-014, GL-17)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependências
- **Foundational (Fase 2)**: depende da Fase 1 — **bloqueia todas as user stories**
- **US1 (Fase 3)**: depende da Fase 2
- **US2 (Fase 4)**: depende da Fase 2
- **US3 (Fase 5)**: depende da Fase 2 e da **Fase 4** — a gaveta reaproveita os subcomponentes criados em T043 a T045
- **US4 (Fase 6)**: depende da Fase 2
- **Polish (Fase 7)**: depende de todas as stories desejadas

### User Story Dependencies

- **US1 (P1)**: independente. É o MVP.
- **US2 (P1)**: independente de US1 — os tokens vêm da Fase 2, não da US1.
- **US3 (P2)**: **única dependência entre stories** — precisa dos subcomponentes de US2 (T043-T045). Reimplementá-los para desacoplar duplicaria a hierarquia e violaria FR-022, que exige gaveta e barra lateral idênticas.
- **US4 (P2)**: independente das demais.

### Within Each User Story

- Assets antes das referências que os consomem (T014-T018 antes de T019-T023)
- Subcomponentes antes do layout que os compõe (T043-T045 antes de T046)
- Implementação antes dos testes que a verificam
- T078 por último em US4: a varredura estática só fica verde depois que T065, T066 e T073 removem as cores fixas
- T040 cobre apenas as rotas de US1; a conformidade de paleta nas 28 rotas só é alcançável depois de US4, e por isso vive em T089

---

## Parallel Opportunities

**Fase 2 — fixtures de teste** (T011, T012, T013): arquivos novos e distintos, sem dependência entre si.

**Fase 3 — superfícies públicas** (T024, T025, T036 a T038): cinco arquivos diferentes.

**Fase 3 — fidelidade da landing** (T026 a T035): sequencial, todas no mesmo arquivo, exceto T033.

```bash
Task: "Ajustar layouts públicos em src/app/router/router.tsx"
Task: "Aplicar tema à Landing Page em src/features/auth/pages/WelcomePage.tsx"
Task: "Revisar LoginPage e AcceptInvitationPage"
Task: "Revisar ChangePasswordPage"
Task: "Revisar MfaPage preservando o fundo do QR Code"
```

**Fase 4 — subcomponentes da barra lateral** (T043, T044, T045): três arquivos novos.

**Fase 6 — maior janela de paralelismo do projeto** (T065 a T077): treze tarefas em arquivos
distintos.

```bash
Task: "Substituir o âmbar fixo em OfflineIndicator.tsx pelo token warning"
Task: "Substituir o véu em RefusalReasonModal.tsx pelo token overlay"
Task: "Aplicar tema aos cards de elenco"
Task: "Ajustar AthleteAvatar para o fallback por iniciais"
Task: "Aplicar tema às telas de partidas"
Task: "Aplicar tema às telas de presença"
Task: "Substituir bg-emerald-700 pelo token pitch nas telas de escalação"
Task: "Aplicar tema às telas de estatísticas"
Task: "Aplicar tema a mural e votação"
Task: "Aplicar tema às telas administrativas"
```

**Entre stories**: com a Fase 2 concluída, US1, US2 e US4 podem correr em paralelo por pessoas
diferentes. US3 espera US2.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Fase 1: Setup
2. Fase 2: Foundational — **crítica; vira o tema da aplicação inteira**
3. Fase 3: US1
4. **PARAR e VALIDAR**: cenários 1 e 5 do quickstart
5. Entregável: aplicação inteira em Dark Navy com a marca oficial correta e a Landing Page fiel à
   referência, com a navegação ainda na estrutura antiga

**O MVP entrega a User Story 1, não o conjunto completo de critérios de sucesso.** SC-003b depende da
gaveta e só é satisfeito na Fase 5; SC-004, SC-005, SC-009 e SC-010 dependem das Fases 4 e 5.

### Incremental Delivery

1. Fase 2 → tema virado, base pronta
2. + US1 → tema e marca completos e verificados → **MVP demonstrável**
3. + US2 → ergonomia desktop corrigida → demonstrável
4. + US3 → navegação mobile modernizada → demonstrável
5. + US4 → superfícies e estados refinados → demonstrável

Cada incremento agrega valor sem quebrar o anterior.

### Parallel Team Strategy

1. Equipe conclui Fases 1 e 2 em conjunto
2. Depois disso:
   - Pessoa A: US1 (marca e superfícies públicas)
   - Pessoa B: US2 e, em seguida, US3 (casca de navegação)
   - Pessoa C: US4 (superfícies de conteúdo e estados)
3. Convergem na Fase 7

---

## Notes

- **Nenhuma dependência nova** entra no projeto. A gaveta usa `<dialog>` nativo; os ícones são
  gerados com o Playwright já instalado.
- A regra que atravessa toda a feature: **nenhuma cor fora dos tokens**. As únicas exceções
  declaradas são o contêiner do QR Code em `MfaPage.tsx` e as marcações do campo nas telas de
  escalação, ambas revisadas em tarefas próprias.
- Rotas, guardas, papéis, serviços, políticas RLS e migrações são intocáveis. T083 existe para provar
  isso por diff.
- Commit por tarefa ou por grupo lógico; parar em qualquer checkpoint para validar a story de forma
  isolada.
