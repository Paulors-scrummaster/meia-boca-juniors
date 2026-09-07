# Feature Specification: Redesign Visual Dark Navy e Refinamento da Navegação (MBJ)

**Feature Branch**: `feature/mbj-ui-redesign-dark-navy`

**Created**: 2026-09-06

**Status**: Draft

**Input**: Discovery "UI Redesign & Navigation Refinement (MBJ)" — substituir o tema claro genérico
por um tema Dark Navy esportivo (Azul Navy, Azul MBJ e Dourado), aplicar o escudo oficial em todas as
superfícies de marca e reorganizar a navegação lateral (topo de marca, corpo de links, rodapé de
perfil e saída), com gaveta lateral no mobile.

## Clarifications

### Session 2026-09-06

- Q: O discovery lista "Escalação" como item de menu, mas a aplicação não possui tela de escalação de
  nível superior — escalações existem apenas no contexto de uma partida. Como tratar? → A: Omitir
  "Escalação" do menu. Escalações continuam acessíveis pelo detalhe da partida, como hoje; nenhuma
  tela nova é criada.
- Q: O mobile usa hoje uma barra de abas fixa no rodapé, e o discovery pede menu hambúrguer com
  gaveta lateral. Substituir ou combinar? → A: Substituir a barra de abas pela gaveta lateral, de
  modo que a hierarquia de navegação seja única em todas as larguras.
- Q: O discovery omite cinco destinos que hoje existem no menu (Notificações, Área do atleta, Craque
  do Jogo, Comissão técnica, Administração). O que fazer com eles? → A: Manter todos, preservando as
  regras de visibilidade por papel vigentes; a lista do discovery é ilustrativa do bloco comum, não
  exaustiva.

### Session 2026-09-06 (clarificação pré-planejamento)

- Q: Quais valores de cor o tema Dark Navy deve usar para os estados semânticos de feedback e para o
  véu de modal, já que a paleta aprovada não os define e o `destructive` atual reprova em contraste
  sobre o navy? → A: Adicionar quatro tokens de estado em variante clara — sucesso `#34D399`,
  atenção `#FB923C`, erro `#F87171` e informação `#60A5FA` — cada um com superfície e borda derivadas
  por opacidade, substituindo o token destrutivo atual e eliminando as cores utilitárias fixas; véu
  de modal em preto a 60%.
- Q: Como o escudo oficial deve ser produzido a partir do arquivo de origem e com quais variantes
  para tela, favicon e ícones da PWA? → A: Redesenhar como vetor fiel ao original, com fundo
  transparente, usado em tela e favicon; a partir dele gerar os PNGs de ícone da PWA (192px e 512px)
  e um ícone maskable separado, com o escudo reduzido dentro da zona de segurança sobre fundo navy. O
  PNG de origem não é publicado.
- Q: Em resolução desktop, deve existir uma barra de cabeçalho no topo da área de conteúdo, ou a
  identidade do clube fica apenas no topo da barra lateral? → A: Sem cabeçalho no desktop; a
  identidade fica no topo da barra lateral e o conteúdo ocupa toda a altura. Abaixo de 768px surge
  uma faixa superior enxuta com botão de menu, escudo e nome do clube, e a gaveta abre sobreposta ao
  conteúdo, com véu, sem empurrar a página.
- Q: Como a consistência do tema e o contraste nas 24 rotas devem ser comprovados antes de a feature
  ser considerada pronta? → A: Auditoria automatizada de acessibilidade nas 24 rotas com os três
  papéis, mais uma verificação de que nenhum elemento renderiza fora da paleta de tokens,
  complementadas por conferência visual dirigida das telas de maior densidade (escalação,
  consolidação de estatísticas e painel de presenças).
- Q: Como garantir que os novos arquivos de marca cheguem a quem já tem a versão anterior instalada,
  sem pedir limpeza de cache? → A: Publicar os assets de marca em caminhos novos e distintos dos
  atuais, removendo os arquivos antigos, e acrescentar regra explícita de revalidação de cache para o
  diretório de marca; o manifesto e o documento HTML raiz, já sem cache, passam a apontar para os
  novos caminhos.

---

## Correções de Premissa Validadas no Repositório *(obrigatório ler antes de planejar)*

O material de discovery declarava `Target Platform: React Native (Expo) / Web App (PWA)`. A validação
do repositório contradiz parcialmente essa declaração:

| Item do discovery | Situação real no repositório | Decisão adotada nesta spec |
|---|---|---|
| React Native / Expo | **Não existe.** Não há dependências, configuração ou código React Native/Expo. | Removido do escopo. A feature é exclusivamente a PWA web responsiva. |
| Plataforma-alvo | React 19 + Vite + Tailwind CSS v4 + React Router v7 + `vite-plugin-pwa`, servida como PWA instalável. | Plataforma-alvo é a PWA web existente, sem mudança de runtime. |
| `logo mbj 2.png` "em alta resolução com transparência" | Arquivo existe na raiz (≈1,6 MB, escudo dourado/azul com estrelas e letras "MBJ") mas **possui fundo branco opaco**, não transparência. | A transparência precisa ser produzida no processamento do asset; ver Suposição A-04. |
| `Sugestão nova interface e tema mbj.png` | Existe na raiz. É uma captura conceitual da Landing Page com hero de estádio, escudo grande, cards azuis com borda dourada e CTAs dourado/contornado. | Mantida como referência visual (SSOT) para tom, hierarquia e tratamento de superfícies. |
| `logo mbj 1.jpg` | Existe na raiz (≈37 KB), versão de referência inicial e de menor resolução. | Referência histórica apenas; não é fonte para geração de assets. |
| Item de navegação "Escalação" | **Não existe rota de nível superior para escalação.** Escalações são acessíveis apenas no contexto de uma partida. | Omitido do menu (FR-014a). Nenhuma tela nova é criada. |
| Lista de 6 itens de menu do discovery | O menu atual tem 6 itens comuns **mais 4 condicionais por papel** (Notificações, Área do atleta, Craque do Jogo, Comissão técnica, Administração). | Todos preservados com suas regras de visibilidade (FR-014). |
| Menu hambúrguer no mobile | O mobile usa hoje **barra de abas fixa no rodapé** com rolagem horizontal. | Substituída pela gaveta lateral (FR-021a). |

A **Constituição do projeto (Princípio III)** determina explicitamente que aplicações nativas
Android/iOS estão fora de escopo e que a entrega é "uma PWA React responsiva, mobile-first". A
remoção de React Native/Expo desta spec é, portanto, obrigatória e não opcional.

---

## Restrição Central da Feature *(não negociável)*

Esta feature é **estritamente uma refatoração da camada de apresentação**. São permitidas alterações
apenas em: tokens de tema, folhas de estilo, classes utilitárias, composição e estrutura de layout de
navegação, **composição visual e apresentacional da Landing Page**, arquivos de marca (logo, favicon,
ícones PWA, manifesto) e metadados visuais.

**Exceção controlada — Landing Page.** Porque FR-032 torna a referência normativa, estão
explicitamente permitidas na Landing Page:

