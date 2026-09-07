# Phase 1 — Data Model: Redesign Visual Dark Navy e Refinamento da Navegação

**Feature**: `002-mbj-dark-navy-redesign` | **Date**: 2026-09-06

Esta feature não possui modelo de dados persistido. Nenhuma tabela, coluna, política RLS, migração ou
contrato de serviço é criado ou alterado. As "entidades" abaixo são estruturas de configuração e de
apresentação que vivem no código-fonte.

---

## 1. ThemeTokens

Conjunto nomeado de papéis visuais. É a única origem de cor permitida na aplicação (FR-002, FR-003f).

**Onde vive**: valores em `src/index.css` (`:root` + `@theme inline`); espelho declarativo em
`clubConfig.theme` (`src/config/club.config.ts`); nomes em `SEMANTIC_THEME_TOKENS`.

**Formato**: componentes HSL sem função de cor (`"220 58% 9%"`), consumidos como `hsl(var(--token))`.
Esse é o formato já em uso e é mantido para preservar a sintaxe de opacidade do Tailwind
(`bg-token/40`).

### 1.1 Família marca e superfície

| Token | Valor HSL | Hex de referência | Papel |
|---|---|---|---|
| `background` | `220 58% 9%` | `#0A1325` | Fundo de página (canvas) |
| `foreground` | `0 0% 100%` | `#FFFFFF` | Texto primário |
| `card` | `222 51% 14%` | `#111C35` | Superfície de card, barra lateral e gaveta |
| `card-foreground` | `0 0% 100%` | `#FFFFFF` | Texto sobre card |
| `elevated` | `221 45% 18%` | `#1A2744` | Superfície elevada, hover, linha alternada |
| `primary` | `45 84% 49%` | `#E6B014` | Ação primária, link ativo, acento |
| `primary-foreground` | `220 58% 9%` | `#0A1325` | Texto sobre ação primária |
| `secondary` | `47 90% 55%` | `#F3C623` | Acento claro, hover de acento |
| `secondary-foreground` | `220 58% 9%` | `#0A1325` | Texto sobre acento claro |
| `muted` | `223 46% 16%` | `#16213C` | Superfície neutra secundária, recuada |
| `muted-foreground` | `215 20% 65%` | `#94A3B8` | Texto de apoio, rótulos, metadados |
| `accent` | `45 84% 49%` | `#E6B014` | Realce de estado ativo |
| `accent-foreground` | `220 58% 9%` | `#0A1325` | Texto sobre realce |
| `border` | `220 43% 24%` | `#233558` | Borda e divisor padrão |
| `input` | `220 38% 48%` | `#4C6BA9` | Contorno de campo de formulário e de botão contornado |
| `ring` | `45 84% 49%` | `#E6B014` | Anel de foco |
| `overlay` | `0 0% 0%` | `#000000` | Véu de modal e de gaveta, aplicado a 60% |

### 1.2 Família estado semântico

| Token | Valor HSL | Hex de referência | Papel |
|---|---|---|---|
| `success` | `158 64% 52%` | `#34D399` | Confirmação e conclusão de ação |
| `success-foreground` | `220 58% 9%` | `#0A1325` | Texto sobre preenchimento de sucesso |
| `warning` | `27 96% 61%` | `#FB923C` | Alerta não bloqueante, modo offline, pendência |
| `warning-foreground` | `220 58% 9%` | `#0A1325` | Texto sobre preenchimento de atenção |
| `destructive` | `0 91% 71%` | `#F87171` | Erro de validação, falha, ação destrutiva |
| `destructive-foreground` | `220 58% 9%` | `#0A1325` | Texto sobre preenchimento destrutivo |
| `info` | `213 94% 68%` | `#60A5FA` | Mensagem neutra e informativa |
| `info-foreground` | `220 58% 9%` | `#0A1325` | Texto sobre preenchimento informativo |

O token `destructive` **substitui** o valor atual `0 72% 51%`, que atinge apenas 4,0:1 sobre o novo
fundo e reprovaria em WCAG AA.

### 1.3 Família domínio

