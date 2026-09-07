# Phase 0 — Research: Redesign Visual Dark Navy e Refinamento da Navegação

**Feature**: `002-mbj-dark-navy-redesign` | **Date**: 2026-09-06

Todos os pontos marcados como NEEDS CLARIFICATION no Technical Context foram resolvidos. Nenhum
permanece aberto. As decisões abaixo foram tomadas contra o código real do repositório, não contra
suposições.

---

## D-01 — Onde os tokens do tema vivem e como evitar duas fontes de verdade

**Decision**: `src/index.css` continua sendo a fonte de verdade em runtime, com as variáveis CSS em
componentes HSL sob `:root` e expostas ao Tailwind por `@theme inline`. `clubConfig.theme` em
`src/config/club.config.ts` permanece como declaração White-Label do deploy e passa a ser verificado
por um teste de paridade que falha se os dois divergirem.

**Rationale**: hoje os dois arquivos declaram os mesmos 17 tokens com os mesmos valores, mas nada
garante isso — `clubConfig.theme` **não é consumido em runtime**; o único teste existente
(`src/config/club.config.test.ts:12`) confere apenas que as *chaves* batem com `SEMANTIC_THEME_TOKENS`,
nunca os valores. É uma duplicação silenciosa esperando divergir, e FR-002 exige origem única.
Injetar as variáveis a partir do config em runtime resolveria de vez, mas custaria um efeito de
inicialização e um flash de tema não estilizado antes da hidratação — complexidade que o Princípio III
rejeita para o ganho oferecido. Um teste de guarda entrega a mesma garantia com custo próximo de zero.

**Alternatives considered**:
- *Injetar as CSS vars a partir de `clubConfig.theme` no boot*: fonte única de verdade real, mas
  introduz flash de conteúdo sem estilo e acopla o tema ao ciclo de vida do React.
- *Remover `clubConfig.theme`*: quebraria a preparação White-Label exigida pelo `TECH_STACK.md`
  (linhas 154-156) e pelo Princípio III.
- *Gerar o CSS a partir do config em build*: exigiria um plugin de build — dependência e complexidade
  novas sem necessidade demonstrada.

**Consequência**: `SEMANTIC_THEME_TOKENS` cresce dos 17 papéis atuais para incluir os quatro estados
semânticos, suas superfícies e bordas derivadas, e o véu de modal. O contrato completo está em
[contracts/design-tokens.md](./contracts/design-tokens.md).

---

## D-02 — Como construir a gaveta de navegação sem dependência nova

**Decision**: usar o elemento nativo `<dialog>` aberto com `showModal()`, estilizado como painel
ancorado à esquerda ocupando `100dvh`, com o véu aplicado via `::backdrop`.

**Rationale**: FR-024 exige foco contido, fechamento por Esc e retorno de foco ao botão de menu.
`showModal()` entrega os três nativamente, além de tornar inerte o conteúdo de fundo e de fornecer o
véu por `::backdrop` — o que também satisfaz FR-003e sem um elemento de overlay próprio. O projeto
tem `components.json` configurado para shadcn/ui, mas **nenhum componente instalado** e nenhum pacote
Radix nas dependências; adicionar um `Sheet` traria `@radix-ui/react-dialog` para resolver um problema
que a plataforma já resolve. O Princípio III exige comparação com a alternativa mais simples antes de
adotar biblioteca — e aqui a alternativa mais simples é suficiente.

**Alternatives considered**:
- *`Sheet` do shadcn/ui sobre Radix Dialog*: acessibilidade pronta e bem testada, mas adiciona
  dependência de runtime para um único componente.
- *Overlay manual com `div` e armadilha de foco escrita à mão*: sem dependência, porém reimplementa
  mal o que o navegador já faz — foco contido e inertização são exatamente onde implementações
  caseiras falham.

**Detalhes de implementação relevantes**: o evento `cancel` do `<dialog>` cobre o Esc; o `close` é o
ponto único para restaurar estado; o clique no véu não fecha por padrão e precisa ser tratado
comparando o alvo do clique com o próprio `<dialog>`. Acima de 768px a gaveta nunca é montada como
modal — a barra lateral estática assume, o que evita o estado inválido de E-08.