- segmentação visual do título, sem alterar o texto renderizado;
- escudo em marca d'água;
- composição do hero;
- gradientes, iluminação, vinheta e textura;
- diferença visual de profundidade entre os cards;
- estado ativo da navegação pública, sobre as rotas já existentes;
- ajuste de raio, borda e proporção dos botões;
- composição institucional derivada apenas de conteúdo já existente na configuração.

A exceção é **estritamente apresentacional**: ela autoriza mudar como as coisas aparecem, nunca o que
a aplicação faz. Nenhuma funcionalidade nova pode ser introduzida sob esta exceção.

São **proibidas** nesta feature:

- Alteração, criação ou remoção de rotas, caminhos de URL ou parâmetros de rota.
- Alteração de guardas de rota, papéis (`ATHLETE`, `COACH`, `PRESIDENT`), exigência de AAL2/MFA ou
  qualquer regra de permissão.
- Alteração de contratos de API, serviços, chaves de query, mutações, políticas RLS, migrações ou
  qualquer estrutura de dados do Supabase.
- Alteração de regras de negócio, validações de formulário, textos de erro de domínio ou máquinas de
  estado (convocação, presença, escalação, consolidação, votação).
- Criação de telas, funcionalidades ou destinos de navegação que não existam hoje.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Identidade Dark Navy consistente em toda a aplicação (Priority: P1)

Qualquer pessoa que abra o MBJ — visitante na Landing Page, atleta autenticado, técnico ou presidente
— encontra a mesma identidade visual: fundo azul navy profundo, superfícies de card em azul
secundário, acentos e chamadas para ação em dourado, texto branco de alta legibilidade e o escudo
oficial do clube. Não há mais telas remanescentes no tema claro anterior, nem mistura de temas entre
áreas públicas e privadas.

**Why this priority**: É a fundação da feature. Sem os tokens e os assets substituídos, nenhuma outra
história tem sobre o que se apoiar, e um tema aplicado pela metade é visivelmente pior do que o tema
claro atual e coerente.

**Independent Test**: Percorrer a lista completa de rotas catalogada na seção "Superfícies Impactadas"
com cada papel e confirmar, em cada uma, fundo navy, superfícies e bordas corretas, escudo oficial e
ausência de qualquer superfície clara herdada. Entrega valor mesmo sem as histórias 2 e 3.

**Acceptance Scenarios**:

1. **Given** um visitante não autenticado, **When** ele abre a Landing Page, **Then** a página exibe
   fundo azul navy profundo, o escudo oficial do MBJ, títulos em branco com destaque dourado e os
   botões "Entrar no clube" (preenchido em dourado) e "Ativar convite" (contornado), coerentes com a
   referência visual do projeto.
2. **Given** um atleta autenticado, **When** ele navega por qualquer tela da área `/app`, **Then**
   todas as superfícies usam o tema Dark Navy, sem nenhuma área de fundo claro residual.
3. **Given** qualquer tela da aplicação, **When** o contraste entre texto primário/secundário e seu
   fundo é medido, **Then** a razão é de no mínimo 4,5:1.
4. **Given** um usuário que já havia instalado a PWA com a marca anterior, **When** ele abre o app
   após a atualização, **Then** o ícone do aplicativo, o favicon e o escudo exibido dentro do app são
   o escudo oficial atual, sem resíduo do escudo anterior.
5. **Given** a Landing Page renderizada em 1920x1080, **When** ela é comparada lado a lado com a
   referência do projeto, **Then** os sete elementos de composição estão presentes — hero com
   iluminação e vinheta, escudo em marca d'água, título bicolor, navegação com rota ativa, cards em
   dois níveis, botões no formato do mockup e faixa institucional — e a composição é reconhecível como
   a mesma proposta visual.

---

### User Story 2 - Navegação lateral reorganizada no desktop (Priority: P1)

Em resolução desktop, o usuário autenticado vê uma barra lateral única e coerente: a identidade do
clube fixa no topo (escudo + "MBJ — Área do clube"), imediatamente abaixo a lista completa dos links
de navegação a que ele tem direito, sem lacunas ou espaços vazios injustificados, e fixados no rodapé
a identificação do seu perfil e o botão "Sair", visualmente distinto para evitar acionamento
acidental.

**Why this priority**: Corrige o problema ergonômico concreto relatado — hoje o botão "Sair" fica no
topo, colado à identidade do clube, e a lista de links fica separada dele em outra região do grid, o
que desperdiça a primeira dobra e aproxima perigosamente a saída da marca.

**Independent Test**: Autenticar com cada papel em 1920x1080 e 1366x768 e verificar a ordem topo →
links → rodapé, a ausência de rolagem para alcançar qualquer link, e o posicionamento e a distinção
visual do botão "Sair".

**Acceptance Scenarios**:

1. **Given** um atleta autenticado em resolução desktop, **When** ele acessa `/app/roster`, **Then**
   a barra lateral apresenta, de cima para baixo: escudo oficial e título do clube; os links de
   navegação; e, fixados no rodapé, o nome do usuário e o botão "Sair".
2. **Given** um presidente autenticado em 1366x768, **When** a barra lateral é renderizada, **Then**
   todos os links a que ele tem direito estão visíveis sem rolagem da página.
3. **Given** um usuário em qualquer rota autenticada, **When** ele observa o botão "Sair", **Then**
   o botão é visualmente distinguível dos links de navegação por cor ou contorno próprio.
4. **Given** um usuário na rota atual, **When** ele observa a barra lateral, **Then** o link
   correspondente à rota atual está destacado como ativo e anunciado como página atual para
   tecnologias assistivas.

---

### User Story 3 - Navegação mobile com gaveta lateral (Priority: P2)

Em telas estreitas, o usuário aciona um botão de menu no cabeçalho, uma gaveta lateral abre no tema
Dark Navy com exatamente a mesma hierarquia da barra lateral desktop, e ao escolher qualquer destino
a gaveta se fecha automaticamente junto com a navegação.

**Why this priority**: Depende dos tokens (P1) e da hierarquia definida na história 2, e substitui um
padrão de navegação que hoje já funciona — portanto entrega ganho ergonômico, não capacidade nova.

**Independent Test**: Em viewport abaixo de 768px, abrir o menu, navegar para "Partidas" e confirmar
o fechamento automático da gaveta, o foco correto e a possibilidade de fechar por Esc e pelo fundo.

**Acceptance Scenarios**:

1. **Given** um atleta em viewport de largura inferior a 768px, **When** a tela carrega, **Then** um
   botão de menu está presente no cabeçalho superior e a navegação não ocupa permanentemente a área
   de conteúdo.
2. **Given** a gaveta fechada, **When** o usuário aciona o botão de menu, **Then** a gaveta abre no
   tema Dark Navy com a mesma ordem topo/links/rodapé da barra lateral desktop.
3. **Given** a gaveta aberta, **When** o usuário toca em "Partidas", **Then** o sistema navega para a
   listagem de partidas e fecha a gaveta automaticamente.