| Token | Valor HSL | Hex de referência | Papel |
|---|---|---|---|
| `pitch` | `160 61% 15%` | `#0F3D2E` | Superfície do gramado no editor e na escalação publicada |
| `pitch-foreground` | `0 0% 100%` | `#FFFFFF` | Texto e marcações principais sobre o gramado |
| `pitch-line` | `159 11% 75%` | `#B7C5C0` | Marcações secundárias do campo (círculo central, áreas) |

Separado da família de estado de propósito: o gramado é decoração de domínio, não sinal de sucesso
(ver research D-10). Substitui o `bg-emerald-700` fixo.

### 1.4 Regras de derivação

| Derivação | Opacidade | Uso permitido | Uso proibido |
|---|---|---|---|
| Superfície tênue | 10% | Fundo de banner, selo, alerta, item selecionado — de qualquer token | Texto |
| Borda tênue | 40% | Contorno de banner, card em estado — de qualquer token | Texto |
| Véu | 60% | Fundo de modal e de gaveta | Qualquer outro uso |
| Elemento inativo | 40% no elemento | Atenuação de controle desabilitado (E-03) | — |

As três primeiras são alfa aplicado à cor e entram na lista de valores permitidos da verificação. A
quarta é `opacity` do elemento, mecanismo distinto: compõe sobre o fundo sem alterar a cor computada
e por isso não produz falso positivo.

O conjunto é fechado e exato (FR-003b). Texto de estado usa **sempre** o valor sólido: composições
com opacidade sobre o navy reduzem o contraste efetivo e não são validadas para texto (FR-003h).

### 1.5 Regras de validação

- **V-01**: o conjunto de chaves de `clubConfig.theme` é idêntico a `SEMANTIC_THEME_TOKENS`
  (regra já existente, mantida).
- **V-02** *(nova)*: cada valor em `clubConfig.theme` é idêntico ao valor da variável CSS de mesmo
  nome em `src/index.css`. Impede divergência silenciosa entre as duas declarações (research D-01).
- **V-03**: todo token tem exatamente um valor. Não há variantes por tema — a aplicação tem um tema
  único (A-02).
- **V-04**: nenhum arquivo fora de `src/index.css` e `src/config/club.config.ts` declara cor literal
  em hexadecimal, `rgb()` ou `hsl()`, nem usa utilitário de cor da paleta padrão do Tailwind.

### 1.6 Contrastes verificados

| Par | Razão | WCAG AA |
|---|---|---|
| `foreground` sobre `background` | 18,7:1 | Passa |
| `muted-foreground` sobre `background` | 7,3:1 | Passa |
| `foreground` sobre `card` | 17,0:1 | Passa |
| `muted-foreground` sobre `card` | 6,7:1 | Passa |
| `primary` sobre `background` | 9,3:1 | Passa |
| `primary-foreground` sobre `primary` | 9,3:1 | Passa |
| `success` sobre `background` | 9,7:1 | Passa |
| `warning` sobre `background` | 8,2:1 | Passa |
| `destructive` sobre `background` | 6,7:1 | Passa |
| `info` sobre `background` | 7,3:1 | Passa |
| `foreground` sobre `pitch` | 12,1:1 | Passa |
| `pitch-line` sobre `pitch` | 6,7:1 | Passa |
| `foreground` sobre `muted` | 16,1:1 | Passa |
| `muted-foreground` sobre `muted` | 6,3:1 | Passa |

Contraste de elementos não textuais, sujeitos a 3:1 por FR-042:

| Par | Razão | 3:1 |
|---|---|---|
| `input` sobre `card` | 3,2:1 | Passa |
| `input` sobre `background` | 3,5:1 | Passa |
| `ring` sobre `card` | 8,5:1 | Passa |
| `ring` sobre `background` | 9,3:1 | Passa |
| `pitch-line` sobre `pitch` | 6,8:1 | Passa |
| `border` sobre `card` | 1,4:1 | Isento — divisor decorativo |

