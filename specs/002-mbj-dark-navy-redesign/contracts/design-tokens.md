# Contract: Design Tokens

**Feature**: `002-mbj-dark-navy-redesign`

Contrato entre a definição central do tema e todo componente que pinta uma superfície. Consumidores
referenciam tokens por nome; nunca por valor.

## Superfície exposta

| Consumidor | Como consome |
|---|---|
| Componentes React | Utilitários Tailwind mapeados dos tokens (`bg-card`, `text-muted-foreground`, `border-destructive/40`) |
| CSS de camada de componente | `hsl(var(--token))` |
| Configuração White-Label | `clubConfig.theme[token]` |
| Verificação automatizada | Valores resolvidos lidos de `:root` em runtime |

## Nomes do contrato

Os nomes abaixo compõem `SEMANTIC_THEME_TOKENS`. Adicionar, remover ou renomear um nome é mudança de
contrato e exige atualizar `clubConfig.theme`, `src/index.css` e a lista de valores permitidos da
verificação de paleta na mesma entrega.

```text
background            foreground
card                  card-foreground
elevated
primary               primary-foreground
secondary             secondary-foreground
muted                 muted-foreground
accent                accent-foreground
border                input                 ring
overlay
success               success-foreground
warning               warning-foreground
destructive           destructive-foreground
info                  info-foreground
pitch                 pitch-foreground      pitch-line
```

Valores canônicos: ver [data-model.md](../data-model.md), seções 1.1 a 1.3.

## Garantias

- **G-01**: todo nome do contrato resolve para um valor em runtime; nenhum token fica indefinido.
- **G-02**: cada token tem um único valor. Não há variante clara/escura (tema único, A-02).
- **G-03**: o valor declarado em `clubConfig.theme` é idêntico ao declarado em `src/index.css`,
  verificado por teste (V-02).
- **G-04**: pares texto/superfície do contrato atingem no mínimo 4,5:1 (tabela 1.6 do data-model).
- **G-05**: derivações por opacidade são permitidas apenas em 10% (superfície), 40% (borda) e 60%
  (véu), sobre qualquer token do tema — de marca ou de estado. Qualquer outra opacidade de cor de
  tema é violação. Opacidade aplicada ao elemento inteiro (`opacity`) para atenuar controles
  inativos é mecanismo distinto e permanece permitida.
- **G-08**: `input` e `border` têm valores **deliberadamente distintos**. `border` é divisor
  decorativo e está isento de 3:1; `input` é limite de controle e precisa atingir 3:1 contra as
  superfícies em que aparece (FR-042). Igualá-los reintroduz uma falha de WCAG 1.4.11.
- **G-07**: gradientes DEVEM derivar todos os seus stops de tokens do tema. Por serem contínuos e
  aplicados como `background-image`, não entram na lista enumerável da camada 2 e não estão sujeitos
  ao conjunto fechado de opacidades; sua conformidade é verificada na conferência visual dirigida.
- **G-06**: `accent` e `ring` compartilham deliberadamente o valor de `primary`. `accent` existe por
  convenção do shadcn/ui e não tem uso atual no código; `ring` é o anel de foco dourado. Essa
  coincidência de valor é intencional e não deve ser tratada como duplicação a corrigir.

## Obrigações do consumidor

- **O-01**: não declarar cor literal em hexadecimal, `rgb()` ou `hsl()` fora dos dois arquivos de
  definição.
- **O-02**: não usar utilitário de cor da paleta padrão do Tailwind (`bg-white`, `text-black`,
  `bg-slate-*`, `bg-amber-*`, `text-emerald-*` e afins).
- **O-03**: usar valor sólido para texto de estado; derivações por opacidade servem apenas a
  superfície e borda.
- **O-04**: elementos desabilitados usam atenuação de opacidade sobre o token, permanecendo
  perceptíveis contra o fundo (FR-007).
- **O-05**: o véu de modal usa o token `overlay`, nunca uma derivação de `foreground`.

## Mudanças em relação ao contrato anterior

| Mudança | Natureza |
|---|---|
| Todos os 17 valores existentes trocados de tema claro para Dark Navy | Alteração de valor |
| `destructive` passa de `0 72% 51%` para `0 91% 71%` | Correção de contraste (4,0:1 reprovava) |
| Adicionados `elevated`, `overlay`, `success*`, `warning*`, `info*`, `pitch*` | Extensão de contrato |
| Nenhum nome removido | — |

Nenhum consumidor existente quebra: todos os nomes anteriores continuam válidos.