4. **Given** a gaveta aberta, **When** o usuário pressiona Esc ou aciona a área externa, **Then** a
   gaveta fecha e o foco retorna ao botão de menu.
5. **Given** um dispositivo com altura de tela muito reduzida, **When** a gaveta é aberta, **Then** o
   bloco de identidade no topo e o bloco de perfil/"Sair" no rodapé permanecem visíveis, e apenas a
   lista de links rola internamente.

---

### User Story 4 - Cards de conteúdo legíveis no tema escuro (Priority: P2)

Ao percorrer elenco, partidas, escalações publicadas, estatísticas e mural, o usuário vê cards com
superfície azul tom sobre tom, borda sutil, realce dourado nos estados ativo/hover/foco, texto branco
e, quando o atleta não possui foto, iniciais legíveis sobre a superfície de marca.

**Why this priority**: É a aplicação concreta dos tokens nos componentes de maior volume da
aplicação; melhora percebida alta, mas depende inteiramente da história 1.

**Independent Test**: Abrir `/app/roster`, `/app/matches` e `/app/notices` e inspecionar as
superfícies, bordas, estados de interação e o avatar de fallback por iniciais.

**Acceptance Scenarios**:

1. **Given** um usuário na listagem de elenco, **When** ele visualiza os cards de atleta, **Then** os
   cards usam superfície azul escura distinguível do fundo da página, borda sutil e nome em texto
   branco.
2. **Given** um card interativo, **When** o usuário passa o ponteiro ou o move o foco por teclado
   para ele, **Then** o card apresenta elevação e/ou realce dourado perceptível, com indicador de
   foco visível.
3. **Given** um atleta sem foto cadastrada, **When** seu card é exibido, **Then** as iniciais aparecem
   sobre a superfície de marca com contraste suficiente para leitura.
4. **Given** um controle desabilitado (por exemplo, escrita bloqueada em modo offline), **When** ele
   é exibido no tema escuro, **Then** permanece perceptível contra o fundo, claramente identificável
   como inativo e sem desaparecer visualmente.

---

### Edge Cases

- **E-01 — Cache de marca**: navegador ou service worker da PWA retendo o escudo, o favicon ou o ícone
  do aplicativo anteriores. Os assets de marca ficam no diretório público, não recebem hash automático
  do build e hoje não têm regra própria de cache; a troca de caminho e a regra de revalidação impedem
  que uma cópia antiga continue a ser servida.
- **E-02 — Altura de tela muito reduzida**: a região central de links precisa rolar internamente,
  mantendo topo e rodapé da navegação sempre visíveis e fixos.
- **E-03 — Elementos desabilitados**: no tema escuro, controles inativos precisam permanecer
  perceptíveis (tonalidade navy/cinza atenuada), sem sumir contra o fundo.
- **E-04 — Papel com muitos itens**: um presidente vê o maior número de links; a barra lateral precisa
  acomodá-los na primeira dobra em 1366x768 sem apertar os alvos de toque abaixo do mínimo acessível.
- **E-05 — Escudo sobre fundo navy**: o arquivo de origem do escudo tem fundo branco opaco; aplicado
  sem tratamento, produziria um retângulo branco sobre o tema escuro em toda superfície de marca.
- **E-06 — Modo offline**: o indicador de offline, o aviso de escrita bloqueada e o banner de ações
  pendentes precisam permanecer legíveis e distinguíveis no tema escuro.
- **E-07 — Transição de tema**: enquanto os tokens não estiverem aplicados a uma superfície, ela
  aparece clara dentro de um app escuro; a troca precisa ser completa, não incremental por tela em
  produção.
- **E-08 — Alternância de viewport**: ao redimensionar de mobile para desktop com a gaveta aberta, a
  aplicação não pode ficar com a gaveta e a barra lateral simultaneamente visíveis nem com o corpo da
  página travado sem rolagem.
- **E-15 — Marca d'água competindo com o conteúdo**: o escudo decorativo do hero pode reduzir a
  legibilidade do texto sobreposto se a opacidade for alta demais ou o posicionamento invadir a coluna
  de conteúdo.
- **E-16 — Título bicolor e integridade do texto**: segmentar o título em duas partes cria o risco de
  o texto exibido divergir do original; a concatenação precisa reproduzi-lo exatamente.
- **E-09 — Inversão do véu de modal**: o véu atrás dos diálogos deriva hoje da cor de texto primário;
  no tema escuro isso produziria um véu branco sobre a interface, invertendo a hierarquia visual.
- **E-10 — Cores utilitárias fixas**: superfícies declaradas fora dos tokens escapam ao sistema de
  tema. O âmbar do indicador de offline é um par de tema claro que ficaria luminoso demais sobre o
  navy; o verde do gramado, embora escuro, também está fora dos tokens e não acompanharia futuras
  mudanças de tema.
- **E-11 — Estado de sucesso sem representação**: a região de avisos já distingue os tons erro,
  informação e sucesso, mas sucesso e informação hoje renderizam como texto comum; no tema escuro isso
  deixa a confirmação de ação indistinguível de conteúdo neutro.
- **E-12 — Ícone recortado pelo sistema operacional**: o manifesto declara hoje o favicon como ícone
  maskable, mas o escudo ocupa a borda do quadro; sob o recorte aplicado pelo sistema, o contorno do
  escudo seria cortado.
- **E-13 — Detalhe fino em tamanho reduzido**: o escudo contém dezenas de estrelas pequenas que se
  tornam ilegíveis abaixo de 48px, exigindo simplificação controlada sem perda de identidade.
- **E-14 — Ícone do aplicativo já instalado**: um usuário com a PWA instalada mantém o ícone
  registrado pelo sistema operacional; a atualização depende de o manifesto apontar para um caminho de
  ícone diferente, o que a troca de caminho garante.

---

## Superfícies Impactadas *(catálogo de rotas e componentes existentes)*

Todas as entradas abaixo **já existem**. Nenhuma rota é criada, removida ou renomeada por esta
feature. A coluna "Impacto" descreve apenas a natureza da mudança de apresentação.

### Rotas públicas e de fluxo de autenticação

| Rota | Superfície | Impacto |
|---|---|---|
| `/` | Landing Page de boas-vindas | Composição normativa: hero com iluminação e vinheta, escudo em marca d'água, título bicolor, cards em dois níveis, botões do mockup e faixa institucional (FR-032 a FR-041) |
| `/login` | Entrar no clube | Tema + campos e botões |
| `/convite` | Ativar convite | Tema + campos e botões |
| `/alterar-senha` | Troca obrigatória de senha | Tema + campos e botões |
| `/mfa` | Verificação em duas etapas | Tema + campos, QR e códigos legíveis no escuro |
| `*` | Página não encontrada | Tema |

### Rotas autenticadas (dentro do layout com navegação)