`input` **deixa de compartilhar o valor de `border`**: em `#233558` atingia apenas 1,4:1 sobre o card,
reprovando em WCAG 1.4.11 para limite de controle, sem nenhum outro elemento identificando a borda do
campo (o fundo do campo contra o card dava 1,1:1).

Escala de superfície, monotônica e distinguível: `background` 9% < `card` 14% < `muted` 16% <
`elevated` 18% < `border` 24%. `muted` e `elevated` precisam de valores distintos porque `bg-muted`
é usado em 15 superfícies; se coincidissem, o hover sobre elas seria invisível.

---

## 2. BrandAssets

Arquivos de identidade derivados de uma única origem vetorial, e os caminhos por onde a aplicação os
referencia.

**Onde vive**: arquivos em `public/`; caminhos em `clubConfig.assets`; referências em `index.html` e
na configuração do manifesto em `vite.config.ts`.

### 2.1 Artefatos

| Artefato | Caminho publicado | Origem | Fundo | Orçamento |
|---|---|---|---|---|
| Brasão em tela | `/brand/mbj-crest-512.webp` | Extraído de `logo mbj 2.png` | Transparente | ≤ 120 KB |
| Brasão, marca d'água | `/brand/mbj-crest-1024.webp` | Extraído de `logo mbj 2.png` | Transparente | ≤ 120 KB |
| Escudo vetorial (só favicon) | `/brand/mbj-shield.svg` | Redesenho vetorial | Transparente | ≤ 20 KB |
| Favicon | `/favicon.svg` | Mesmo vetor | Transparente | ≤ 20 KB |
| Ícone PWA 192 | `/brand/mbj-icon-192.png` | Rasterizado do vetor | Transparente | ≤ 40 KB |
| Ícone PWA 512 | `/brand/mbj-icon-512.png` | Rasterizado do vetor | Transparente | ≤ 40 KB |
| Ícone maskable | `/brand/mbj-icon-maskable-512.png` | Rasterizado do vetor | `#0A1325` opaco | ≤ 40 KB |
| Textura do hero *(condicional)* | `/brand/hero-texture.png` | Ativo próprio da feature | Transparente | ≤ 30 KB |

Carga total de marca ≤ 300 KB. A textura só é criada se a composição por CSS não atingir a fidelidade
exigida por FR-033; nunca é imagem de terceiros.

### 2.2 Artefatos removidos

| Caminho | Situação |
|---|---|
| `/brand/logo.svg` | Removido da publicação |
| `/pwa-192x192.png` | Removido da publicação |

Nenhum dos dois pode permanecer acessível após a publicação (SC-008).

### 2.3 Referências de design (não publicadas)

| Arquivo | Papel |
|---|---|
| `logo mbj 2.png` | Escudo oficial de origem; base do redesenho vetorial |
| `Sugestão nova interface e tema mbj.png` | Referência de tema, hierarquia e composição |
| `logo mbj 1.jpg` | Referência histórica; não usada para geração |

### 2.4 Regras de validação

- **V-05**: o favicon e o escudo vetorial têm fundo transparente e `viewBox` quadrado; as variantes
  do brasão em tela têm fundo transparente e quadro quadrado.
- **V-06**: o ícone maskable mantém o escudo dentro da zona de segurança circular de 80% do lado, com
  o restante do quadro preenchido em `background`.
- **V-07**: o ícone maskable e o favicon são arquivos distintos (requisitos de composição opostos).
- **V-08**: nenhum artefato excede seu orçamento de peso.
- **V-09**: `logo mbj 2.png` não é referenciado por nenhum código de aplicação nem publicado; é
  insumo exclusivo do script de geração.
- **V-17**: as superfícies de interface referenciam `crest` ou `crestLarge`, nunca `shield`
  (FR-009f).
- **V-18**: o brasão em tela não apresenta halo claro na silhueta quando composto sobre
  `background` ou `card` (GA-13).

---

## 3. NavigationItem

Destino exibido na casca de navegação. O conjunto é fechado e corresponde exatamente às rotas já
existentes (FR-014). Esta feature **não altera** o conjunto nem as condições de visibilidade.

