# Specification Quality Checklist: Redesign Visual Dark Navy e Refinamento da Navegação (MBJ)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-06
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

**Iteração 1 (2026-09-06)** — Validação executada contra o repositório real antes da redação.

Resultados:

- **Conteúdo**: aprovado. Os valores de paleta e os arquivos de marca são o próprio objeto da feature
  (design system e assets), não detalhes de implementação. A conversão HSL e o mapeamento de tokens
  foram isolados em um "Anexo Informativo" explicitamente marcado como não normativo, para não
  contaminar os requisitos.
- **Plataforma**: corrigida. O discovery declarava React Native/Expo; a validação do repositório
  confirmou que a stack é React + Vite + Tailwind + React Router + PWA, e a Constituição (Princípio
  III) veda aplicações nativas. A seção "Correções de Premissa" registra a divergência e a decisão.
- **Assets**: `logo mbj 2.png`, `logo mbj 1.jpg` e `Sugestão nova interface e tema mbj.png` foram
  confirmados na raiz do repositório. O escudo de origem tem fundo branco opaco, não transparente
  como o discovery afirmava — registrado em A-04, FR-010 e E-05.
- **Contraste**: a paleta proposta foi verificada por cálculo; todos os pares principais passam em
  WCAG AA. Registrado no Anexo Informativo.
- **Preservação do MVP**: FR-027 a FR-031 e a seção "Restrição Central" fixam explicitamente a
  proibição de tocar em rotas, guardas, papéis, contratos, RLS, migrações e regras de negócio.

**Pendência da iteração 1** — 3 marcadores `[NEEDS CLARIFICATION]`, todos referentes ao conjunto de
itens da navegação (escopo), por serem divergências reais entre o discovery e a aplicação existente
que não podiam ser resolvidas por suposição sem violar a diretriz "não crie novas funcionalidades
para preencher a navegação" ou remover acesso a funcionalidades já validadas.

---

**Iteração 2 (2026-09-06)** — Clarificações respondidas pelo responsável e incorporadas à spec.

| # | Pergunta | Decisão | Onde foi aplicada |
|---|---|---|---|
| Q1 | Item "Escalação" sem rota de nível superior | Omitir do menu; escalação segue acessível pelo contexto da partida | FR-014a, tabela de premissas, Clarifications |
| Q2 | Barra de abas no rodapé vs. gaveta lateral no mobile | Substituir a barra de abas pela gaveta lateral | FR-021, FR-021a, A-11, Clarifications |
| Q3 | Cinco destinos omitidos pelo discovery | Manter todos, com as regras de visibilidade por papel vigentes | FR-014 (tabela normativa de 10 itens), FR-014b, A-12, Clarifications |

Alterações desta iteração:

- FR-014 passou a conter a **tabela normativa completa** dos 10 destinos, com rótulo, rota e condição
  de visibilidade por papel, eliminando a ambiguidade sobre o conjunto do menu.
- FR-014a e FR-014b adicionados para fixar, respectivamente, a ausência do item "Escalação" e a
  imutabilidade das regras de visibilidade.
- FR-021a adicionado para tornar explícito que os dois padrões de navegação mobile não coexistem.
- A-12 adicionada registrando `PRESIDENT` (10 itens) como pior caso de dimensionamento para SC-004.
- Seção `## Clarifications` criada com a sessão de 2026-09-06.

**Resultado**: 16/16 itens aprovados. Zero marcadores `[NEEDS CLARIFICATION]` restantes. A
especificação está apta a seguir para `/speckit-plan`.

Pontos de atenção a carregar para a fase de planejamento (não bloqueantes):

- O escudo de origem precisa de remoção de fundo e geração de variantes; o arquivo tem ≈1,6 MB e não
  deve ser servido como está.
- Os assets de marca do diretório público e as entradas de ícone do manifesto não recebem hash
  automático do build — E-01 e FR-012 exigem tratamento explícito de versionamento.
- A substituição da barra de abas pela gaveta afeta asserções de testes existentes que verificam a
  navegação autenticada.

---

**Iteração 3 (2026-09-06)** — Revalidação após `/speckit-clarify`. Cinco perguntas respondidas e
integradas. **16/16 itens permanecem aprovados; nenhuma regressão e nenhum item alterou de estado.**

