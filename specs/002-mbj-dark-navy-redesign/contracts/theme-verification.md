# Contract: Theme Verification Gate

**Feature**: `002-mbj-dark-navy-redesign`

Contrato do portão que comprova SC-001, SC-003, SC-003a e SC-003b. Define o que cada camada verifica,
o que ela não consegue ver, e o critério de aprovação.

## Camada 1 — Varredura estática de cor

**Ferramenta**: Vitest. **Escopo**: arquivos sob `src/`, exceto `src/index.css` e
`src/config/club.config.ts`.

**Exceção declarada**: o contêiner do QR Code em `src/features/auth/pages/MfaPage.tsx` mantém
superfície clara por requisito funcional de leitura por scanner (FR-003g).

| Verificação | Critério de falha |
|---|---|
| Utilitário de cor da paleta padrão do Tailwind | Ocorrência de `bg-`/`text-`/`border-`/`ring-`/`from-`/`to-`/`via-` seguido de família padrão (`slate`, `gray`, `zinc`, `neutral`, `stone`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`) ou de `white` / `black` |
| Cor literal | Ocorrência de `#rrggbb`, `#rgb`, `rgb(`, `rgba(`, `hsl(`, `hsla(` em arquivo de componente |

**Cobre**: a causa raiz mais provável de regressão — alguém escrevendo `bg-white` numa tela nova.
**Não cobre**: cor herdada de folha de estilo, cor aplicada por atributo de estilo dinâmico.

## Camada 2 — Conformidade de paleta em runtime

**Ferramenta**: Playwright. **Escopo**: as 28 rotas do catálogo, no projeto `desktop-chromium`; mais
a largura mobile com a gaveta aberta (SC-003b).

**Procedimento**:

1. Ler os valores resolvidos dos tokens em `:root` e montar a lista de valores permitidos:
   - todo token sólido, convertido para `rgb(...)`;
   - cada token do tema nas opacidades 10% e 40%;
   - o token `overlay` a 60%;
   - `rgba(0, 0, 0, 0)` (transparente).
2. Percorrer os elementos visíveis e coletar `background-color`, `color`, `border-*-color`.
3. Falhar se algum valor coletado estiver fora da lista, reportando o seletor e o valor.

| Cobre | Não cobre |
|---|---|
| Superfície clara herdada que continua legível e por isso não viola contraste | Imagens e SVG embutidos |
| Cor aplicada por qualquer caminho, inclusive estilo dinâmico | Cor visível apenas sob interação não simulada |
| Cor de fundo sólida | **Gradientes**, que são `background-image` e não `background-color` |

**Gradientes**: ficam fora desta camada por construção (research D-12). Seus stops derivam de tokens
por exigência de G-07, e sua conformidade é verificada na camada 4.

**Exceções declaradas**: elementos com opacidade de desabilitado aplicada via `opacity` compõem sobre
o fundo sem alterar a cor computada, e portanto não produzem falso positivo; e a superfície clara do
contêiner do QR Code na tela de verificação em duas etapas é permitida por FR-003g.

## Camada 2b — Luminância do hero e contraste calculado

**Ferramenta**: Playwright, sem decodificação de imagem. **Escopo**: Landing Page.

**Procedimento**:

1. Ler o `background-image` computado do hero e extrair os stops de cor resolvidos.
2. Compor cada stop sobre o azul navy base e calcular a luminância relativa resultante.
3. Falhar se algum stop sob região de texto exceder **0,030** (FR-041).
4. Calcular as razões de contraste dos textos primário, secundário e dourado contra esse pior caso e
   falhar se alguma ficar abaixo de 4,5:1.
5. Calcular as razões dos pares não textuais de FR-042 e falhar se alguma ficar abaixo de 3:1.

| Cobre | Não cobre |
|---|---|
| Contraste do texto do hero contra o **pior caso** do gradiente | Percepção subjetiva do efeito de iluminação |
| Pares não textuais sujeitos a 3:1 | Gradientes fora do hero |

**Por que esta camada existe**: a camada 3 é **estruturalmente incapaz** de avaliar o hero. O axe não
determina cor de fundo em `background-image` e devolve *incomplete*, que não reprova. Sem a camada 2b,
o portão aprovaria o hero sem nunca medir seu contraste.

## Camada 3 — Auditoria de acessibilidade

**Ferramenta**: Playwright + `@axe-core/playwright`, com as tags já em uso
(`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`).

**Escopo**: ampliado de 2 rotas públicas para as 28 rotas do catálogo, mais a largura mobile com a
gaveta aberta.

**Critério**: zero violações. **Resultados *incomplete* não contam como aprovação** — onde ocorrerem
sobre gradiente, a camada 2b é a autoridade.

| Cobre | Não cobre |
|---|---|
| Contraste real texto/fundo sobre cor sólida | Contraste sobre gradiente, coberto pela camada 2b |
| Contraste real texto/fundo | Se a tela "parece" do tema certo |
| Nome acessível, semântica, papéis ARIA | Fidelidade à referência visual |
| Foco visível e semântica | Alvo de toque, que é verificado por asserção própria em `navigation-shell.spec.ts` e `accessibility.spec.ts`, não pelo axe |

## Camada 4 — Conferência visual dirigida

**Manual**, sobre as telas de maior densidade visual, onde a composição não é verificável por
ferramenta:

| Tela | Rota |
|---|---|
| Editor de escalação | `/app/staff/matches/:matchId/lineup` |
| Escalação publicada | `/app/matches/:matchId/lineup` |
| Consolidação de estatísticas | `/app/admin/matches/:matchId/statistics` |
| Painel de presenças | `/app/staff/matches/:matchId/attendance` |

Critério: aderência à paleta e à hierarquia da referência de tema do projeto, conforme A-03 —
avaliação por aderência, não por diferença de pixels.

**A Landing Page não pertence a esta camada.** Sua conferência de fidelidade tem contrato próprio
([landing-composition.md](./landing-composition.md)) e tarefa própria dentro da User Story 1, para que
a fidelidade seja validada junto com a entrega e não ao final do projeto.

## Catálogo de rotas

Fonte única em `tests/e2e/support/route-catalog.ts`. Cada entrada declara caminho, papel mínimo que a
alcança e os dados mínimos para renderizar conteúdo.

**Regra de escopo**: cada rota é auditada **uma vez, com um papel autorizado**. Os três papéis em
conjunto cobrem as 28 rotas (research D-07). Auditar toda rota com todo papel geraria 84 execuções, a
maioria terminando em redirecionamento por guarda.

**Garantia GV-01**: o catálogo tem exatamente 28 entradas — 6 públicas e de fluxo de autenticação
(incluindo a rota de captura `*`) e 22 autenticadas — e cobre toda rota navegável declarada em
`src/app/router/router.tsx`.

## Autenticação nos testes

As rotas autenticadas são exercidas com o padrão de mock já vigente no projeto: interceptação das
chamadas ao Supabase por `page.route()`, JWT forjado com `sub` e `aal`, e resposta fixa para a
consulta de `user_roles`. O helper é extraído para `tests/e2e/support/auth-mock.ts`, parametrizado
por papel, eliminando a duplicação hoje presente em oito arquivos de spec.

**Garantia GV-02**: nenhuma credencial real, chave de serviço ou dado de jogador real entra nos
testes (Constituição, Princípio I).

## Critério de aprovação do portão

Todas as **cinco** camadas precisam passar: 1 (varredura estática), 2 (paleta em runtime),
2b (luminância do hero), 3 (acessibilidade) e 4 (conferência visual das telas densas). Uma camada
verde não compensa outra vermelha — cada uma cobre um modo de falha que as demais não veem, e a
camada 3 é explicitamente insuficiente para o hero.
