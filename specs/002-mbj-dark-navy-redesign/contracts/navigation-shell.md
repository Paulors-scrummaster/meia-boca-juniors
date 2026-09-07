# Contract: Navigation Shell

**Feature**: `002-mbj-dark-navy-redesign`

Contrato de interface da casca de navegação autenticada (`AuthenticatedLayout` e seus subcomponentes).
Define estrutura, acessibilidade e comportamento responsivo que as rotas filhas herdam.

## Estrutura

Três regiões, na mesma ordem vertical em desktop e em mobile (FR-022):

```text
┌──────────────────────────────┐
│ TOPO (fixo)                  │  Escudo + "MBJ" + "Área do clube"
├──────────────────────────────┤
│ CORPO (cresce, rola)         │  Itens de navegação visíveis para o papel
│                              │  overflow-y: auto
├──────────────────────────────┤
│ RODAPÉ (fixo)                │  Nome do usuário + botão "Sair"
└──────────────────────────────┘
```

Topo e rodapé nunca rolam. Apenas o corpo rola, e apenas quando o conteúdo excede a altura (FR-020,
E-02).

## Contrato de acessibilidade

| Elemento | Requisito |
|---|---|
| Região de navegação | `<nav>` com `aria-label="Navegação principal"` (rótulo atual preservado) |
| Item da rota atual | `aria-current="page"` |
| Botão de menu mobile | Nome acessível estável; `aria-expanded` refletindo o estado da gaveta |
| Gaveta | `<dialog>` aberto com `showModal()`; rotulada pelo título do clube |
| Botão "Sair" | `<button type="button">`, distinto visualmente dos links (FR-018) |
| Link de pular para o conteúdo | Preservado como está, primeiro na ordem de tabulação |
| Alvos de toque | ≥ 44x44 px em qualquer largura (FR-025) |
| Foco | Anel `ring` visível em todos os controles (FR-005) |

## Contrato responsivo

Corte único e binário em **768px**. Não existe estado intermediário nem barra lateral recolhida
(A-06).

| Largura | Faixa superior | Barra lateral estática | Gaveta modal |
|---|---|---|---|
| `< 768px` | Presente (menu, escudo, nome do clube) | Ausente | Disponível |
| `>= 768px` | Ausente (FR-015a) | Presente | Nunca montada |

**Invariante estrutural**: a faixa superior e a barra lateral são mutuamente exclusivas; a gaveta e a
barra lateral nunca coexistem (E-08).

## Contrato de comportamento

| Evento | Resultado exigido |
|---|---|
| Acionar botão de menu | Gaveta abre; foco entra na gaveta; fundo torna-se inerte |
| Selecionar destino na gaveta | Navega **e** fecha a gaveta (FR-023) |
| Pressionar Esc com gaveta aberta | Gaveta fecha; foco retorna ao botão de menu |
| Acionar o véu | Gaveta fecha; foco retorna ao botão de menu |
| Redimensionar para ≥ 768px com gaveta aberta | Gaveta fecha; rolagem do corpo liberada |
| Acionar "Sair" | Comportamento de saída atual, inalterado; botão desabilitado durante a operação |

## Contrato com as rotas filhas

- **C-01**: as rotas filhas continuam recebendo `<Outlet />` dentro da mesma área de conteúdo
  principal, com `id="conteudo-principal"` preservado.
- **C-02**: o `<fieldset>` que desabilita escrita em modo offline permanece envolvendo o conteúdo,
  com o mesmo comportamento (FR-031).
- **C-03**: `OfflineIndicator`, `PendingActionsBanner` e o aviso de escrita bloqueada permanecem no
  topo da área de conteúdo em todas as larguras (A-13).
- **C-04**: nenhuma rota filha precisa saber se está em modo gaveta ou barra lateral.

## Obrigações preservadas

- **P-01**: o conjunto de itens e suas condições de visibilidade por papel são exatamente os vigentes
  (data-model, seção 3.2).
- **P-02**: nenhuma rota, guarda ou verificação de papel é alterada (FR-027).
- **P-03**: o texto de todos os rótulos permanece idêntico (FR-008).

## Mudanças em relação à estrutura anterior

| Antes | Depois |
|---|---|
| Botão "Sair" no topo, junto à marca | Botão "Sair" fixo no rodapé, com distinção visual |
| Sem identificação do usuário na navegação | Nome do usuário no rodapé, acima do "Sair" |
| Mobile: barra de abas fixa no rodapé com rolagem horizontal | Mobile: faixa superior com menu + gaveta sobreposta |
| Marca e lista de links em regiões separadas do grid | Marca, links e rodapé na mesma coluna contínua |
| Sem ícones nos itens | Ícones de `lucide-react` (biblioteca já em uso) |