Verificações executadas nesta iteração:

- Zero marcadores `[NEEDS CLARIFICATION]`; oito registros `- Q: … → A: …` em duas sessões datadas.
- Sem vazamento de implementação nos requisitos: nomes de ferramentas e bibliotecas aparecem apenas
  nas seções "Correções de Premissa" e "Restrição Central", onde documentam a stack real e o que é
  proibido alterar — não nos FR, SC ou critérios de aceite.
- Casos de borda renumerados em ordem (E-01 a E-14) após as inserções.
- Sem contradições remanescentes: SC-001 e SC-003 passaram a apontar para o portão único de
  verificação SC-003a, eliminando a referência vaga a "varredura completa".

Os três pontos de atenção levantados na iteração 2 foram resolvidos por clarificação:

| Ponto de atenção (iteração 2) | Resolução |
|---|---|
| Escudo precisa de tratamento e o arquivo de origem tem ≈1,6 MB | FR-009a a FR-009e: vetor único como origem, ícones derivados, origem não publicada |
| Assets de marca sem hash automático de build | FR-012a a FR-012c: caminhos novos, remoção dos antigos, política de revalidação |
| Substituição da barra de abas afeta testes existentes | A-11 e FR-008a: escopo de alteração de testes delimitado e ampliação de cobertura assumida como entrega |

Lacunas encontradas na varredura e agora cobertas, que não constavam da spec original: ausência de
tokens semânticos de estado, reprovação do token destrutivo vigente em contraste sobre o navy,
inversão do véu de modal no tema escuro, cores utilitárias fixas fora do sistema de tokens, ícone
maskable sujeito a recorte e cobertura de acessibilidade limitada a duas rotas.


---

**Iteração 4 (2026-09-06)** — Elevação da referência visual a norma para a Landing Page, a pedido do
responsável. **16/16 itens permanecem aprovados.**

Motivo: a comparação da referência `Sugestão nova interface e tema mbj.png` com os artefatos mostrou
que 7 elementos de composição não estavam especificados em lugar nenhum, e que A-08 **excluía** a
recriação do hero. Sem essa revisão, a landing entregue seria reconhecivelmente diferente do que foi
pedido.

Alterações:

- A-03 passou a tratar a referência como **normativa para a Landing Page** (composição, proporção,
  hierarquia), mantendo-a como direção visual para as demais telas.
- A-08 reescrita: proibida fotografia de terceiros; o clima do hero é recriado por composição própria,
  admitido asset raster da própria feature se necessário.
- FR-032 a FR-040 criados, cobrindo hero, marca d'água, título bicolor, navegação ativa, cards em dois
  níveis, botões, faixa institucional e proporções.
- SC-011 (sete elementos presentes) e SC-012 (zero textos novos) criados.
- E-15 e E-16 criados: marca d'água competindo com o conteúdo, e integridade do texto no título
  segmentado.
- Novo contrato `contracts/landing-composition.md` com as garantias GL-01 a GL-15 e a lista de
  conferência de fidelidade.
- research D-11 (hero sem fotografia) e D-12 (gradientes fora da verificação enumerável) criados.
- G-07 acrescentada ao contrato de tokens; camada 2 do portão passou a declarar que gradientes ficam
  fora dela; Landing Page acrescentada à camada 4.
- 10 tarefas novas (T026 a T035) e renumeração das demais: **79 → 89 tarefas**.

Restrições preservadas: nenhuma rota nova, nenhuma regra de negócio tocada, nenhum texto funcional
novo. O trio "FUTEBOL · AMIZADE · HISTÓRIA" da referência **não** é adotado — substituiria o slogan
oficial "Raça, amizade e futebol.", e GL-13 registra a proibição explicitamente.


---

**Iteração 5 (2026-09-07)** — Fechamento das pendências apontadas pela quinta análise.
**16/16 itens permanecem aprovados.**

