# Contract: Landing Page Composition

**Feature**: `002-mbj-dark-navy-redesign`

Contrato de fidelidade visual da Landing Page (`/`) à referência normativa
`Sugestão nova interface e tema mbj.png` (FR-032 a FR-040, SC-011, SC-012).

**Natureza deste contrato**: a referência é normativa para **composição, proporção, hierarquia e
presença de elementos** — não para diferença de pixels. A aferição é a lista de conferência ao final
deste documento.

---

## Regiões da composição

```text
┌────────────────────────────────────────────────────────────────┐
│                                    Início  Entrar  Ativar conv. │  ← nav, rota ativa em dourado
│                                                                 │
│      ┌────────┐                        ╔═══════════════════╗   │
│      │ ESCUDO │                        ║ card 1 (claro)    ║   │
│      └────────┘                        ╚═══════════════════╝   │
│        M B J                                          ░░░░░░    │  ← escudo em marca d'água
│                                        ╔═══════════════════╗   │
│   Bem-vindo ao          ← branco       ║ card 2 (profundo) ║   │
│   Meia Boca Juniors     ← dourado      ╚═══════════════════╝   │
│   descrição…                                                    │
│                                                                 │
│   [Entrar no clube →]  [Ativar convite]                        │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│  MEIA BOCA JUNIORS ──────────────────────  <institucional>      │  ← faixa institucional
└────────────────────────────────────────────────────────────────┘
```

---

## C-L1 — Fundo do hero

| Camada | Exigência |
|---|---|
| Fotografia | Fotografia própria do clube (`heroStadium`), espelhada para concentrar torcida/refletores no lado sem texto (D-13) |
| Véu | Gradiente horizontal em azul navy, opaco onde fica o texto, mais fraco onde só ficam cards e marca d'água |
| Iluminação | Gradiente radial dourado de baixa intensidade na região superior, simulando refletores |
| Vinheta | Escurecimento radial nas bordas, concentrando a atenção no centro-esquerda |
| Textura | Grão sutil, preferencialmente por CSS; asset raster próprio apenas se necessário |

**Garantias**:
- **GL-01**: nenhuma fotografia de terceiros é usada — a única fotografia do hero é própria do clube
  (FR-033). Uma futura troca de foto continua coberta pela mesma garantia, porque o teto de FR-041 é
  calculado contra o pior caso teórico (branco), não contra o tom real da foto em uso (D-13).
- **GL-02**: todos os stops de gradiente derivam de tokens do tema (G-07); a fotografia em si, sendo
  captura real, está isenta dessa exigência.
- **GL-03**: o texto sobre o hero mantém contraste mínimo de 4,5:1 **sobre a região mais clara** da
  composição, não apenas sobre a cor base.

**GL-16 — teto de luminância e razões calculadas**: nenhuma região do hero sob texto ultrapassa
luminância relativa de **0,030** (FR-041). Desde D-13, o pior caso não é mais medido contra o tom real
da fotografia, e sim **calculado** contra o pior caso teórico dela (pixel branco), compondo as camadas
de véu e brilho sequencialmente, na ordem real de pintura do CSS:

| Texto | Razão medida | WCAG AA |
|---|---|---|
| Primário (`foreground`) | 13,8:1 | Passa |
| Secundário (`muted-foreground`) | 5,4:1 | Passa |
| Dourado (`primary`) | 7,0:1 | Passa |

Luminância do pior caso composto: **0,026**, abaixo do teto de 0,030. O texto secundário continua
sendo o par mais próximo do limite.

**Método de verificação — reproduzível e independente do axe e da fotografia em uso**: compor
sequencialmente, sobre branco puro, o véu horizontal (na zona forte, onde vive o texto) e depois o
brilho radial dourado por cima do véu já escurecido — nunca da fotografia crua (D-13,
`HERO_LAYER_ALPHA` em `hero-backdrop.constants.ts`, fonte única compartilhada entre o componente e o
teste). Opera sobre os alfas declarados, não sobre pixels da fotografia, então continua válido mesmo
que a foto seja trocada no futuro.

**GL-17 — elementos não textuais do hero**: contorno do botão secundário, anel de foco e indicador de
rota ativa atingem no mínimo 3:1 contra o pior caso do fundo (FR-042). O contorno usa `input`
(3,5:1 sobre o navy base) e o anel usa `ring` (9,3:1).

**GL-18 — o axe não aprova o hero**: a auditoria automatizada devolve *incomplete*, nunca *violation*,
para contraste sobre gradiente. A ausência de erro na camada 3 **não** constitui aprovação do hero; a
verificação de GL-16 é obrigatória e independente.

## C-L2 — Escudo em marca d'água