| Rota | Superfície | Impacto |
|---|---|---|
| `/app` | Redirecionamento por papel | Tema (estado transitório) |
| `/app/roster` | Elenco | Tema + cards de atleta + avatar de fallback |
| `/app/roster/:athleteId` | Perfil do atleta | Tema + cards e dados |
| `/app/matches` | Partidas | Tema + cards de partida |
| `/app/matches/:matchId` | Detalhe da partida | Tema + cards, abas e ações |
| `/app/matches/:matchId/lineup` | Escalação publicada | Tema + campo, titulares e reservas |
| `/app/statistics` | Estatísticas / rankings da temporada | Tema + tabelas e destaques |
| `/app/notices` | Mural de avisos | Tema + cards de comunicado |
| `/app/notification-preferences` | Preferências de notificação | Tema + cartão de permissão |
| `/app/athlete` | Área do atleta | Tema |
| `/app/athlete/matches/:matchId/attendance` | Resposta de presença | Tema + botões de resposta e modal de recusa |
| `/app/athlete/mvp-voting` | Craque do Jogo | Tema + cards de candidato e contagem regressiva |
| `/app/staff` | Comissão técnica | Tema |
| `/app/staff/matches/new` | Nova partida | Tema + formulário |
| `/app/staff/matches/:matchId/edit` | Editar partida + convocação | Tema + formulário e gestão de convocados |
| `/app/staff/matches/:matchId/attendance` | Painel de presenças | Tema + painel e estados em tempo real |
| `/app/staff/matches/:matchId/lineup` | Editor de escalação | Tema + campo, seletor de formação e arrastar/soltar |
| `/app/admin` | Administração de papéis e convites | Tema + tabelas e formulários |
| `/app/admin/roster/new` | Novo atleta | Tema + formulário e upload de foto |
| `/app/admin/roster/:athleteId/edit` | Editar atleta | Tema + formulário e upload de foto |
| `/app/admin/matches/:matchId/statistics` | Consolidação de estatísticas | Tema + formulário e diálogo de reabertura |
| `/app/forbidden` | Acesso negado | Tema |

### Superfícies transversais (não são rotas)

| Superfície | Impacto |
|---|---|
| Layout público (navegação superior Início / Entrar / Ativar convite) | Tema + estado ativo em dourado com indicador (FR-036) |
| Layout de fluxo de autenticação | Tema |
| Layout autenticado (cabeçalho, navegação, área de conteúdo) | Reestruturação da navegação + tema |
| Tokens semânticos de tema (definição central) | Substituição integral dos valores |
| Configuração institucional do clube (identidade e caminhos de assets) | Atualização dos caminhos de marca |
| Estados de feedback compartilhados (carregando, vazio, erro) | Tema |
| Indicador de offline e aviso de escrita bloqueada | Tema |
| Banner de ações pendentes | Tema |
| Aviso de atualização da PWA | Tema |
| Avatar do atleta (foto e fallback por iniciais) | Tema + superfície de marca |
| Estilo base de campos de formulário | Tema |
| Documento HTML raiz (cor de tema, favicon, ícone Apple) | Marca + cor de tema |
| Manifesto e ícones da PWA | Marca + cores de tema e de fundo |
| Testes automatizados que verificam a navegação autenticada | Atualização para a nova estrutura |

---

## Requirements *(mandatory)*

### Requisitos Funcionais — Identidade Visual e Tema

- **FR-001**: O sistema DEVE aplicar o tema Dark Navy a 100% das superfícies catalogadas na seção
  "Superfícies Impactadas", públicas e privadas, sem qualquer superfície remanescente do tema claro
  anterior.
- **FR-002**: O sistema DEVE definir os valores de tema em um ponto central único de configuração, de
  modo que nenhuma superfície declare cores de marca fora desse conjunto de tokens.
- **FR-003**: O sistema DEVE usar a seguinte paleta como definição dos tokens visuais:
  | Papel | Valor | Uso |
  |---|---|---|
  | Fundo principal (canvas) | `#0A1325` | Fundo de página em todas as telas |
  | Superfície de card | `#111C35` | Cards, painéis, barra lateral e gaveta |
  | Superfície elevada / hover | `#1A2744` | Estado elevado, hover e linhas alternadas |
  | Superfície neutra recuada | `#16213C` | Superfícies internas e recuadas, distinta da elevada |
  | Borda e divisor | `#233558` | Bordas padrão, divisores e contornos de campo |
  | Borda de destaque | `#E6B014` | Bordas de estado ativo e de destaque |
  | Acento e CTA primário | `#E6B014` | Botões primários, links ativos, ícones de acento |
  | Acento claro | `#F3C623` | Hover de acento e gradientes de acento |
  | Texto primário | `#FFFFFF` | Títulos e conteúdo principal |
  | Texto secundário | `#94A3B8` | Texto de apoio, rótulos e metadados |
- **FR-003a**: O sistema DEVE definir tokens semânticos de estado em variante clara, adequados a
  fundo escuro, e usá-los como origem única para todo feedback de estado:
  | Papel | Valor | Uso |
  |---|---|---|
  | Sucesso | `#34D399` | Confirmações, conclusão de ação, avisos de sucesso |
  | Atenção | `#FB923C` | Alertas não bloqueantes, modo offline, pendências |
  | Erro / destrutivo | `#F87171` | Erros de validação, falhas e ações destrutivas |
  | Informação | `#60A5FA` | Mensagens neutras e informativas |
- **FR-003b**: Superfícies tênues e bordas DEVEM derivar por opacidade do mesmo token que
  representam, em vez de introduzir novos valores fixos de cor. A regra vale para **qualquer token do
  tema, de marca ou de estado** — a aplicação já usa esse padrão tanto com `destructive` quanto com
  `primary` e `secondary`. O conjunto de opacidades é **fechado e exato**: 10% para superfície, 40%
  para borda e 60% para véu. Nenhum outro valor de opacidade sobre cor de tema é permitido, porque a
  verificação automatizada de paleta depende de uma lista enumerável de valores resolvidos.
- **FR-003h**: Opacidade NÃO DEVE ser aplicada a cor de texto. Texto usa sempre o valor sólido do
  token. A atenuação de elementos inativos prevista em E-03 é opacidade do elemento inteiro, mecanismo
  distinto que não altera a cor computada e permanece permitida.
- **FR-003c**: Quando um token de estado for usado como preenchimento de botão ou selo, o texto sobre
  ele DEVE usar o azul navy do fundo principal, e não branco, para preservar o contraste mínimo.
- **FR-003d**: O token de estado "atenção" DEVE ser cromaticamente distinguível do dourado da marca,
  de modo que alerta e ação primária não sejam confundidos.
- **FR-003e**: O véu (scrim) exibido atrás de diálogos modais DEVE usar preto com opacidade
  aproximada de 60%, e NÃO DEVE derivar da cor de texto primário — que no tema escuro é branca e
  produziria um véu claro sobre a interface.
- **FR-003f**: O sistema NÃO DEVE conter cores de marca ou de estado declaradas fora do conjunto de
  tokens. Todas as ocorrências fixas hoje existentes — entre elas a superfície âmbar do indicador de
  offline, o verde do gramado e as marcações do campo nas telas de escalação, e o véu do modal de
  recusa — DEVEM passar a derivar de tokens do tema.
