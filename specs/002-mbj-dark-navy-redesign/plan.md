# Implementation Plan: Redesign Visual Dark Navy e Refinamento da Navegação (MBJ)

**Branch**: `002-mbj-dark-navy-redesign` | **Date**: 2026-09-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-mbj-dark-navy-redesign/spec.md`

## Summary

Substituir o tema claro atual por um tema Dark Navy único, aplicado a partir de um conjunto central
de tokens, trocar a marca por um escudo vetorial oficial em todas as superfícies (tela, favicon,
ícones da PWA e manifesto) e reorganizar a navegação autenticada em três regiões fixas — identidade
no topo, links no corpo rolável, perfil e "Sair" no rodapé — com gaveta sobreposta abaixo de 768px.

A Landing Page recebe tratamento próprio: a referência `Sugestão nova interface e tema mbj.png` é
**normativa** para sua composição, e o clima do hero é recriado por meios do projeto — gradiente base,
iluminação radial simulando refletores, vinheta e textura sutil — sem fotografia de terceiros.

A abordagem técnica é deliberadamente conservadora: **nenhuma dependência nova**. Os tokens continuam
em variáveis CSS consumidas pelo Tailwind v4 via `@theme inline`; a gaveta usa o elemento nativo
`<dialog>` com `showModal()`, que entrega foco contido, fechamento por Esc, retorno de foco e véu
(`::backdrop`) sem biblioteca; os ícones PNG são rasterizados a partir do SVG por um script que usa o
Playwright já presente como dependência de desenvolvimento. A verificação de consistência é
automatizada em duas camadas — varredura estática de utilitários de cor fora do sistema de tokens e
auditoria de acessibilidade e de paleta nas 28 rotas.

Toda a mudança fica na camada de apresentação. Rotas, guardas, papéis, serviços, chaves de query,
políticas RLS e migrações permanecem intocados.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), React 19.2, Node 24 (`>=24 <25`)

**Primary Dependencies**: Tailwind CSS 4.3 (via `@tailwindcss/vite`), React Router 7.18, TanStack
Query 5, `lucide-react` 1.34, `vite-plugin-pwa` 1.3, Vite 8. **Nenhuma dependência nova é
adicionada por esta feature.**

**Storage**: N/A — a feature não lê nem escreve dados. Supabase permanece intocado.

**Testing**: Vitest 4 + Testing Library (unidade/integração, ambiente jsdom), Playwright 1.62 com
`@axe-core/playwright` 4.13 (ponta a ponta e acessibilidade), projetos `desktop-chromium` e
`mobile-chromium` (Pixel 7)

**Target Platform**: PWA web responsiva, navegadores perene-atuais em desktop e mobile. Instalável
via manifesto. **React Native e Expo estão fora de escopo** (Constituição, Princípio III).

**Project Type**: Aplicação web de página única, monolito modular por feature, projeto único

**Performance Goals**: Sem regressão nos limites já verificados em `tests/e2e/performance.spec.ts`.
Orçamento de peso da marca: escudo vetorial ≤ 20 KB, cada PNG de ícone ≤ 40 KB, textura condicional
do hero ≤ 30 KB, carga total de assets de marca ≤ 180 KB — contra os 1,6 MB do arquivo de origem, que
não é publicado. A composição do hero é feita por CSS e não adiciona peso de imagem no caso comum.

**Constraints**: WCAG AA obrigatório — contraste ≥ 4,5:1 em texto, ≥ 3:1 em limites de controle,
indicadores de foco e objetos gráficos informativos (FR-042), alvos de toque ≥ 44x44; luminância de
qualquer região do hero sob texto ≤ 0,030, para que o contraste sobre gradiente tenha pior caso
calculável (FR-041); corte responsivo binário em 768px; interface em pt-BR e código em inglês;
escrita offline permanece desabilitada; nenhuma cor declarada fora do conjunto de tokens.

**Scale/Scope**: 28 rotas e 15 superfícies transversais catalogadas na spec; 3 papéis (`ATHLETE`,
`COACH`, `PRESIDENT`); 10 destinos de navegação; 7 elementos de composição da Landing Page aferidos
contra a referência normativa; ~50 arquivos de origem tocados, todos de apresentação.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Antes da Fase 0

| Princípio | Portão | Veredito |
|---|---|---|
| I. Segurança imposta pelo servidor | A feature altera autorização, RLS, auditoria ou exposição de segredos? | **PASS** — nenhuma alteração. FR-027 e FR-028 proíbem explicitamente. O nome do usuário exibido no rodapé já está na sessão do próprio usuário; não há nova exposição de dado pessoal. |
| II. Integridade de domínio e história | A feature altera invariantes, migrações ou cálculos de domínio? | **PASS** — nenhuma alteração. Sem migrações, sem SQL, sem lógica de elegibilidade. |
| III. Simplicidade e escopo controlado do MVP | Introduz dependência, abstração ou infraestrutura nova? | **PASS** — zero dependências novas (ver Fase 0, decisões D-02 e D-04). A feature é exatamente a "customização estética White-Label por configuração centralizada" prevista no `TECH_STACK.md`. React Native/Expo removidos do escopo. |
| IV. Portões automatizados de qualidade | Formatação, lint, typecheck, testes e build passam? Acessibilidade WCAG AA? | **PASS** — a feature *amplia* a cobertura: a auditoria de acessibilidade sai de 2 rotas públicas para as 28 catalogadas (FR-008a). Contraste verificado por cálculo na spec. |
| V. Resiliência, privacidade e operabilidade | Degrada o offline, vaza dado pessoal em log, ou quebra a operação? | **PASS** — offline permanece somente leitura; nenhum log novo; nenhum dado pessoal adicional. |

**Restrições de produto**: interface em pt-BR mantida (nenhum texto alterado, FR-008); código e
identificadores em inglês; datas intocadas; `shadcn/ui` permanece como padrão de composição
copy-in — nenhum componente novo é instalado, portanto nenhuma dependência Radix entra no projeto.

**Resultado: PASS. Nenhuma violação. A tabela de Complexity Tracking permanece vazia.**

### Depois da Fase 1 (reavaliação)

Reavaliado após a produção de `research.md`, `data-model.md`, `contracts/` e `quickstart.md`:

- Nenhuma decisão de design introduziu dependência, serviço, abstração ou arquivo de configuração
  novo além dos artefatos de marca e de um script de geração de ícones que usa ferramenta já
  instalada.
- A decisão de usar `<dialog>` nativo (D-02) removeu a única pressão real por biblioteca nova.
- A decisão de rasterizar ícones com o Playwright existente (D-04) removeu a segunda.
- A verificação de paleta (D-06) é um teste, não um mecanismo de produção — não adiciona peso ao
  bundle nem complexidade de runtime. O mesmo vale para a camada 2b, que calcula o contraste do hero a
  partir dos stops declarados, sem decodificar imagem e sem dependência nova.
- O único ponto que amplia superfície de código é a paridade entre `src/index.css` e
  `clubConfig.theme` (D-01), resolvida com um teste de guarda em arquivo de teste já existente, e
  não com uma camada de sincronização em runtime.
- A fidelidade normativa da Landing Page (D-11, D-12) não introduz funcionalidade, rota ou texto: a
  segmentação do título preserva a cadeia exata e a faixa institucional consome apenas conteúdo já
  aprovado no config, o que mantém o Princípio III intacto.

**Resultado: PASS mantido. Complexity Tracking permanece vazia.**

## Project Structure

### Documentation (this feature)

```text
specs/002-mbj-dark-navy-redesign/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — decisões técnicas
├── data-model.md        # Fase 1 — tokens, assets e itens de navegação
├── quickstart.md        # Fase 1 — guia de validação executável
├── contracts/
│   ├── design-tokens.md        # Contrato do conjunto de tokens
│   ├── navigation-shell.md     # Contrato da casca de navegação
│   ├── brand-assets.md         # Contrato dos assets de marca e cache
│   ├── landing-composition.md  # Contrato de fidelidade da Landing Page
│   └── theme-verification.md   # Contrato do portão de verificação
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec (existente)
└── tasks.md             # Fase 2 — gerado por /speckit-tasks, NÃO por este comando
```

### Source Code (repository root)

Estrutura existente, sem novos diretórios de topo. Os caminhos abaixo são os efetivamente tocados:

```text
src/
├── index.css                              # Tokens do tema (fonte de verdade em runtime)
├── config/
│   └── club.config.ts                     # Espelho dos tokens + caminhos de marca
├── app/
│   └── layouts/
│       ├── AuthenticatedLayout.tsx        # Casca de navegação: reestruturação
│       ├── AuthenticatedLayout.test.tsx   # Asserções de navegação: atualização
│       └── navigation/                    # NOVO: subcomponentes da casca
│           ├── SidebarBrand.tsx
│           ├── NavigationList.tsx
│           ├── SidebarFooter.tsx
│           ├── MobileTopBar.tsx
│           └── NavigationDrawer.tsx
├── app/router/router.tsx                  # Só classes dos layouts público/auth; rotas intocadas
├── shared/components/feedback.tsx         # Estados, véu de modal, toast de sucesso
├── features/**/                           # Ajustes de classe nas superfícies catalogadas
└── features/offline/components/OfflineIndicator.tsx  # Remoção do âmbar fixo