**Onde vive**: `src/app/layouts/AuthenticatedLayout.tsx`, movido para o subcomponente de lista.

### 3.1 Campos

| Campo | Tipo | Descrição |
|---|---|---|
| `label` | `string` | Rótulo em pt-BR exibido ao usuário |
| `to` | `string` | Rota de destino existente |
| `icon` | componente de ícone | Ícone de `lucide-react`, biblioteca já em uso |
| `end` | `boolean` | Correspondência exata de rota; verdadeiro apenas para `/app` |
| `visibleFor` | conjunto de papéis \| `"all"` | Condição de visibilidade vigente |

### 3.2 Conjunto normativo

| Ordem | `label` | `to` | `visibleFor` |
|---|---|---|---|
| 1 | Início | `/app` | all |
| 2 | Elenco | `/app/roster` | all |
| 3 | Partidas | `/app/matches` | all |
| 4 | Estatísticas | `/app/statistics` | all |
| 5 | Mural | `/app/notices` | all |
| 6 | Notificações | `/app/notification-preferences` | all |
| 7 | Área do atleta | `/app/athlete` | `ATHLETE` |
| 8 | Craque do Jogo | `/app/athlete/mvp-voting` | `ATHLETE` |
| 9 | Comissão técnica | `/app/staff` | `COACH`, `PRESIDENT` |
| 10 | Administração | `/app/admin` | `PRESIDENT` |

### 3.3 Estados de um item

| Estado | Apresentação |
|---|---|
| Padrão | Texto `muted-foreground`, fundo transparente |
| Hover | Fundo `elevated`, texto `foreground` |
| Foco | Anel `ring` visível, sem remover o estilo de hover |
| Ativo (rota atual) | Fundo `primary`, texto `primary-foreground`, `aria-current="page"` |
| Desabilitado | Não se aplica — itens de navegação nunca são desabilitados |

### 3.4 Regras de validação

- **V-10**: nenhum item aponta para rota inexistente; nenhum destino existente fica sem item.
- **V-11**: não existe item "Escalação" de nível superior (FR-014a).
- **V-12**: as condições de `visibleFor` são idênticas às vigentes antes da feature (FR-014b).
- **V-13**: todo item tem alvo de toque de no mínimo 44x44 px em qualquer largura.

---

## 4. NavigationShellState

Estado de interface da casca de navegação. É estado de UI puro, local ao componente. **Não** vai para
Zustand nem para TanStack Query — a Constituição reserva o primeiro para estado de UI compartilhado e
o segundo exclusivamente para estado remoto, e este estado não é nem uma coisa nem outra.

### 4.1 Campos

| Campo | Tipo | Descrição |
|---|---|---|
| `isDrawerOpen` | `boolean` | Gaveta modal aberta; relevante apenas abaixo de 768px |
| `isSigningOut` | `boolean` | Já existente; desabilita o botão "Sair" durante a saída |

### 4.2 Transições

| De | Evento | Para | Efeito |
|---|---|---|---|
| Fechada | Acionar botão de menu | Aberta | `showModal()`; foco entra na gaveta |
| Aberta | Selecionar destino | Fechada | Navega e fecha (FR-023) |
| Aberta | Pressionar Esc | Fechada | Evento `cancel` nativo |
| Aberta | Acionar o véu | Fechada | Clique cujo alvo é o próprio elemento de diálogo |
| Aberta | Largura atinge 768px | Fechada | Fecha para evitar gaveta e barra lateral simultâneas (E-08) |

**Invariante**: em qualquer largura ≥ 768px, `isDrawerOpen` é falso e a gaveta não está montada como
modal. Em qualquer largura < 768px, a barra lateral estática não é renderizada.

### 4.3 Regras de validação

- **V-14**: ao fechar por qualquer via, o foco retorna ao botão que abriu a gaveta (FR-024).
- **V-15**: com a gaveta fechada, nenhum elemento dela é alcançável por teclado.
- **V-16**: a rolagem do corpo da página não permanece bloqueada após o fechamento (E-08).