- **FR-003g**: A superfície clara do contêiner do QR Code na tela de verificação em duas etapas é
  exceção declarada a FR-003f e DEVE ser preservada. Um QR Code exige fundo claro com módulos
  escuros para ser lido por scanner; convertê-lo ao tema escuro inviabilizaria a inscrição no
  segundo fator. A exceção é limitada a esse contêiner e DEVE ser declarada explicitamente nas
  verificações automatizadas de paleta.
- **FR-004**: O sistema DEVE manter razão de contraste mínima de 4,5:1 entre texto primário e
  secundário e suas respectivas superfícies de fundo, e mínima de 3:1 para bordas e indicadores de
  estado que transmitam informação.
- **FR-005**: O sistema DEVE apresentar indicador de foco visível e com contraste suficiente em todos
  os controles interativos sobre o tema escuro.
- **FR-006**: Os cards de conteúdo (atleta, partida, escalação, comunicado, estatística) DEVEM usar
  superfície azul tom sobre tom distinguível do fundo da página, borda sutil no estado padrão e
  realce dourado nos estados ativo, hover e foco.
- **FR-007**: Elementos desabilitados DEVEM permanecer perceptíveis contra o fundo escuro, com
  atenuação que os identifique como inativos sem torná-los invisíveis.
- **FR-008**: O sistema DEVE preservar integralmente todo o conteúdo textual, rótulos, mensagens de
  domínio, estados e semântica acessível existentes; a mudança é apenas de apresentação. Segmentar uma
  cadeia de texto para fins de apresentação é permitido **desde que a cadeia renderizada permaneça
  idêntica** e isso seja comprovado por teste de igualdade (ver FR-035).
- **FR-008a**: A cobertura da auditoria automatizada de acessibilidade DEVE ser estendida das duas
  rotas públicas atuais para as 24 rotas catalogadas, exercidas com os três papéis. Essa ampliação de
  cobertura de teste é parte da entrega desta feature.

### Requisitos Funcionais — Assets de Marca

- **FR-009**: O sistema DEVE usar o escudo oficial derivado de `logo mbj 2.png` como imagem de marca
  padrão em todas as superfícies de marca: Landing Page, topo da barra lateral, topo da gaveta mobile,
  favicon, ícone da PWA e manifesto.
- **FR-009a**: O escudo DEVE ser produzido como desenho vetorial fiel ao original — contorno do
  escudo, campo azul, conjunto de estrelas e letras "MBJ" —, com fundo transparente, e é a
  representação usada nas superfícies de tela e no favicon.
- **FR-009b**: Os ícones da PWA DEVEM ser gerados a partir desse mesmo vetor, nos tamanhos de 192px e
  512px, garantindo uma única origem de verdade para a marca e evitando divergência entre
  representações.
- **FR-009c**: O manifesto DEVE declarar um ícone maskable dedicado, com o escudo reduzido dentro da
  zona de segurança e o restante do quadro preenchido com o azul navy, de modo que nenhum recorte do
  sistema operacional corte o contorno do escudo. O ícone maskable NÃO DEVE ser o mesmo arquivo usado
  como favicon.
- **FR-009d**: O arquivo de origem `logo mbj 2.png` NÃO DEVE ser publicado como asset da aplicação;
  ele permanece no repositório apenas como referência de design.
- **FR-009e**: O escudo DEVE permanecer legível em tamanhos reduzidos: em 32px o contorno e a
  silhueta devem ser identificáveis, admitindo-se simplificação do detalhe fino das estrelas desde que
  a composição e as proporções do original sejam preservadas.
- **FR-010**: O escudo aplicado nas superfícies do aplicativo DEVE ter fundo transparente, de forma a
  compor corretamente sobre o fundo azul navy sem moldura branca.
- **FR-011**: O sistema NÃO DEVE exibir, em nenhuma superfície, o escudo anterior nem a variante de
  referência inicial `logo mbj 1.jpg`.
- **FR-012**: A atualização dos assets de marca DEVE chegar aos clientes já instalados sem exigir
  limpeza manual de cache pelo usuário.
- **FR-012a**: Os assets de marca DEVEM ser publicados em caminhos novos e distintos dos atuais, e os
  arquivos de marca anteriores DEVEM ser removidos da publicação, de modo que nenhuma cópia
  armazenada em cache continue a ser servida.
- **FR-012b**: O diretório de assets de marca DEVE ter política de cache com revalidação explícita, e
  NÃO DEVE herdar a política de cache imutável aplicada à saída do build, garantindo que uma troca
  futura de marca no mesmo caminho também se propague.
- **FR-012c**: As referências aos assets de marca no documento HTML raiz e no manifesto DEVEM apontar
  para os novos caminhos. Ambos já são servidos sem cache, o que faz os novos ponteiros chegarem na
  primeira visita após a atualização.
- **FR-013**: A cor de tema declarada ao sistema operacional e ao navegador (barra de status, tela de
  abertura da PWA e fundo do manifesto) DEVE corresponder ao tema Dark Navy.

### Requisitos Funcionais — Navegação Desktop

- **FR-014**: A navegação DEVE conter exatamente os destinos já existentes na aplicação, respeitando
  as regras de visibilidade por papel vigentes. Nenhum destino novo pode ser criado e nenhum destino
  existente pode ser removido do alcance do usuário. O conjunto normativo é:

  | Ordem | Rótulo | Destino | Visibilidade |
  |---|---|---|---|
  | 1 | Início | `/app` | Todos os autenticados |
  | 2 | Elenco | `/app/roster` | Todos os autenticados |
  | 3 | Partidas | `/app/matches` | Todos os autenticados |
  | 4 | Estatísticas | `/app/statistics` | Todos os autenticados |
  | 5 | Mural | `/app/notices` | Todos os autenticados |
  | 6 | Notificações | `/app/notification-preferences` | Todos os autenticados |
  | 7 | Área do atleta | `/app/athlete` | Papel `ATHLETE` |
  | 8 | Craque do Jogo | `/app/athlete/mvp-voting` | Papel `ATHLETE` |
  | 9 | Comissão técnica | `/app/staff` | Papéis `COACH` ou `PRESIDENT` |
  | 10 | Administração | `/app/admin` | Papel `PRESIDENT` |

- **FR-014a**: A navegação NÃO DEVE exibir um item "Escalação" de nível superior. Escalações
  permanecem acessíveis exclusivamente pelo contexto da partida, como hoje, e a feature não cria tela
  ou destino de escalação.
- **FR-014b**: As condições de visibilidade por papel da tabela de FR-014 DEVEM permanecer idênticas
  às vigentes; a feature reordena e reveste a apresentação desses itens, sem alterar quem vê o quê.
- **FR-015**: Em resolução desktop, a barra lateral DEVE fixar no topo o escudo oficial e o título
  identificador do clube.
- **FR-015a**: Em resolução desktop, o sistema NÃO DEVE exibir barra de cabeçalho no topo da área de
  conteúdo. A identidade do clube aparece uma única vez, no topo da barra lateral, e a área de
  conteúdo ocupa toda a altura disponível.