---

## D-03 — Como produzir o escudo vetorial a partir do PNG de origem

**Decision** *(revista após inspeção visual do resultado — ver nota ao final)*: produzir **duas**
representações. Para a interface, extrair o brasão de `logo mbj 2.png` removendo o fundo branco por
preenchimento a partir das bordas, recortar à silhueta e publicar variantes otimizadas com
transparência. Para favicon e ícones da PWA, manter o redesenho vetorial simplificado.

**Rationale**: o original tem 1,6 MB, fundo branco opaco e dezenas de estrelas pequenas com sombra e
gradiente. Vetorização automática desse tipo de arte produz milhares de nós e um SVG maior que o PNG,
sem ganho de nitidez. Um redesenho controlado mantém a identidade — contorno do escudo, campo azul,
faixa dourada, letras "MBJ", conjunto de estrelas — dentro do orçamento de 20 KB, e escala
perfeitamente do favicon de 32px ao hero da Landing Page. FR-009e já admite simplificação do detalhe
fino desde que composição e proporções sejam preservadas.

**Alternatives considered**:
- *Remover o fundo do PNG e publicar variantes rasterizadas*: mais fiel em tamanho grande, mas perde
  nitidez no favicon, estoura o orçamento de peso e mantém duas representações da marca.
- *Vetorização automática*: gera arquivo maior que o raster e artefatos visíveis nas estrelas.

**Nota de verificação**: o escudo anterior em `public/brand/logo.svg` era uma aproximação simplificada
(contorno duplo, texto "MBJ" e uma estrela) que não correspondia ao brasão oficial. Foi substituído.

**Nota de revisão**: a decisão original previa o vetor simplificado também na interface. Ao comparar o
resultado com a referência normativa, ficou evidente que a simplificação não sustenta FR-032 — o
brasão real tem relevo, brilho e dezenas de estrelas que o vetor não reproduz. A extração do original
resolve isso sem abrir mão da nitidez em tamanhos pequenos, porque o vetor continua servindo favicon e
ícones. O custo é 140 KB de imagem, dentro do orçamento revisado.

**Detalhes da extração**: o preenchimento parte das bordas de propósito. Um limiar global sobre
"quase branco" furaria os brilhos especulares do dourado, que chegam perto do branco. O brasão tem
contorno azul-escuro, então o preenchimento para de forma limpa na silhueta. Uma passagem adicional
remove a franja de antisserrilhamento, evitando halo claro sobre o fundo navy.

---

## D-04 — Como gerar os PNGs de ícone da PWA sem ferramenta de imagem nova

**Decision**: um script Node ESM em `scripts/generate-brand-icons.mjs` que abre o SVG no Chromium via
Playwright — já presente como dependência de desenvolvimento — e captura os PNGs de 192px, 512px e o
maskable de 512px. Os arquivos gerados são versionados no repositório; o script é reexecutável para
regeneração determinística.

**Rationale**: o projeto não tem nenhuma biblioteca de processamento de imagem, e o Node 24 não
codifica PNG nativamente. As opções usuais (`sharp`, `@vite-pwa/assets-generator`) seriam dependências
novas sujeitas ao Princípio III. O Playwright já está instalado, roda Chromium, e captura de tela com
fundo transparente (`omitBackground`) é exatamente o que se precisa. Versionar a saída mantém o build
de produção livre de qualquer etapa de geração de imagem e preserva o alvo de custo incremental zero.

**Alternatives considered**:
- *Adicionar `sharp`*: ferramenta certa para o trabalho, mas é binário nativo por plataforma e uma
  dependência permanente para uma tarefa executada meia dúzia de vezes na vida do projeto.
- *`@vite-pwa/assets-generator`*: integra bem com o `vite-plugin-pwa` já usado, porém acopla geração
  de assets ao build e adiciona dependência.
- *Gerar os ícones manualmente em ferramenta externa*: sem custo de código, mas não é reproduzível e
  viola a rastreabilidade que o projeto mantém para artefatos gerados (ver `db:types`).