| # | Questão | Resolução |
|---|---|---|
| R1 | Restrição Central proibia mexer na composição da landing | Exceção controlada com os 8 tipos de alteração nomeados; proibições preservadas |
| V1 | Portão aprovaria o hero sem medir contraste | FR-041 (teto 0,030), GL-16 a GL-18, camada 2b, SC-013, T090 |
| G1 | Contraste 3:1 sem comprovação — **e reprovando** | FR-042, SC-014, T091; token `input` corrigido |
| T1 | Conferência da landing duplicada em T035 e T079 | T079 restrita às telas densas; landing só em T035 |
| B1 | Textura fora do contrato de geração | Seção própria + GA-11 |
| S3 | Superfícies Impactadas desatualizadas | Duas linhas revistas |
| F1 | FR-008 proibia a segmentação de FR-035 | Ressalva com exigência de teste de igualdade |
| G2 | MVP anunciado como se cobrisse todos os SCs | Nota explícita na estratégia de implementação |
| A1 | SC-005 sem asserção | Contagem de dois toques incorporada a T059 |
| C2 | Sobreposição T004/T005 | T004 restrita aos tokens preexistentes |
| I2 | Ordenação de FR-010 e A-13 | Reordenados |
| I3 | Redação de E-10 | Corrigida |

**Achado mais grave desta iteração**: o token `input` valia `#233558`, idêntico a `border`, e atingia
apenas **1,4:1** sobre o card — reprovando em WCAG 1.4.11 para limite de controle. O fundo do próprio
campo contra o card dava 1,1:1, então nenhum elemento identificava a borda de um campo de formulário.
G1 não era lacuna de verificação: era falha de acessibilidade já presente na paleta aprovada. `input`
passa a `220 38% 48%` (3,2:1 sobre o card), desacoplado de `border` por G-08.

Totais: FR 63 → 65 · SC 15 → 17 · tarefas 89 → 91 · contratos 5 (inalterado).

---

**Iteração 6 (2026-09-07)** — Lote 6 (T052–T061, User Story 3). Nenhuma mudança nos 16
itens do checklist original; registro de um achado de infraestrutura de teste que
afetava lotes anteriores.

**Achado**: `mockAuthenticatedSession()` nunca estabeleceu sessão real — apenas
interceptava chamadas de rede. A sessão do Supabase só era persistida em
`localStorage` por um `signIn()` real (submissão do formulário). Todo teste que
chamava `mockAuthenticatedSession()` sozinha para uma rota autenticada era
silenciosamente redirecionado para `/` pelo guard, sem erro — e ainda assim "passava",
porque a asserção rodava contra a Landing Page, não contra o destino pretendido.

Isso afetava, desde o lote 4: as 22 rotas autenticadas do laço de `accessibility.spec.ts`
(T041) e as entradas `/alterar-senha` e `/mfa` de `theme-consistency.spec.ts` (T040).
Ambas as suítes reportavam sucesso, mas auditavam a página errada.

**Correção**: `mockAuthenticatedSession()` agora semeia a sessão diretamente no
`localStorage` via `page.addInitScript()`, no mesmo formato que o SDK do Supabase
grava após um login real — dispensando `signIn()` para simplesmente alcançar uma rota
autenticada. Reexecutadas todas as suítes afetadas: **33/33** em `accessibility.spec.ts`
(incluindo as 22 rotas, agora auditadas de fato) e **6/6** em `theme-consistency.spec.ts`,
todas passando contra o conteúdo real — zero violações WCAG, zero cor fora dos tokens.

Consequência colateral corrigida: `signIn()` chamado depois da sessão já semeada
quebraria (`/login` redireciona quem já está autenticado). `navigation-shell.spec.ts`
e `visitAs()` em `auth-mock.ts` foram ajustados para não chamar `signIn()` quando
`mockAuthenticatedSession()` já basta.

**Segundo achado, no mesmo lote**: a documentação de research D-02 afirmava que
`showModal()` entrega "foco contido" nativamente. Verificação empírica (tabulação
repetida com a gaveta aberta, T061/SC-003b) mostrou que a inertização do fundo é
nativa, mas o wraparound de Tab dentro do próprio diálogo não é — o foco escapava da
página após o último elemento focável. Corrigido com um `onKeyDown` de ~15 linhas em
`NavigationDrawer.tsx`; a afirmação em research.md foi corrigida para refletir o
comportamento real, não o presumido.

Resultado: **16/16 itens do checklist seguem aprovados.** Nenhuma alteração
estrutural na spec — os dois achados são de implementação e infraestrutura de teste,
já corrigidos e reverificados.