- **FR-016**: A barra lateral DEVE posicionar todos os links de navegação imediatamente abaixo do
  bloco de identidade, sem lacunas ou regiões vazias injustificadas entre eles.
- **FR-017**: A barra lateral DEVE fixar no rodapé a identificação do perfil do usuário autenticado e
  o botão "Sair".
- **FR-018**: O botão "Sair" DEVE ter distinção visual clara em relação aos links de navegação, por
  cor ou contorno próprio, reduzindo o risco de acionamento acidental.
- **FR-019**: A barra lateral DEVE indicar visualmente e semanticamente qual destino corresponde à
  rota atual.
- **FR-020**: A região central de links DEVE rolar internamente quando o conteúdo exceder a altura
  disponível, mantendo o bloco de identidade e o bloco de perfil/saída sempre visíveis.

### Requisitos Funcionais — Navegação Mobile e Responsividade

- **FR-021**: Em telas de largura inferior a 768px, o sistema DEVE oferecer o acesso à navegação a
  partir de um botão de menu no cabeçalho superior, e não ocupar permanentemente a área de conteúdo.
- **FR-021a**: A barra de abas fixa no rodapé usada hoje no mobile DEVE ser substituída pela gaveta
  lateral. Os dois padrões não coexistem: em larguras inferiores a 768px a gaveta é o único mecanismo
  de navegação principal.
- **FR-021b**: Abaixo de 768px, o sistema DEVE exibir uma faixa superior enxuta contendo o botão de
  menu, o escudo e o nome do clube. Essa faixa NÃO DEVE ser exibida em larguras iguais ou superiores a
  768px, onde a barra lateral já cumpre essa função.
- **FR-021c**: A gaveta lateral DEVE abrir sobreposta ao conteúdo, acompanhada de um véu que escurece
  a área restante, e NÃO DEVE deslocar nem redimensionar o conteúdo da página.
- **FR-022**: A gaveta lateral mobile DEVE usar o tema Dark Navy e replicar a mesma hierarquia
  vertical da barra lateral desktop: identidade no topo, links no corpo, perfil e "Sair" no rodapé.
- **FR-023**: A gaveta lateral DEVE fechar automaticamente assim que o usuário acionar qualquer
  destino de navegação.
- **FR-024**: A gaveta lateral DEVE ser operável por teclado e leitor de tela: foco contido enquanto
  aberta, fechamento por Esc e retorno do foco ao controle que a abriu.
- **FR-025**: Todos os alvos de toque da navegação DEVEM manter área mínima de 44x44 pixels em
  qualquer largura de tela.
- **FR-026**: O sistema DEVE manter comportamento coerente ao alternar entre larguras mobile e
  desktop, sem exibir simultaneamente a gaveta e a barra lateral e sem deixar a rolagem da página
  bloqueada.

### Requisitos Funcionais — Fidelidade Visual da Landing Page

- **FR-032**: A referência `Sugestão nova interface e tema mbj.png` é normativa para a Landing Page. A
  composição implementada DEVE ser reconhecível como a mesma proposta visual da referência, e não
  apenas como uma tela que usa azul navy e dourado.
- **FR-033**: O hero DEVE ser composto por meios próprios do projeto: gradiente base em azul navy,
  iluminação radial simulando refletores, vinheta nas bordas e textura sutil. Fotografia de terceiros
  sem licença NÃO DEVE ser usada. Todos os tons da composição DEVEM derivar dos tokens do tema.
- **FR-034**: O hero DEVE exibir o escudo oficial em marca d'água no lado direito, em escala grande e
  opacidade reduzida, marcado como decorativo para tecnologias assistivas e sem prejudicar a
  legibilidade do conteúdo sobreposto.
- **FR-035**: O título principal da Landing Page DEVE ser apresentado em duas cores — a primeira parte
  em texto primário e o nome do clube em dourado. O **conteúdo textual permanece idêntico**; apenas a
  apresentação tipográfica é segmentada, e a concatenação das partes DEVE reproduzir exatamente o
  título atual.
- **FR-036**: A navegação pública superior DEVE destacar a rota ativa em dourado, com indicador
  visual, mantendo exatamente os destinos existentes. Nenhuma rota nova pode ser criada.
- **FR-037**: Os dois cards da coluna direita DEVEM reproduzir a diferença de profundidade da
  referência: o primeiro com superfície navy mais clara em gradiente, o segundo mais profundo, ambos
  com borda e ícone dourados. Textos, ordem e função permanecem inalterados.
- **FR-038**: Os botões da Landing Page DEVEM aproximar raio, borda e proporção do mockup, com a ação
  principal preenchida em dourado e a secundária contornada. Rótulos e comportamento permanecem
  inalterados.
- **FR-039**: O rodapé da Landing Page DEVE apresentar a faixa institucional da referência — nome do
  clube, régua dourada e texto institucional com espaçamento de letras. O conteúdo textual DEVE vir
  exclusivamente da configuração institucional já existente. **É proibido introduzir texto novo ou
  substituir o slogan oficial.** Caso não exista conteúdo aprovado equivalente para alguma região da
  faixa, essa região permanece puramente visual.
- **FR-040**: Proporções, espaçamentos e hierarquia da Landing Page — dimensão do escudo, escala
  tipográfica, largura da coluna direita e relação entre hero, título, chamadas para ação e cards —
  DEVEM corresponder visualmente à referência nas resoluções equivalentes.

- **FR-041**: Nenhuma região do hero situada sob texto DEVE ultrapassar luminância relativa de
  **0,030**, equivalente a aproximadamente 18% do dourado composto sobre o azul navy. O teto existe
  para tornar o contraste do hero calculável: sem ele, o gradiente não tem pior caso definido e o
  contraste do texto sobreposto não é verificável.
- **FR-042**: A exigência de 3:1 de FR-004 aplica-se a **limites de controle** (contorno de campo de
  formulário e de botão contornado), **indicadores de foco** e **objetos gráficos que transmitem
  informação** (marcações do campo, indicador de rota ativa). Divisores puramente decorativos estão
  fora dessa exigência. Todo par sujeito a 3:1 DEVE ter sua razão calculada e registrada.

### Requisitos Funcionais — Preservação do MVP

- **FR-027**: O sistema NÃO DEVE alterar rotas, caminhos de URL, parâmetros de rota, guardas de rota,
  regras de papel ou exigências de verificação em duas etapas.
- **FR-028**: O sistema NÃO DEVE alterar contratos de serviço, chaves de query, mutações, políticas de
  acesso, migrações ou estruturas de dados.
- **FR-029**: O sistema NÃO DEVE alterar regras de negócio, validações, elegibilidades, prazos ou
  máquinas de estado de nenhum fluxo.
- **FR-030**: Todos os fluxos validados na fase anterior — autenticação, convites, troca de senha,
  verificação em duas etapas, convocação, presença, escalação, consolidação de estatísticas, votação,
  avisos, notificações e consulta offline — DEVEM permanecer funcionalmente idênticos após o
  redesign.