**Precedente no repositório**: `package.json` já expõe geração de artefato versionado por script
(`db:types` / `db:types:check`). O novo script segue o mesmo padrão.

---

## D-05 — Ícone maskable e a armadilha do recorte

**Decision**: publicar um arquivo maskable dedicado, separado do favicon, com o escudo ocupando ~60%
da largura do quadro, centralizado sobre fundo `#0A1325` preenchendo a área inteira. O manifesto passa
a declarar três entradas: `192x192` com `purpose: "any"`, `512x512` com `purpose: "any"` e
`512x512` com `purpose: "maskable"`.

**Rationale**: o manifesto atual declara `favicon.svg` com `purpose: "any maskable"` e o escudo desse
arquivo toca as bordas do `viewBox`. A especificação de ícones maskable reserva uma zona de segurança
circular de 80% do lado — tudo fora dela pode ser recortado pelo sistema. Na prática, hoje o contorno
do escudo é cortado no Android. Um ícone `any` e um ícone `maskable` têm requisitos de composição
opostos (o primeiro quer preencher, o segundo quer margem), e por isso não podem ser o mesmo arquivo.

**Alternatives considered**:
- *Manter um arquivo com dupla finalidade*: menos arquivos, mas ou o escudo fica pequeno demais no
  contexto `any`, ou continua recortado no `maskable`.
- *Declarar só `any`*: elimina o recorte, mas perde a integração visual com o sistema no Android,
  onde o ícone passa a ser exibido dentro de um contêiner branco padrão.

---

## D-06 — Como automatizar a verificação de consistência do tema nas 28 rotas

**Decision**: portão em três camadas, conforme SC-003a:

1. **Varredura estática** (Vitest): um teste percorre os arquivos de origem sob `src/` e falha se
   encontrar utilitário de cor da paleta padrão do Tailwind (`bg-amber-50`, `text-emerald-700`,
   `bg-white`, `text-black`, `bg-slate-*` e afins) ou cor literal em hexadecimal/`rgb()` fora dos
   arquivos de definição de token.
2. **Conformidade de paleta em runtime** (Playwright): em cada rota, um helper lê os valores
   resolvidos dos tokens em `:root` e percorre os elementos visíveis, comparando `background-color`,
   `color` e cores de borda contra a lista de valores permitidos — tokens sólidos mais suas
   derivações nas opacidades definidas (12%, 40%, 60%) mais `rgba(0, 0, 0, 0)`.
3. **Auditoria de acessibilidade** (Playwright + axe): as regras WCAG A e AA já usadas, ampliadas das
   2 rotas públicas atuais para as 28 catalogadas, incluindo a largura mobile com a gaveta aberta.

**Rationale**: as três camadas cobrem falhas diferentes. A estática pega a causa raiz mais provável —
alguém escrevendo `bg-white` numa tela nova — e é a mais barata de rodar. A de runtime pega superfície
clara herdada que continua tecnicamente legível e por isso não viola contraste. A auditoria pega o
que nenhuma das duas vê: contraste real, nomes acessíveis, semântica. Só automação de contraste, como
avaliado na clarificação, deixaria passar exatamente o cenário que a feature quer eliminar.

**Alternatives considered**:
- *Comparação de imagem contra capturas de referência*: detecta qualquer desvio, mas é instável com
  dados variáveis e diferenças de renderização entre máquinas; alto custo de manutenção para o ganho.
- *Só conferência visual manual*: não protege contra regressão futura, que é o principal risco depois
  que a feature entrega.

---

## D-07 — Como exercitar as 28 rotas autenticadas nos testes

**Decision**: extrair para `tests/e2e/support/auth-mock.ts` o padrão de mock já usado nas specs
existentes — interceptação das chamadas ao Supabase por `page.route()`, com JWT forjado carregando
`sub` e `aal`, e resposta fixa para a consulta de `user_roles` — parametrizado por papel. Um catálogo
em `tests/e2e/support/route-catalog.ts` lista as 28 rotas com o papel mínimo que as alcança e os
dados mínimos necessários para renderizar conteúdo.