public/
├── brand/                                 # Novos caminhos de marca (os antigos são removidos)
│   ├── mbj-shield.svg
│   ├── mbj-icon-192.png
│   ├── mbj-icon-512.png
│   ├── mbj-icon-maskable-512.png
│   └── hero-texture.png                   # Condicional: só se CSS não bastar
├── favicon.svg                            # Substituído pelo escudo vetorial
└── _headers                               # Regra de revalidação para /brand/*

scripts/
└── generate-brand-icons.mjs               # NOVO: rasteriza o SVG nos PNGs de ícone

tests/
├── e2e/
│   ├── accessibility.spec.ts              # Ampliação para 28 rotas
│   ├── theme-consistency.spec.ts          # NOVO: conformidade de paleta
│   ├── navigation-shell.spec.ts           # NOVO: gaveta, foco, fechamento
│   └── support/                           # NOVO: fixtures de autenticação mockada
│       ├── auth-mock.ts
│       └── route-catalog.ts
└── (demais specs e2e: apenas ajustes de seletor onde dependem da navegação)

index.html                                 # Favicon, apple-touch-icon, theme-color
vite.config.ts                             # Entradas de ícone e cores do manifesto
```

**Structure Decision**: mantida a organização existente — projeto único, monolito modular por feature
sob `src/features/`, casca de aplicação sob `src/app/`, primitivas compartilhadas sob `src/shared/`.
A única adição estrutural é `src/app/layouts/navigation/`, que decompõe a casca de navegação em
subcomponentes coesos em vez de inflar `AuthenticatedLayout.tsx`, e `tests/e2e/support/`, que extrai
o mock de autenticação hoje duplicado em cada spec de ponta a ponta.

## Complexity Tracking

> Preenchido apenas se o Constitution Check apresentar violações a justificar.

Nenhuma violação. Esta seção permanece intencionalmente vazia.