| Propriedade | Exigência |
|---|---|
| Posição | Lado direito do hero, parcialmente sangrado na borda |
| Escala | Grande — dominante na região, como na referência |
| Opacidade | Reduzida no elemento, o suficiente para não competir com o conteúdo |
| Semântica | `aria-hidden`, sem texto alternativo — é decoração |

**GL-04**: a marca d'água não reduz o contraste de nenhum texto abaixo de 4,5:1 e não invade a coluna
de conteúdo a ponto de prejudicar a leitura (E-15).

## C-L3 — Título bicolor

| Parte | Cor |
|---|---|
| "Bem-vindo ao" | `foreground` |
| "Meia Boca Juniors" | `primary` |

**GL-05**: a concatenação das duas partes reproduz **exatamente** o título atual. O conteúdo textual
não muda; apenas a apresentação é segmentada (FR-035, E-16). Verificável por teste de igualdade.

**GL-06**: o título permanece um único `<h1>` na árvore de acessibilidade; a segmentação é visual.

## C-L4 — Navegação pública

**GL-07**: a rota ativa é destacada em dourado com indicador visual, e anunciada com
`aria-current="page"`.

**GL-08**: os destinos são exatamente os existentes — Início, Entrar, Ativar convite. Nenhuma rota
nova (FR-036).

## C-L5 — Cards da coluna direita

| Card | Superfície | Borda | Ícone |
|---|---|---|---|
| 1 — "Um acesso, todos os seus papéis" | Gradiente navy mais claro | Dourada | Dourado |
| 2 — "Acesso somente por convite" | Navy mais profundo | Dourada | Dourado |

**GL-09**: a diferença de profundidade entre os dois cards é perceptível, reproduzindo a hierarquia
da referência.

**GL-10**: textos, ordem, ícones e função permanecem exatamente os atuais (FR-037).

## C-L6 — Botões

| Botão | Exigência |
|---|---|
| "Entrar no clube" | Preenchido em dourado, com o ícone de seta já existente |
| "Ativar convite" | Contornado, superfície escura |

**GL-11**: raio, borda e proporção aproximam o mockup — botões visivelmente mais arredondados que o
padrão atual.

**GL-12**: rótulos, destinos e comportamento permanecem inalterados (FR-038).

## C-L7 — Faixa institucional

| Região | Conteúdo | Origem |
|---|---|---|
| Esquerda | Nome do clube, com espaçamento de letras | `clubConfig.identity.fullName` |
| Centro | Régua horizontal dourada | Puramente visual |
| Direita | Texto institucional, com espaçamento de letras | `clubConfig.identity.slogan` |

**GL-13**: **nenhum texto novo pode ser introduzido.** O trio "FUTEBOL · AMIZADE · HISTÓRIA" que
aparece na referência **não** é adotado: ele substituiria o slogan oficial do clube, que é
"Raça, amizade e futebol.". A faixa usa o slogan aprovado, ou permanece puramente visual naquela
região (FR-039, SC-012).

## C-L8 — Proporções e hierarquia

**GL-14**: em 1920x1080 e 1366x768, a relação entre escudo, título, descrição, chamadas para ação e
coluna direita corresponde visualmente à referência: hero ocupando a coluna esquerda com o conteúdo
alinhado à esquerda, cards empilhados à direita ocupando aproximadamente um terço da largura, e a
faixa institucional fixada ao pé da dobra.

**GL-15**: a composição degrada de forma coerente abaixo de 768px — a coluna direita passa a fluir
abaixo do hero, a marca d'água é reduzida ou suprimida, e nenhuma rolagem horizontal é introduzida.

---

## Lista de conferência de fidelidade

Aferição de SC-011. Todos os sete itens precisam ser confirmados presentes, em 1920x1080, comparando
lado a lado com a referência.

| # | Elemento | Presente? |
|---|---|---|
| 1 | Hero com fotografia própria do clube, véu, iluminação radial e vinheta | ☐ |
| 2 | Escudo em marca d'água no lado direito | ☐ |
| 3 | Título bicolor — branco e dourado | ☐ |
| 4 | Navegação pública com rota ativa em dourado | ☐ |
| 5 | Cards em dois níveis de profundidade, com borda e ícone dourados | ☐ |
| 6 | Botões no formato do mockup — dourado preenchido e contornado | ☐ |
| 7 | Faixa institucional no rodapé, com régua dourada | ☐ |

**Critério de aprovação**: os sete presentes **e** a composição reconhecível como a mesma proposta
visual da referência (FR-032). Um item ausente reprova a conferência.

---

## Obrigações preservadas

- **PL-01**: nenhuma rota nova é criada.
- **PL-02**: nenhum texto funcional é alterado ou acrescentado; toda cadeia exibida vem da
  configuração institucional existente.
- **PL-03**: nenhuma regra de negócio, permissão ou contrato de serviço é tocado.
- **PL-04**: os destinos, rótulos e comportamentos das chamadas para ação permanecem os atuais.