**Rationale**: as specs de ponta a ponta hoje **não autenticam de verdade**; elas apontam para um
Supabase inexistente (`http://127.0.0.1:54321`, chave placeholder, ver `playwright.config.ts`) e
mockam cada endpoint com `page.route()`. O padrão funciona e está replicado em oito arquivos, cada um
redefinindo `jwt()`, `user()` e `json()`. Extrair o helper é pré-requisito prático para cobrir 24
rotas sem multiplicar essa duplicação por três papéis.

**Interpretação de escopo**: SC-003a fala em "28 rotas exercidas com os três papéis". Cada rota é
auditada **uma vez, com um papel autorizado a alcançá-la** — os três papéis em conjunto cobrem o
catálogo. Auditar toda rota com todo papel produziria 84 execuções, a maioria terminando em
redirecionamento por guarda de rota, sem ganho de sinal.

**Alternatives considered**:
- *Supabase local real com dados semeados*: fidelidade muito maior, mas exige subir o stack no CI,
  contraria o padrão vigente das specs e alonga o tempo de execução.
- *Cobrir só as rotas públicas e as três de maior densidade*: barato, mas não sustenta SC-001.

---

## D-08 — Estratégia de cache dos assets de marca

**Decision**: publicar a marca sob caminhos novos (`/brand/mbj-shield.svg`, `/brand/mbj-icon-*.png`),
remover `public/brand/logo.svg` e `public/pwa-192x192.png`, substituir o conteúdo de
`public/favicon.svg`, e acrescentar em `public/_headers` uma regra de revalidação para `/brand/*`.

**Rationale**: `public/_headers` hoje dá cache imutável de um ano só para `/assets/*` — a saída do
build, que já leva hash. Os arquivos de marca ficam na raiz pública, **sem regra própria**, herdando
o comportamento padrão da CDN, e com nomes fixos. Trocar o caminho é o que garante o resultado: o
arquivo antigo deixa de ser requisitado, então nenhuma cópia em cache pode ser servida por engano.
`index.html` e `manifest.webmanifest` já são `no-cache`, então os novos ponteiros chegam na primeira
visita. A regra de revalidação protege a *próxima* troca de marca no mesmo caminho.

**Caso do favicon**: `/favicon.svg` é referenciado por convenção e por `index.html`; mantê-lo no mesmo
caminho com conteúdo novo é aceitável porque a regra de revalidação passa a cobri-lo, e o custo de
uma requisição condicional por visita é irrelevante para um arquivo desse tamanho.

**Alternatives considered**:
- *Hash de conteúdo via empacotador, caindo sob `/assets/*` imutável*: invalidação automática
  perfeita, mas o endereço dos ícones mudaria a cada build, fazendo a PWA rebaixar e rebaixar ícones
  sem que a marca tenha mudado.
- *Sufixo de versão nas referências atuais*: mudança mínima, porém o arquivo antigo continua existindo
  e é servido para qualquer referência que escape do sufixo.

---

## D-09 — Como as superfícies de estado derivam de um único valor

**Decision**: cada token de estado tem um valor sólido; superfície e borda derivam dele por opacidade
(≈12% e ≈40%) usando a sintaxe de opacidade do Tailwind sobre a variável de cor, sem declarar valores
novos.

**Rationale**: o código já usa exatamente esse idioma — `border-destructive/40` aparece em
`shared/components/feedback.tsx` e em telas de autenticação. Manter o padrão evita inventar oito
valores hexadecimais adicionais e mantém o conjunto de tokens pequeno e auditável, o que por sua vez
mantém tratável a lista de valores permitidos na verificação de paleta (D-06).

**Ponto de atenção para a implementação**: composições com opacidade sobre o fundo navy têm contraste
efetivo menor que o valor sólido. Elas são aprovadas para **superfície e borda**, nunca para texto —
texto de estado usa sempre o valor sólido, cujos contrastes estão calculados no anexo da spec.

---

## D-10 — Cores fixas que precisam sair do código

**Decision**: três ocorrências identificadas por varredura, todas substituídas por tokens.