- **FR-031**: As restrições de escrita em modo offline e a apresentação dos estados de conectividade
  DEVEM permanecer com o mesmo comportamento, apenas revestidas pelo novo tema.

### Key Entities

- **TokensDeTema**: conjunto nomeado e centralizado dos papéis visuais da aplicação, em duas famílias:
  (a) marca e superfície — fundo, superfície, superfície elevada, borda, borda de destaque, acento,
  acento claro, texto primário, texto secundário, foco e véu de modal; (b) estado semântico — sucesso,
  atenção, erro/destrutivo e informação, cada um com superfície e borda derivadas por opacidade. Cada
  papel possui exatamente um valor e é a única origem de cor permitida na aplicação.
- **AssetsDeMarca**: conjunto dos arquivos de identidade derivados de um único escudo vetorial —
  escudo para uso em tela, favicon, ícones da PWA de 192px e 512px, ícone maskable dedicado — mais as
  entradas de ícone do manifesto e os caminhos publicados por onde a aplicação os referencia.
- **ReferênciasVisuais**: arquivos locais do repositório usados como fonte da verdade de design:
  `Sugestão nova interface e tema mbj.png` (tema e composição), `logo mbj 2.png` (escudo oficial de
  origem) e `logo mbj 1.jpg` (referência histórica, não usada para geração).
- **ItemDeNavegação**: destino já existente exibido no menu, com rótulo, rota de destino, condição de
  visibilidade por papel e estado ativo. A feature reorganiza a apresentação desses itens; não altera
  seu conjunto nem suas condições.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das superfícies catalogadas exibem o tema Dark Navy; zero superfícies com fundo do
  tema claro anterior, comprovado pelo portão de verificação definido em SC-003a.
- **SC-002**: 100% dos pontos que exibem o escudo do clube apresentam o escudo oficial atual; zero
  ocorrências do escudo anterior ou da variante de referência inicial em qualquer superfície, arquivo
  de marca publicado ou entrada de manifesto.
- **SC-002a**: O ícone maskable declarado no manifesto mantém o escudo integralmente visível sob os
  recortes aplicados pelo sistema operacional, incluindo o recorte circular.
- **SC-003**: 100% dos pares texto/fundo primários e secundários atingem no mínimo 4,5:1, verificado
  por auditoria automatizada de acessibilidade.
- **SC-003a**: O portão de verificação do tema tem três partes, todas obrigatórias:
  1. **Auditoria automatizada**: a auditoria de acessibilidade cobre as 24 rotas catalogadas, exercidas
     com os três papéis, e reporta zero violações das regras WCAG A e AA — ampliando a cobertura atual,
     hoje limitada às duas rotas públicas.
  2. **Conformidade de paleta**: nenhum elemento renderizado apresenta cor de fundo, texto ou borda
     fora do conjunto de tokens definido em FR-003 e FR-003a, verificado automaticamente.
  3. **Conferência visual dirigida**: as telas de maior densidade visual — editor e escalação
     publicada, consolidação de estatísticas e painel de presenças — são conferidas visualmente contra
     a referência de tema do projeto.
- **SC-003b**: A auditoria automatizada roda também em largura mobile com a gaveta aberta, cobrindo os
  estados de foco contido e de véu.
- **SC-011**: Os sete elementos de composição da referência estão presentes na Landing Page em
  1920x1080: hero com iluminação e vinheta, escudo em marca d'água à direita, título bicolor,
  navegação com rota ativa em dourado, cards em dois níveis de profundidade, botões no formato do
  mockup e faixa institucional no rodapé. Aferido pela lista de conferência do contrato de
  composição.
- **SC-012**: Zero textos novos na Landing Page: 100% do conteúdo textual exibido provém da
  configuração institucional já existente, verificável por inspeção do diff.
- **SC-013**: As razões de contraste do texto do hero contra o **pior caso** do fundo em gradiente
  estão calculadas e registradas, e 100% delas atingem no mínimo 4,5:1. A aprovação do hero NÃO PODE
  decorrer apenas de a auditoria automatizada não ter encontrado erro.
- **SC-014**: 100% dos pares sujeitos a 3:1 por FR-042 atingem esse limite, com as razões calculadas e
  registradas.
- **SC-004**: Em 1920x1080 e em 1366x768, 100% dos itens de navegação disponíveis para o papel de
  maior alcance ficam visíveis na primeira dobra, sem rolagem.
- **SC-005**: Em viewport de 360x640, o usuário alcança qualquer destino de navegação em no máximo
  dois toques (abrir o menu e escolher o destino), e a gaveta fecha em 100% das seleções.
- **SC-006**: Zero regressões funcionais: a suíte automatizada existente de unidade, integração e
  ponta a ponta passa integralmente, com ajustes limitados a asserções de estrutura de navegação e de
  apresentação.
- **SC-007**: Zero alterações em rotas, guardas, papéis, contratos de serviço, políticas de acesso e
  migrações, verificável por inspeção do diff da entrega.
- **SC-008**: Um usuário com a versão anterior instalada passa a ver o escudo e o ícone atuais sem
  executar limpeza manual de cache, e nenhum caminho de asset de marca anterior continua acessível
  após a publicação.
- **SC-009**: 100% dos alvos de toque da navegação medem no mínimo 44x44 pixels em qualquer largura.
- **SC-010**: A navegação é integralmente operável por teclado e anuncia corretamente o destino atual
  e o estado aberto/fechado da gaveta.

---

## Assumptions

- **A-01**: A plataforma-alvo é exclusivamente a PWA web responsiva já existente. React Native e Expo
  foram removidos do escopo por não existirem no repositório e por serem explicitamente vedados pela
  Constituição do projeto.
- **A-02**: O tema Dark Navy é o tema único da aplicação. Não há alternância entre claro e escuro nem
  preferência de tema por usuário nesta feature.
- **A-03**: A referência `Sugestão nova interface e tema mbj.png` é **normativa para a Landing Page**:
  define composição, proporção, hierarquia e presença de elementos, não apenas paleta. Para as demais
  telas, permanece como direção visual de tom e tratamento de superfícies. Em nenhum caso a avaliação
  é por diferença de pixels: a fidelidade da landing é aferida pela lista de conferência de elementos
  e proporções definida em FR-032 a FR-040 e no contrato de composição.
- **A-04**: O escudo de origem possui fundo branco opaco. A produção dos assets de tela inclui remover
  esse fundo e gerar as variantes de tamanho necessárias a partir do mesmo original, mantendo a
  proporção e a legibilidade das letras "MBJ" em tamanhos pequenos.
- **A-05**: A identificação do usuário no rodapé da navegação usa o nome já disponível no perfil
  autenticado; nenhum dado novo é buscado, e nenhuma informação sensível adicional é exposta.
- **A-06**: O ponto de corte responsivo é 768px de largura, coerente com o corte já usado hoje na
  aplicação. O comportamento é binário nesse ponto: abaixo dele, faixa superior com gaveta; a partir
  dele, barra lateral permanente. Não há estado intermediário de barra lateral recolhida ou em modo
  somente ícones.
