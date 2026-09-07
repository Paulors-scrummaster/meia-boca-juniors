# Quickstart — Validação do Redesign Dark Navy

**Feature**: `002-mbj-dark-navy-redesign` | **Date**: 2026-09-06

Guia de validação executável. Prova que a feature funciona de ponta a ponta sem depender de leitura
de código. Não contém implementação — apenas o que rodar e o que esperar.

## Pré-requisitos

- Node 24 (`>=24 <25`) e dependências instaladas (`npm ci`)
- Navegadores do Playwright instalados (`npx playwright install chromium`)
- Nenhum Supabase local é necessário: as validações de interface usam o padrão de mock já vigente

## Portão completo

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

Critério: todos passam. Este é o mesmo portão exigido pela Constituição (Princípio IV) e é o mínimo
para a feature ser considerada pronta.

---

## Cenário 1 — Identidade Dark Navy consistente (User Story 1)

**Automatizado**

```bash
npx playwright test tests/e2e/theme-consistency.spec.ts
npx playwright test tests/e2e/accessibility.spec.ts
npm run test:unit -- src/config/club.config.test.ts
```

Esperado:
- Conformidade de paleta sem violações nas 24 rotas do catálogo.
- Auditoria de acessibilidade com zero violações nas 24 rotas, em desktop e mobile.
- Paridade de valores entre `src/index.css` e `clubConfig.theme` (regra V-02).

**Manual**

```bash
npm run dev
```

1. Abrir `http://127.0.0.1:5173/` — fundo azul navy profundo, escudo oficial, título bicolor,
   "Entrar no clube" preenchido em dourado e "Ativar convite" contornado. A conferência de composição
   completa é o Cenário 1b.
2. Percorrer `/login`, `/convite` e uma rota inexistente — nenhuma superfície clara remanescente.
3. Abrir as ferramentas do navegador e confirmar que a cor de fundo do `body` resolve para `#0A1325`.

Detalhes dos valores: [data-model.md](./data-model.md) seção 1.
Detalhes do portão: [contracts/theme-verification.md](./contracts/theme-verification.md).

---

## Cenário 1b — Fidelidade da Landing Page à referência normativa (User Story 1)

**Manual** — a fidelidade de composição não é verificável por ferramenta.

```bash
npm run dev
```

Abrir `http://127.0.0.1:5173/` em 1920x1080 e comparar lado a lado com
`Sugestão nova interface e tema mbj.png`, percorrendo a lista de sete itens de
[contracts/landing-composition.md](./contracts/landing-composition.md):

1. Hero com iluminação radial e vinheta, sem fotografia de terceiros
2. Escudo em marca d'água no lado direito
3. Título bicolor — "Bem-vindo ao" em branco, "Meia Boca Juniors" em dourado
4. Navegação pública com "Início" ativo em dourado
5. Cards em dois níveis de profundidade, com borda e ícone dourados
6. Botões no formato do mockup — dourado preenchido e contornado
7. Faixa institucional no rodapé, com régua dourada

Repetir em 1366x768 e conferir a degradação abaixo de 768px: coluna direita fluindo abaixo do hero,
marca d'água reduzida ou suprimida, sem rolagem horizontal.

**Automatizado**

```bash
npm run test:unit -- src/config/club.config.test.ts
git diff main -- src/config/club.config.ts
```

Esperado:
- A concatenação das duas partes do título reproduz exatamente o texto original (GL-05).
- O diff do config mostra **apenas** a segmentação do título; nenhuma cadeia de texto nova, nenhum
  slogan alterado (SC-012, GL-13).

**Contraste do hero — verificação reproduzível**

```bash
npx playwright test tests/e2e/theme-consistency.spec.ts -g "hero"
```

Esperado, contra o pior caso do gradiente (luminância 0,030, teto de FR-041):

| Texto | Razão exigida | Razão calculada |
|---|---|---|
| Primário | ≥ 4,5:1 | 13,1:1 |
| Secundário | ≥ 4,5:1 | 5,1:1 |
| Dourado | ≥ 4,5:1 | 6,6:1 |

**O axe não aprova o hero.** Sobre gradiente ele devolve *incomplete*, nunca *violation* — ausência de
erro na auditoria não é aprovação. A camada 2b é a autoridade aqui.

**Critério**: os sete itens presentes, todas as razões acima do limite, **e** a composição
reconhecível como a mesma proposta visual. Um item ausente ou uma razão abaixo do limite reprova.

---

## Cenário 2 — Barra lateral reorganizada no desktop (User Story 2)

**Automatizado**

```bash
npx playwright test tests/e2e/navigation-shell.spec.ts --project=desktop-chromium
npm run test:unit -- src/app/layouts/AuthenticatedLayout.test.tsx
```

Esperado:
- Ordem vertical topo → links → rodapé.
- Item da rota atual com `aria-current="page"`.
- Botão "Sair" presente no rodapé e distinguível dos links.
- Nenhuma faixa de cabeçalho renderizada acima de 768px.

**Manual**