| Ocorrência | Local | Substituição |
|---|---|---|
| `bg-amber-50` + `text-amber-950` | `features/offline/components/OfflineIndicator.tsx` | Superfície e texto do token de atenção |
| `bg-emerald-700` (gramado) | `features/lineups/components/LineupEditor.tsx`, `features/lineups/components/PublishedLineup.tsx` | Token de superfície de campo, derivado do verde de sucesso em tom escurecido |
| `bg-foreground/50` (véu de modal) | `shared/components/feedback.tsx` | Token de véu, preto a 60% |

**Rationale**: as duas primeiras são pares pensados para tema claro — o âmbar é quase branco e viraria
um bloco luminoso sobre o navy. O véu é o caso mais grave: `foreground` no tema escuro é branco, então
o véu de todo diálogo modal ficaria branco a 50%, invertendo a hierarquia visual da aplicação inteira.

**Nota sobre o gramado**: o verde do campo é decoração de domínio, não estado semântico. Ele ganha
token próprio de superfície em vez de reutilizar o token de sucesso, para que a verificação de paleta
não precise abrir exceção e para que uma futura mudança em "sucesso" não repinte o campo.

---

## D-11 — Como recriar o clima do hero sem fotografia de terceiros

**Decision**: compor o hero inteiramente com meios do próprio projeto — gradiente linear base em azul
navy, gradiente radial dourado de baixa intensidade no topo simulando refletores, vinheta radial nas
bordas e textura de grão sutil. Preferir CSS puro; recorrer a um asset raster próprio apenas se a
textura não for satisfatória por CSS, versionado e dentro de orçamento.

**Rationale**: a referência deve de fato ser normativa (FR-032), mas o repositório não tem fotografia
licenciada e o projeto proíbe usar imagem de terceiros sem licença. Sobreposição de gradientes
reproduz bem os três traços que dão o clima da referência — profundidade vertical, foco luminoso
superior e escurecimento das bordas — sem nenhum arquivo externo, sem peso de download e sem risco
jurídico. Textura por CSS evita até o asset raster no caso comum.

**Alternatives considered**:
- *Fotografia licenciada de banco de imagens*: fidelidade máxima, mas custo, licenciamento e peso de
  imagem incompatíveis com o alvo de custo incremental zero do projeto.
- *Gradiente simples sem glow nem vinheta*: trivial de implementar, mas produz exatamente o resultado
  "chapado" que a decisão de tornar a referência normativa pretende evitar.

**Consequência**: a composição usa gradientes, que são `background-image` e não `background-color` —
ver D-12.

---

## D-12 — Gradientes e a verificação automatizada de paleta

**Decision**: gradientes ficam **fora da lista enumerável de cores sólidas** da camada 2. Seus stops
DEVEM derivar de tokens do tema, e sua conformidade é verificada na camada 4, a conferência visual
dirigida, que passa a incluir a Landing Page.

**Rationale**: a camada 2 lê `background-color`; um gradiente é `background-image` e deixaria a cor de
fundo computada como transparente, escapando silenciosamente da verificação. Além disso, um gradiente
é contínuo por natureza — enumerar seus valores intermediários é impossível, e o conjunto fechado de
opacidades {10%, 40%, 60%} não se aplica a stops de gradiente sem inviabilizar o efeito de iluminação
exigido por FR-033.

**Alternatives considered**:
- *Estender a camada 2 para analisar stops de `background-image`*: possível, mas exige interpretar
  sintaxe de gradiente em runtime para um ganho pequeno, já que os stops vêm de tokens por construção.
- *Proibir gradientes*: inviabilizaria FR-033 e FR-037.

---

## Resumo de dependências

**Adicionadas**: nenhuma. A composição do hero usa apenas CSS; nenhum pacote de gradiente, ruído ou
efeito visual entra no projeto.
**Removidas**: nenhuma.
**Reutilizadas fora do uso atual**: Playwright, hoje só em testes, passa a ser usado também pelo
script de geração de ícones — em tempo de desenvolvimento, nunca em produção nem no build.