- **A-07**: A tipografia atual é mantida; a feature não introduz nova família tipográfica nem novas
  dependências de fonte.
- **A-08**: O clima do hero da referência é recriado por **composição própria do projeto** — gradiente
  base, iluminação radial simulando refletores, vinheta e textura sutil — sem depender de fotografia
  de terceiros. Imagem externa sem licença NÃO DEVE ser usada. Caso um asset raster próprio seja
  necessário para atingir a fidelidade, ele pode ser criado como ativo da feature, desde que
  otimizado e versionado no repositório.
- **A-09**: Atenuação de elementos desabilitados é permitida porque controles inativos estão fora da
  exigência de contraste mínimo da WCAG; ainda assim, FR-007 exige que permaneçam perceptíveis.
- **A-10**: Nenhuma dependência nova é adicionada ao projeto. A gaveta lateral é construída com os
  recursos já disponíveis na stack aprovada.
- **A-11**: As alterações de teste esperadas nesta feature são de duas categorias: atualizar as
  asserções que hoje afirmam a estrutura da navegação autenticada, incluindo as que dependem da barra
  de abas fixa no rodapé; e ampliar a cobertura da auditoria de acessibilidade para as 24 rotas.
  Nenhum teste de regra de negócio é alterado.
- **A-12**: O papel de maior alcance é `PRESIDENT`, com até 10 itens de navegação simultâneos. O
  dimensionamento da barra lateral e da gaveta usa esse número como pior caso para SC-004.
- **A-13**: O indicador de offline, o aviso de escrita bloqueada e o banner de ações pendentes
  permanecem no topo da área de conteúdo, como hoje, em todas as larguras; a introdução da faixa
  superior mobile não os desloca para o cabeçalho.

---

## Out of Scope

- Qualquer nova tela, rota, destino de navegação ou funcionalidade.
- Alternância de tema claro/escuro e preferência de tema por usuário.
- Aplicativo nativo Android ou iOS, React Native e Expo.
- Alterações em regras de negócio, permissões, contratos de API, RLS, migrações e estruturas de dados.
- Reescrita de conteúdo textual, rótulos de domínio e mensagens de erro.
- Redesign de fluxos, reordenação de etapas de formulário ou mudança de arquitetura de informação
  dentro das telas.
- Adoção de nova biblioteca de componentes, nova tipografia ou novo sistema de ícones.
- Otimização de desempenho, novas capacidades offline e mudanças em observabilidade.

---

## Anexo Informativo — Conversão da Paleta para o Formato de Token Vigente

O projeto define os tokens semânticos em componentes HSL. Os valores hexadecimais de FR-003
correspondem a:

| Papel | Hex | HSL |
|---|---|---|
| Fundo principal | `#0A1325` | `220 58% 9%` |
| Superfície de card | `#111C35` | `222 51% 14%` |
| Superfície elevada | `#1A2744` | `221 45% 18%` |
| Superfície neutra recuada | `#16213C` | `223 46% 16%` |
| Borda e divisor | `#233558` | `220 43% 24%` |
| Acento e CTA primário | `#E6B014` | `45 84% 49%` |
| Acento claro | `#F3C623` | `47 90% 55%` |
| Texto primário | `#FFFFFF` | `0 0% 100%` |
| Texto secundário | `#94A3B8` | `215 20% 65%` |
| Sucesso | `#34D399` | `158 64% 52%` |
| Atenção | `#FB923C` | `27 96% 61%` |
| Erro / destrutivo | `#F87171` | `0 91% 71%` |
| Informação | `#60A5FA` | `213 94% 68%` |

Razões de contraste calculadas para os principais pares:

| Par | Razão | WCAG AA |
|---|---|---|
| Texto primário sobre fundo principal | 18,7:1 | Passa |
| Texto secundário sobre fundo principal | 7,3:1 | Passa |
| Texto primário sobre superfície de card | 17,0:1 | Passa |
| Texto secundário sobre superfície de card | 6,7:1 | Passa |
| Acento dourado sobre fundo principal | 9,3:1 | Passa |
| Fundo principal como texto sobre CTA dourado | 9,3:1 | Passa |
| Sucesso sobre fundo principal | 9,7:1 | Passa |
| Atenção sobre fundo principal | 8,2:1 | Passa |
| Erro sobre fundo principal | 6,7:1 | Passa |
| Informação sobre fundo principal | 7,3:1 | Passa |
| Texto primário sobre superfície neutra recuada | 16,1:1 | Passa |
| Texto secundário sobre superfície neutra recuada | 6,3:1 | Passa |

O token destrutivo vigente (`0 72% 51%`) atinge apenas 4,0:1 sobre o fundo principal e por isso é
substituído pelo valor de erro acima.

### Contraste do texto sobre o hero em gradiente

O gradiente do hero clareia o fundo. O pior caso é o ponto de maior luminância sob texto, limitado por
FR-041 a 0,030. As razões abaixo são calculadas contra esse teto, não contra a cor base.

| Intensidade do brilho | Luminância do fundo | Texto primário | Texto secundário | Dourado |
|---|---|---|---|---|
| 0% (base navy) | 0,0063 | 18,7:1 | 7,3:1 | 9,3:1 |
| 10% | 0,0163 | 15,8:1 | 6,2:1 | 7,9:1 |
| **18% — teto de FR-041** | **0,030** | **13,1:1** | **5,1:1** | **6,6:1** |
| 22% | 0,038 | 11,9:1 | 4,7:1 | 6,0:1 |
| 25% | 0,043 | 11,3:1 | **4,4:1 — reprova** | 5,7:1 |

O texto secundário é o par que primeiro reprova, por volta de 23% de brilho. O teto de 18% preserva
margem sobre o limite de 4,5:1 em todos os três pares.

### Contraste de elementos não textuais (FR-042)

| Par | Razão | 3:1 |
|---|---|---|
| Contorno de campo `input` `#4C6BA9` sobre `card` | 3,2:1 | Passa |
| Contorno de campo `input` `#4C6BA9` sobre `background` | 3,5:1 | Passa |
| Anel de foco `ring` sobre `card` | 8,5:1 | Passa |
| Anel de foco `ring` sobre `background` | 9,3:1 | Passa |
| Marcação `pitch-line` sobre `pitch` | 6,8:1 | Passa |
| Divisor `border` sobre `card` | 1,4:1 | Isento — decorativo, fora de FR-042 |

**Correção registrada**: o valor originalmente previsto para `input` era `#233558`, idêntico ao
divisor, e atingia apenas **1,4:1** sobre o card — reprovando em WCAG 1.4.11 para limite de controle.
O fundo do próprio campo contra o card dava 1,1:1, de modo que nenhum outro elemento identificava a
borda do campo. O token `input` passa a `220 38% 48%` (`#4C6BA9`), desacoplando-se de `border`.

Esta seção é informativa e destina-se à fase de planejamento; não substitui os requisitos acima.
