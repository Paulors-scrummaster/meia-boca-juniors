# Contract: Brand Assets

**Feature**: `002-mbj-dark-navy-redesign`

Contrato entre os arquivos de marca publicados e tudo que os referencia: componentes React, documento
HTML raiz, manifesto da PWA e política de cache da borda.

## Artefatos publicados

| Caminho | Formato | Fundo | Consumidores |
|---|---|---|---|
| `/brand/mbj-crest-512.webp` | WebP | Transparente | **Interface**: Landing Page, barra lateral, faixa superior mobile, cards |
| `/brand/mbj-crest-1024.webp` | WebP | Transparente | **Interface**: marca d'água do hero |
| `/brand/mbj-shield.svg` | SVG | Transparente | Apenas favicon; não usado na interface (FR-009f) |
| `/favicon.svg` | SVG | Transparente | `index.html` (`rel="icon"`) |
| `/brand/mbj-icon-192.png` | PNG | Transparente | Manifesto (`purpose: "any"`), `apple-touch-icon` |
| `/brand/mbj-icon-512.png` | PNG | Transparente | Manifesto (`purpose: "any"`) |
| `/brand/mbj-icon-maskable-512.png` | PNG | `#0A1325` opaco | Manifesto (`purpose: "maskable"`) |
| `/brand/hero-texture.png` *(condicional)* | PNG | Transparente | Textura sutil do hero, apenas se CSS não bastar (FR-033) |

Caminhos são referenciados por `clubConfig.assets`. Nenhum componente escreve caminho de marca
literal.

## Contrato de geração — brasão em tela

Origem: `logo mbj 2.png`, o arquivo oficial em alta resolução (1254x1254, fundo branco opaco). O
script `scripts/generate-brand-assets.mjs` remove o fundo por preenchimento a partir das bordas,
recorta à silhueta e exporta as variantes com transparência.

| Garantia | Descrição |
|---|---|
| **GA-12** | O brasão em tela preserva relevo, brilho e o campo completo de estrelas do original |
| **GA-13** | Nenhum halo claro aparece na silhueta quando composto sobre `background` ou `card` |
| **GA-14** | O original de 1,6 MB permanece como insumo do script e nunca é publicado |

## Contrato de geração — ícones

Aplica-se aos **três ícones da PWA**. Origem: `/brand/mbj-shield.svg`, do qual são derivados pelo
mesmo script, que usa o Chromium do Playwright já instalado (research D-04).

| Garantia | Descrição |
|---|---|
| **GA-01** | Regenerar a partir do mesmo SVG produz PNGs equivalentes (processo determinístico) |
| **GA-02** | Os PNGs são versionados no repositório; o build de produção não gera imagem |
| **GA-03** | O maskable mantém o escudo dentro da zona de segurança circular de 80% do lado |
| **GA-04** | O maskable e o favicon são arquivos distintos, com composições diferentes |
| **GA-05** | `logo mbj 2.png` não é publicado nem importado por código de aplicação; é insumo do script de geração |

## Contrato de geração — textura do hero

A textura é um **artefato de origem independente**: não deriva do escudo, não é produzida por
`generate-brand-icons.mjs` e não está sujeita a GA-01 nem a GA-02.

| Garantia | Descrição |
|---|---|
| **GA-11** | A textura é ativo próprio da feature, criado do zero, nunca imagem de terceiros. É condicional: só existe se a composição por CSS não atingir a fidelidade de FR-033. Se existir, é versionada, respeita o orçamento de 30 KB e seu processo de criação fica documentado junto ao arquivo. |

## Contrato do manifesto

Três entradas de ícone, substituindo as duas atuais:

| `src` | `sizes` | `type` | `purpose` |
|---|---|---|---|
| `/brand/mbj-icon-192.png` | `192x192` | `image/png` | `any` |
| `/brand/mbj-icon-512.png` | `512x512` | `image/png` | `any` |
| `/brand/mbj-icon-maskable-512.png` | `512x512` | `image/png` | `maskable` |

Cores do manifesto:

| Campo | Antes | Depois |
|---|---|---|
| `theme_color` | `#071a33` | `#0A1325` |
| `background_color` | `#f8fafc` | `#0A1325` |

`background_color` é a cor da tela de abertura da PWA; mantê-la clara produziria um flash branco na
abertura de um app escuro.

O `includeAssets` da configuração da PWA passa a listar os novos caminhos.

## Contrato do documento HTML raiz

| Elemento | Mudança |
|---|---|
| `<meta name="theme-color">` | `#071a33` → `#0A1325` |
| `<link rel="icon">` | Conteúdo do arquivo substituído; caminho mantido |
| `<link rel="apple-touch-icon">` | `/pwa-192x192.png` → `/brand/mbj-icon-192.png` |

## Contrato de cache

| Caminho | Política | Situação |
|---|---|---|
| `/brand/*` | Revalidação obrigatória | **Nova regra** em `public/_headers` |
| `/favicon.svg` | Revalidação obrigatória | **Nova regra** |
| `/manifest.webmanifest` | `no-cache, must-revalidate` | Já existente, mantida |
| `/index.html` | `no-cache, no-store, must-revalidate` | Já existente, mantida |
| `/assets/*` | `public, max-age=31536000, immutable` | Já existente; **não se aplica a `/brand/*`** |

**Garantia GA-06**: assets de marca nunca herdam a política imutável de `/assets/*`.

## Artefatos removidos

| Caminho | Ação |
|---|---|
| `/brand/logo.svg` | Excluído |
| `/pwa-192x192.png` | Excluído |

**Garantia GA-07**: após a publicação, nenhum caminho de marca anterior responde com sucesso. É isso
que impede uma cópia em cache do escudo antigo de continuar sendo servida (FR-012a, SC-008).

## Contrato de qualidade visual

| Garantia | Descrição |
|---|---|
| **GA-08** | O escudo é identificável a 32px: contorno e silhueta legíveis, admitida simplificação do detalhe fino das estrelas (FR-009e) |
| **GA-09** | O escudo compõe sobre `background` e sobre `card` sem moldura, halo ou borda branca |
| **GA-10** | Todo uso do escudo em `<img>` tem texto alternativo derivado de `clubConfig.identity` |

## Orçamento de peso

| Artefato | Limite |
|---|---|
| Cada SVG | 20 KB |
| Cada PNG de ícone | 40 KB |
| Cada variante do brasão em tela | 120 KB |
| Textura do hero, se existir | 30 KB |
| Total de marca | 300 KB |

O orçamento subiu de 180 KB para 300 KB ao adotar o brasão real na interface. O ganho de fidelidade
exigido pela referência normativa custa peso de imagem; a compressão com transparência mantém as duas
variantes em 140 KB somados, contra 1,6 MB do original.

A textura é **condicional**: só é criada se a composição por CSS não atingir a fidelidade exigida por
FR-033. Sendo um ativo próprio da feature, nunca uma imagem de terceiros.

Referência: o arquivo de origem tem 1,6 MB e não é publicado.