1. Autenticar como Presidente (papel com mais itens: 10).
2. Em 1920x1080 e em 1366x768, confirmar que **todos** os itens ficam visíveis sem rolagem — este é
   o critério SC-004, e o Presidente é o pior caso.
3. Confirmar escudo e título no topo, nome do usuário e "Sair" fixos no rodapé.
4. Reduzir a altura da janela até forçar rolagem: apenas a lista central rola; topo e rodapé
   permanecem fixos.

Estrutura exigida: [contracts/navigation-shell.md](./contracts/navigation-shell.md).

---

## Cenário 3 — Gaveta mobile (User Story 3)

**Automatizado**

```bash
npx playwright test tests/e2e/navigation-shell.spec.ts --project=mobile-chromium
```

Esperado:
- Faixa superior com botão de menu presente abaixo de 768px; barra lateral ausente.
- Selecionar "Partidas" navega **e** fecha a gaveta.
- Esc fecha e devolve o foco ao botão de menu.
- Acionar o véu fecha.
- Com a gaveta fechada, nenhum elemento dela é alcançável por teclado.

**Manual**

1. Abrir em viewport de 360x640.
2. Abrir o menu, escolher "Partidas": a navegação ocorre e a gaveta fecha sozinha.
3. Reabrir a gaveta e redimensionar a janela para além de 768px: a gaveta fecha, a barra lateral
   aparece, e a página continua rolando normalmente (E-08).
4. Em altura muito reduzida, confirmar que topo e rodapé da gaveta permanecem visíveis (E-02).

---

## Cenário 4 — Cards e estados no tema escuro (User Story 4)

**Manual**

1. Em `/app/roster`, conferir cards com superfície azul distinguível do fundo, borda sutil, nome em
   branco e realce dourado no hover e no foco.
2. Localizar um atleta sem foto: as iniciais aparecem legíveis sobre a superfície de marca.
3. Simular perda de conexão nas ferramentas do navegador: o indicador de offline usa o token de
   atenção (laranja), **não** um bloco âmbar claro; os controles desabilitados permanecem
   perceptíveis.
4. Abrir um diálogo de confirmação: o véu é escuro, não branco (E-09).
5. Provocar um erro de validação em um formulário: o texto de erro usa o vermelho claro do tema e
   permanece legível.

---

## Cenário 5 — Marca e cache (User Story 1, edge cases E-01 e E-14)

**Automatizado**

```bash
node scripts/generate-brand-icons.mjs
git diff --stat public/brand
npm run build
```

Esperado:
- Regenerar os ícones a partir do mesmo SVG não produz diferença (processo determinístico, GA-01).
- Nenhum artefato excede seu orçamento de peso (SVG ≤ 20 KB, PNG de ícone ≤ 40 KB, textura condicional ≤ 30 KB, total ≤ 180 KB).

**Manual**

```bash
npm run preview
```

1. Confirmar que `/brand/logo.svg` e `/pwa-192x192.png` retornam 404 — nenhum caminho antigo responde
   (GA-07).
2. Conferir o favicon na aba do navegador: escudo oficial, legível em tamanho pequeno.
3. Abrir o manifesto e confirmar três entradas de ícone, `theme_color` e `background_color` em
   `#0A1325`.
4. Instalar a PWA e conferir o ícone do aplicativo, inclusive sob máscara circular: o contorno do
   escudo não é cortado (GA-03).

Contrato completo: [contracts/brand-assets.md](./contracts/brand-assets.md).

---

## Cenário 6 — Preservação do MVP (FR-027 a FR-031)

**Automatizado**

```bash
npm run test:unit
npm run test:e2e
git diff --stat main -- supabase/ src/features/**/api src/app/router/guards.tsx
```

Esperado:
- Toda a suíte passa.
- **Zero linhas alteradas** em `supabase/`, em qualquer arquivo `*.service.ts` e em
  `src/app/router/guards.tsx`. Qualquer diferença aí é violação de FR-027 e FR-028.
- Em `src/app/router/router.tsx`, as alterações se restringem às classes dos layouts público e de
  fluxo de autenticação e à troca de `Link` por `NavLink` na navegação pública para o estado ativo
  (T033); nenhuma alteração de caminho, guarda ou elemento de rota.

**Manual**

Percorrer um fluxo de escrita ponta a ponta — criar uma partida, convocar, responder presença — e
confirmar comportamento idêntico ao anterior, apenas revestido pelo novo tema.

---

## Resultado esperado

| Critério | Como se comprova |
|---|---|
| SC-001, SC-003, SC-003a, SC-003b | Cenário 1 (quatro camadas do portão) |
| SC-011, SC-012 | Cenário 1b (lista de sete itens + diff do config) |
| SC-013, SC-014 | Cenário 1b (camada 2b: luminância do hero e pares não textuais) |
| SC-002, SC-002a, SC-008 | Cenário 5 |
| SC-004 | Cenário 2, passo manual 2 |
| SC-005, SC-009, SC-010 | Cenário 3 |
| SC-006, SC-007 | Cenário 6 |
