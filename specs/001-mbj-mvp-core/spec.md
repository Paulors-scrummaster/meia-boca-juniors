# Feature Specification: MVP Oficial do Meia Boca Juniors

**Feature Branch**: `feature/mbj-mvp-core`

**Created**: 2026-08-25

**Status**: Approved

**Approved By**: Paulo Ricardo

**Approval Date**: 2026-08-25

**Input**: Plataforma oficial do MBJ para centralizar elenco, convites, partidas, convocações,
presenças, escalações, estatísticas, votação de Craque do Jogo, avisos, notificações e consulta
offline essencial.

## Clarifications

### Session 2026-08-25

- Q: Quando um usuário que também é Presidente ou Técnico tiver seu perfil de Atleta alterado para
  INATIVO, o que deve acontecer com o acesso dele? → A: Remover somente as permissões e elegibilidade
  de Atleta, preservando Presidente ou Técnico.
- Q: Se o Presidente descobrir um erro no placar, nos gols ou nas assistências depois da consolidação,
  como a correção deve funcionar? → A: O Presidente pode reabrir a partida; estatísticas anteriores,
  votos e prêmios são revertidos antes de corrigir e reconsolidar.
- Q: Quem pode visualizar a justificativa informada quando um atleta recusa uma convocação? → A:
  Somente o próprio atleta, Presidente e Técnico.
- Q: Quais atletas devem aparecer como candidatos ao Craque do Jogo depois que a partida for
  consolidada? → A: Somente titulares e reservas da escalação oficial vigente e vinculada no instante
  da consolidação.
- Q: Depois que uma consolidação é invalidada e a partida é reconsolidada, um atleta que votou antes
  pode votar novamente? → A: Sim. O limite é de um voto por atleta em cada rodada de votação válida;
  votos de rodadas invalidadas permanecem históricos e não bloqueiam a nova rodada.
- Q: Até qual momento Presidente ou Técnico podem alterar administrativamente a presença de um
  atleta? → A: Até a consolidação; depois, somente após o Presidente reabrir a partida.
- Q: Qual escalação define os candidatos ao Craque do Jogo se houver republicação posterior? → A: A
  revisão oficial vigente no instante da consolidação fica vinculada imutavelmente à consolidação.
- Q: Como interpretar os lembretes de presença de aproximadamente 24 e 6 horas? → A: O agendador
  executa a cada 5 minutos; cada lembrete pode ser emitido do instante-alvo até 10 minutos depois e é
  ignorado se a convocação nasceu após esse instante ou se essa janela foi perdida.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acesso seguro por convite e papéis (Priority: P1)

Como Presidente, quero convidar individualmente integrantes e atribuir seus papéis para que somente
pessoas autorizadas acessem as funções correspondentes às suas responsabilidades. Como convidado,
quero validar meus dados, criar minha conta e entrar com e-mail e senha.

**Why this priority**: Todo o restante do produto depende da identificação do usuário e da aplicação
correta das permissões de Presidente, Técnico e Atleta.

**Independent Test**: Pode ser testada cadastrando um atleta, emitindo o convite, concluindo a conta
e verificando que cada papel enxerga e executa somente as ações autorizadas.

**Acceptance Scenarios**:

1. **Given** um atleta pré-cadastrado e ainda sem conta, **When** ele utiliza seu convite válido,
   confirma os dados e define e-mail e senha, **Then** sua conta é vinculada ao cadastro correto e o
   convite deixa de permitir uma segunda ativação.
2. **Given** um usuário com mais de um papel, **When** ele entra no aplicativo, **Then** recebe a união
   das permissões de seus papéis sem precisar trocar de conta.
3. **Given** um Técnico autenticado, **When** ele tenta gerenciar usuários ou consolidar estatísticas,
   **Then** a operação é negada mesmo se for solicitada fora da interface normal.
4. **Given** um visitante não autenticado, **When** ele acessa o aplicativo, **Then** visualiza somente
   as telas públicas de boas-vindas, login e validação de convite.

---

### User Story 2 - Gestão do elenco e preservação do histórico (Priority: P1)

Como Presidente, quero manter o elenco, os papéis e a disponibilidade esportiva atualizados sem
perder o histórico de quem já participou do clube.

**Why this priority**: Atletas e seus estados determinam convocações, escalações, estatísticas e
permissões em todos os módulos esportivos.

**Independent Test**: Pode ser testada cadastrando, editando e inativando um atleta, verificando a
reutilização do número da camisa e a permanência das estatísticas anteriores.

**Acceptance Scenarios**:

1. **Given** um Presidente autenticado, **When** cadastra um atleta com dados válidos e número livre,
   **Then** o atleta passa a integrar o elenco com o estado definido.
2. **Given** um número já usado por atleta não inativo, **When** o Presidente tenta atribuí-lo a outro
   atleta, **Then** o cadastro é recusado com explicação clara.
3. **Given** um atleta com histórico esportivo, **When** seu estado muda para INATIVO, **Then** suas
   permissões e elegibilidade de Atleta são removidas, seu número fica disponível e seus registros
   históricos permanecem consultáveis; permissões de Presidente ou Técnico continuam ativas.
4. **Given** um atleta sem foto, **When** seu perfil é exibido, **Then** aparece um avatar consistente
   com suas iniciais e a identidade visual do clube.

---

### User Story 3 - Partidas, convocações e presença (Priority: P1)

Como Presidente ou Técnico, quero programar partidas, convocar atletas e acompanhar suas respostas.
Como Atleta, quero confirmar ou recusar minha presença dentro do prazo para que a comissão planeje o
jogo com informação confiável.

**Why this priority**: A centralização das presenças é o principal ganho operacional e substitui o
controle informal em mensagens e planilhas.

**Independent Test**: Pode ser testada criando uma partida, convocando atletas, registrando respostas
e observando o painel da comissão atualizar sem recarregamento manual.

**Acceptance Scenarios**:

1. **Given** um atleta convocado e um prazo ainda aberto, **When** ele confirma presença, **Then** sua
   resposta fica CONFIRMADO e a comissão visualiza a atualização em tempo real.
2. **Given** um atleta convocado, **When** tenta recusar sem justificativa, **Then** o envio é bloqueado
   e o campo obrigatório é indicado; com justificativa válida, a resposta fica RECUSADO.
3. **Given** o prazo geral encerrado, **When** o atleta tenta alterar sua resposta, **Then** a ação é
   bloqueada na interface e também por qualquer solicitação direta.
4. **Given** o prazo geral encerrado, **When** Presidente ou Técnico faz uma convocação excepcional
   com prazo individual até o início da partida, **Then** somente o atleta escolhido pode responder
   dentro desse prazo individual.
5. **Given** uma partida com respostas registradas, **When** sua data ou horário é alterado, **Then**
   todas as respostas retornam a PENDENTE e os convocados são avisados para reconfirmar.
6. **Given** uma partida cancelada, **When** Presidente ou Técnico a reativa, **Then** ela volta a ser
   exibida como agendada segundo os dados atuais e as regras de confirmação aplicáveis.
7. **Given** uma recusa com justificativa registrada, **When** outro Atleta consulta as presenças,
   **Then** ele pode visualizar o estado RECUSADO, mas não a justificativa; o próprio atleta,
   Presidente e Técnico podem consultá-la.
8. **Given** uma partida consolidada, **When** Presidente ou Técnico tenta alterar uma presença sem
   reabertura, **Then** a operação é negada; depois que o Presidente reabre a partida, ambos podem
   realizar a correção com registro de auditoria.

---

### User Story 4 - Publicação da escalação oficial (Priority: P2)

Como Presidente ou Técnico, quero organizar titulares e reservas em uma formação visual e publicar a
escalação oficial. Como Atleta, quero consultar claramente minha condição e a formação do time.

**Why this priority**: A escalação depende de elenco, partida e presença, mas concentra a operação do
dia do jogo e reduz dúvidas no grupo do time.

**Independent Test**: Pode ser testada montando e publicando uma formação para uma partida com atletas
elegíveis e verificando sua visualização pelos jogadores.

**Acceptance Scenarios**:

1. **Given** uma partida e atletas elegíveis, **When** Presidente ou Técnico define formação,
   titulares e reservas, **Then** a escalação pode ser salva e publicada com a disposição escolhida.
2. **Given** um atleta LESIONADO, SUSPENSO, INATIVO ou com presença RECUSADO, **When** alguém tenta
   incluí-lo na escalação, **Then** a inclusão é recusada com o motivo correspondente.
3. **Given** uma escalação publicada, **When** ela é atualizada e republicada, **Then** o elenco vê a
   versão vigente e recebe um novo aviso da alteração.

---

### User Story 5 - Estatísticas e Craque do Jogo (Priority: P2)

Como Presidente, quero registrar o resultado oficial e consolidar gols e assistências. Como Atleta,
quero acompanhar meu histórico e votar no Craque do Jogo sem poder votar em mim mesmo.

**Why this priority**: Preserva o histórico esportivo e aumenta o engajamento, mas só funciona depois
que partidas, atletas e permissões estão disponíveis.

**Independent Test**: Pode ser testada finalizando uma partida, consolidando eventos, votando com dois
atletas diferentes e verificando ranking, prazo e resultado da votação.

**Acceptance Scenarios**:

1. **Given** uma partida concluída, **When** o Presidente informa placar, gols e assistências e confirma
   a consolidação, **Then** as estatísticas são atualizadas uma única vez e a votação é aberta por 24
   horas.
2. **Given** um Atleta elegível na janela de votação, **When** abre a lista de candidatos, **Then** vê
   somente titulares e reservas da revisão oficial vinculada à consolidação, exceto seu próprio nome; uma
   tentativa direta de votar em si mesmo ou em outro atleta fora dessa escalação é negada.
3. **Given** um Atleta que já votou na rodada válida atual, **When** tenta votar novamente nessa mesma
   rodada, **Then** o segundo voto é recusado.
4. **Given** dois ou mais atletas empatados com a maior quantidade de votos ao fim da janela, **When**
   o resultado é apurado, **Then** todos os empatados recebem o reconhecimento de Craque do Jogo.
5. **Given** temporadas com partidas consolidadas, **When** um usuário consulta rankings e histórico,
   **Then** visualiza artilharia, assistências, presenças e temporadas anteriores sem contar partidas
   ainda não consolidadas como oficiais.
6. **Given** uma partida consolidada com erro identificado, **When** o Presidente a reabre, **Then** as
   contribuições estatísticas anteriores são revertidas, votos e prêmios daquela apuração são
   invalidados e a correção fica registrada; ao reconsolidar, uma nova janela de votação de 24 horas
   é iniciada e cada Atleta elegível pode emitir um novo voto nessa nova rodada.

---

### User Story 6 - Avisos e notificações operacionais (Priority: P2)

Como Presidente ou Técnico, quero publicar avisos e acionar notificações nos eventos relevantes. Como
Atleta, quero enxergar pendências mesmo quando não autorizei notificações no dispositivo.

**Why this priority**: A comunicação complementa os fluxos centrais, mas não pode ser condição para
usar o aplicativo.

**Independent Test**: Pode ser testada sem permissão de notificação, confirmando que o mural e os
indicadores internos continuam informando convocações e prazos.

**Acceptance Scenarios**:

1. **Given** um Presidente ou Técnico, **When** publica um aviso, **Then** o aviso aparece no mural para
   o elenco com autor e data de publicação.
2. **Given** uma nova convocação, alteração de partida, escalação publicada, votação aberta ou novo
   aviso, **When** o evento ocorre, **Then** os destinatários com permissão recebem uma notificação.
3. **Given** uma presença ainda pendente, **When** faltam 24 horas e depois 6 horas para o prazo,
   **Then** o atleta recebe os lembretes aplicáveis sem duplicação do mesmo lembrete.
4. **Given** notificações indisponíveis ou recusadas, **When** o atleta abre o aplicativo, **Then** os
   fluxos continuam funcionando e a tela inicial destaca as pendências existentes.

---

### User Story 7 - Consulta essencial sem conexão (Priority: P3)

Como integrante do clube, quero consultar o último próximo jogo e a última escalação ativa carregados
no dispositivo quando a conexão falhar, especialmente no vestiário.

**Why this priority**: Melhora a resiliência no dia do jogo sem ampliar o MVP para sincronização de
escritas ou resolução de conflitos offline.

**Independent Test**: Pode ser testada carregando jogo e escalação, interrompendo a conexão e abrindo
novamente essas informações no mesmo dispositivo e usuário.

**Acceptance Scenarios**:

1. **Given** que próximo jogo e escalação ativa foram carregados anteriormente, **When** o dispositivo
   fica sem conexão, **Then** o último estado conhecido continua disponível com indicação de modo
   offline e horário da última atualização.
2. **Given** o dispositivo offline, **When** o atleta tenta confirmar presença, votar ou executar outra
   escrita, **Then** a ação permanece desabilitada e uma mensagem solicita reconexão.
3. **Given** que um usuário encerrou a sessão ou outro usuário entrou no dispositivo, **When** o estado
   offline é consultado, **Then** dados persistidos da sessão anterior não são exibidos.

### Edge Cases

- Convite reutilizado, revogado, inválido ou associado a atleta já ativado não pode criar outra conta.
- Um mesmo usuário pode acumular papéis; remover um papel não pode retirar permissões concedidas por
  outro papel ainda ativo.
- Atleta INATIVO não pode atuar como Atleta nem ocupar número de camisa, mas continua nos registros
  históricos e mantém acessos concedidos por eventuais papéis Presidente ou Técnico.
- Alteração simultânea da presença pelo atleta e pela comissão deve produzir um único estado final e
  registrar a intervenção administrativa quando houver.
- Presença de partida consolidada não pode ser alterada até que o Presidente execute a reabertura
  auditada da partida.
- O prazo individual de convocação excepcional não pode ultrapassar o início da partida.
- Alterar somente adversário, local ou campeonato não reinicia presenças; alterar data ou horário
  reinicia todas as respostas da partida.
- Falha no envio de notificação não desfaz nem bloqueia convocação, escalação, aviso ou consolidação.
- Repetir a ação de consolidação não pode duplicar gols, assistências, presenças ou prêmios.
- Reabrir uma partida consolidada deve reverter integralmente sua contribuição anterior para os
  rankings e invalidar votos e prêmios antes de permitir nova consolidação.
- Votos enviados após 24 horas, duplicados na mesma rodada válida, em nome de outro usuário ou no
  próprio votante são negados; votos de rodada invalidada não bloqueiam voto na rodada sucessora.
- Voto dirigido a atleta que não integra a revisão de escalação vinculada à consolidação é negado.
- Empate no topo da votação premia todos os líderes, independentemente da quantidade de empatados.
- Sem dados previamente carregados, o modo offline informa que o conteúdo ainda não está disponível,
  sem apresentar informações de outro usuário.
- Horários próximos à virada do dia e mudanças de fuso devem respeitar o instante oficial da partida
  e dos prazos exibidos ao usuário.

## Requirements *(mandatory)*

### Functional Requirements

#### Acesso, identidade e permissões

- **FR-001**: O sistema MUST permitir acesso autenticado por e-mail e senha somente após convite
  individual válido.
- **FR-002**: O sistema MUST permitir que o Presidente gere, reenvie e revogue convites vinculados a
  um único atleta pré-cadastrado.
- **FR-003**: Cada convite MUST permitir no máximo uma ativação de conta e MUST deixar de ser válido
  após ativação ou revogação.
- **FR-004**: O sistema MUST suportar os papéis Presidente, Técnico e Atleta e MUST permitir que um
  usuário acumule papéis.
- **FR-005**: As permissões efetivas MUST corresponder à união dos papéis ativos, e toda operação MUST
  ser validada independentemente da visibilidade dos controles na interface.
- **FR-006**: Visitantes MUST acessar somente boas-vindas, login e validação de convite.
- **FR-007**: Presidente e Técnico MUST concluir um segundo fator de autenticação para acessar funções
  administrativas; para Atletas sem papel administrativo, o segundo fator MUST ser opcional.
- **FR-008**: O sistema MUST permitir que o Presidente atribua ou remova papéis, registrando ator,
  momento, usuário afetado e alteração realizada.
- **FR-009**: O sistema MUST permitir redefinição administrativa para uma senha temporária, exigir sua
  troca no primeiro acesso e não disponibilizar recuperação automática por e-mail no MVP.

#### Elenco

- **FR-010**: O Presidente MUST poder cadastrar e editar nome completo entre 2 e 120 caracteres, nome
  de camisa entre 1 e 40 caracteres, número entre 1 e 99, posição principal normalizada entre 2 e 40
  caracteres, foto opcional e estado esportivo de um atleta.
- **FR-011**: Os estados permitidos do atleta MUST ser ATIVO, LESIONADO, SUSPENSO e INATIVO.
- **FR-012**: Um número de camisa MUST pertencer a no máximo um atleta não inativo por vez.
- **FR-013**: Ao inativar um atleta, o sistema MUST remover somente suas permissões e elegibilidade de
  Atleta, liberar o número de camisa e preservar seu histórico esportivo. Se o usuário também possuir
  papel Presidente ou Técnico, as permissões desses papéis MUST permanecer ativas.
- **FR-014**: Uma exclusão lógica MUST preservar resultados oficiais e MUST remover ou anonimizar
  dados pessoais que não sejam necessários ao histórico.
- **FR-015**: Sem foto válida, o sistema MUST exibir avatar com iniciais e identidade visual do clube.
- **FR-016**: Fotos de perfil MUST ser validadas e automaticamente otimizadas antes do armazenamento,
  limitadas a 1 MB e a 1024 × 1024 pixels no arquivo final.
- **FR-017**: Usuários autenticados MUST poder consultar ficha esportiva, estado atual e estatísticas
  permitidas dos integrantes do elenco.

#### Partidas, convocações e presenças

- **FR-018**: Presidente e Técnico MUST poder criar, editar, cancelar e reativar partidas com
  adversário entre 2 e 120 caracteres, data, horário e prazo de confirmação; local com até 160
  caracteres e campeonato com até 120 caracteres MUST ser opcionais.
- **FR-019**: Ao criar uma partida, o prazo geral MUST assumir 24 horas antes do início quando nenhum
  prazo diferente for informado e MUST permanecer anterior ao início da partida.
- **FR-020**: Presidente e Técnico MUST selecionar convocados e MUST poder alterar administrativamente
  uma resposta de presença com registro de auditoria até a consolidação da partida. Enquanto a partida
  estiver consolidada, a alteração MUST ser bloqueada; após reabertura pelo Presidente, ambos os
  papéis MUST poder realizar a correção antes da nova consolidação.
- **FR-021**: Cada convocado MUST possuir exatamente uma resposta por partida, inicialmente PENDENTE.
- **FR-022**: Antes do prazo aplicável, o Atleta convocado MUST poder escolher CONFIRMADO ou RECUSADO.
- **FR-023**: Uma resposta RECUSADO MUST exigir justificativa normalizada entre 1 e 500 caracteres;
  CONFIRMADO MUST remover uma justificativa de recusa anterior. A justificativa MUST ser visível
  somente para o próprio atleta, Presidente e Técnico; os demais Atletas podem visualizar apenas o
  estado da resposta.
- **FR-024**: Após o prazo geral, o Atleta MUST ser impedido de criar ou alterar sua resposta, salvo se
  possuir convocação excepcional ainda válida.
- **FR-025**: Presidente e Técnico MUST poder realizar convocação excepcional individual após o prazo
  geral, com prazo posterior ao momento da convocação e não posterior ao início da partida.
- **FR-026**: Alterar data ou horário de uma partida MUST, em uma única operação, atualizar a partida,
  redefinir todas as respostas para PENDENTE e solicitar reconfirmação aos convocados.
- **FR-027**: Respostas e alterações administrativas MUST aparecer para Presidente e Técnico sem exigir
  atualização manual da tela.
- **FR-028**: O sistema MUST manter o histórico de partidas por temporada e distinguir partidas
  AGENDADAS, CONCLUÍDAS e CANCELADAS.

#### Escalação

- **FR-029**: Presidente e Técnico MUST poder selecionar uma formação aprovada pelo clube entre
  `4-4-2`, `4-3-3`, `4-2-3-1` e `3-5-2`, posicionar titulares e registrar reservas para uma partida.
- **FR-030**: O sistema MUST impedir na escalação atleta INATIVO, LESIONADO, SUSPENSO ou que tenha
  recusado presença naquela partida.
- **FR-031**: Presidente e Técnico MUST poder salvar uma escalação ainda não publicada e publicar ou
  atualizar a versão oficial.
- **FR-032**: Usuários autenticados MUST visualizar somente a versão oficial vigente, distinguindo
  titulares, reservas e disposição tática.

#### Resultado, estatísticas e Craque do Jogo

- **FR-033**: Somente o Presidente MUST poder registrar placar final, gols e assistências e consolidar
  as estatísticas oficiais. A consolidação MUST exigir uma escalação oficial publicada e vincular
  imutavelmente a revisão vigente naquele instante.
- **FR-034**: A consolidação MUST atualizar resultado e estatísticas de forma atômica e idempotente,
  sem duplicação quando a mesma solicitação for repetida. Somente o Presidente MUST poder reabrir uma
  partida consolidada; a reabertura MUST reverter suas contribuições estatísticas, invalidar votos e
  prêmios relacionados e registrar a correção antes de aceitar nova consolidação.
- **FR-035**: Consolidar ou reconsolidar a partida MUST abrir uma nova janela de votação de exatamente
  24 horas.
- **FR-036**: Somente usuário com papel Atleta MUST votar; Presidente ou Técnico só pode votar se
  também possuir papel Atleta.
- **FR-037**: Cada Atleta MUST emitir no máximo um voto por rodada de votação válida e MUST ser
  impedido de votar em si mesmo, inclusive por solicitação direta. Votos pertencentes a rodadas
  invalidadas MUST NOT impedir um novo voto na rodada aberta após reconsolidação.
- **FR-038**: A lista de candidatos MUST conter somente titulares e reservas da revisão de escalação
  oficial vinculada à consolidação vigente e MUST excluir o próprio votante, ainda que outra escalação
  seja publicada posteriormente.
- **FR-039**: Ao encerrar a janela, todos os atletas empatados com a maior quantidade de votos MUST
  receber o reconhecimento de Craque do Jogo.
- **FR-040**: O sistema MUST apresentar por temporada rankings de gols, assistências e presenças, além
  do histórico esportivo preservado de temporadas anteriores.

#### Avisos e notificações

- **FR-041**: Presidente e Técnico MUST poder publicar avisos no mural com título entre 1 e 100
  caracteres, corpo entre 1 e 2.000 caracteres, autor e data de publicação.
- **FR-042**: Usuários autenticados MUST poder consultar os avisos do mural em ordem do mais recente.
- **FR-043**: O sistema MUST tentar notificar os destinatários em novas convocações, alterações de
  data ou horário, pedidos de reconfirmação, publicação ou atualização de escalação, abertura de
  votação e novos avisos.
- **FR-044**: Atletas com presença PENDENTE MUST receber no máximo um lembrete de 24 horas e um de 6
  horas por revisão do prazo aplicável. Um agendador executado a cada 5 minutos MUST considerar cada
  lembrete elegível do instante-alvo até 10 minutos depois; convocações criadas depois do instante-alvo
  e janelas perdidas MUST NOT produzir lembretes atrasados.
- **FR-045**: Falha, recusa ou indisponibilidade de notificações MUST NOT impedir qualquer fluxo
  principal e MUST resultar em destaque das pendências relevantes dentro do aplicativo.

#### Funcionamento sem conexão e comunicação de estado

- **FR-046**: O sistema MUST manter no dispositivo somente o último próximo jogo e a última escalação
  oficial ativa previamente consultados pelo usuário.
- **FR-047**: Conteúdo offline MUST indicar ausência de conexão e o horário da última atualização.
- **FR-048**: Quando estiver offline, o sistema MUST desabilitar confirmações, recusas, votos e demais
  escritas, MUST NOT enfileirá-las e MUST explicar que a reconexão é necessária.
- **FR-049**: Dados offline MUST expirar, MUST ser separados por usuário e MUST ser removidos ao sair,
  trocar de usuário ou revogar o acesso.
- **FR-050**: O conteúdo offline MUST excluir justificativas de ausência, e-mails, credenciais,
  convites e outros dados pessoais não necessários à consulta de jogo e escalação.

#### Segurança, auditoria e experiência

- **FR-051**: Toda ação administrativa sobre usuários, papéis, senhas, elenco, partidas, presenças,
  escalações e estatísticas MUST registrar ator, data, ação e recurso afetado.
- **FR-052**: Mensagens de erro MUST ser compreensíveis para o usuário e MUST NOT revelar credenciais,
  detalhes internos ou dados de terceiros.
- **FR-053**: A interface MUST estar integralmente em português do Brasil e MUST permitir navegação por
  teclado, foco visível, leitura por tecnologia assistiva e alvos de toque adequados.
- **FR-054**: Datas e prazos MUST ser apresentados no horário de São Paulo e comparados por um instante
  oficial consistente, independentemente da configuração local do dispositivo.
- **FR-055**: A identidade institucional MUST ser aplicada de forma consistente sem alterar as regras
  funcionais do produto.

### Key Entities

- **Usuário**: Identidade autenticada de uma pessoa; possui e-mail, estado de acesso, requisito de
  troca de senha e um ou mais papéis.
- **Papel**: Conjunto de permissões de Presidente, Técnico ou Atleta que pode ser combinado com outros
  papéis do mesmo usuário.
- **Atleta**: Perfil esportivo vinculado opcionalmente a um usuário; contém nomes, número de camisa,
  posição, estado, foto e histórico preservado.
- **Convite**: Credencial individual e revogável que vincula uma nova conta a um atleta pré-cadastrado
  e registra emissão, ativação ou revogação.
- **Partida**: Evento esportivo pertencente a uma temporada, com adversário, data, local, competição,
  estado, prazo de confirmação e resultado oficial.
- **Convocação e Presença**: Relação única entre partida e atleta que registra convocação, resposta,
  justificativa quando recusada e eventual prazo excepcional.
- **Escalação**: Formação de uma partida, composta por versão oficial, titulares, reservas e posições
  visuais, sempre sujeita à elegibilidade dos atletas.
- **Evento Estatístico**: Gol ou assistência oficial atribuído a atleta em partida e considerado nos
  rankings após consolidação.
- **Voto de Craque do Jogo**: Escolha única de um atleta votante por rodada de votação válida, dentro
  da janela permitida e dirigida a outro atleta elegível.
- **Aviso**: Comunicado publicado no mural por usuário autorizado, com autoria e data.
- **Registro de Auditoria**: Evidência imutável de ação administrativa ou crítica, contendo ator,
  momento, ação e recurso afetado.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Após a adoção do MVP, 100% do controle oficial de presenças, escalações e estatísticas do
  clube ocorre no aplicativo, sem necessidade de planilhas paralelas.
- **SC-002**: Pelo menos 95% das respostas dos atletas convocados são registradas no aplicativo até o
  prazo aplicável durante os primeiros três meses de uso.
- **SC-003**: O tempo médio entre a entrega de uma notificação de convocação e o registro da resposta
  do atleta é inferior a 3 minutos para respostas realizadas na mesma sessão.
- **SC-004**: Pelo menos 90% dos atletas convidados concluem ativação da conta e primeira resposta de
  presença sem assistência direta do Presidente.
- **SC-005**: Em testes de aceitação, 100% das tentativas não autorizadas dos papéis definidos são
  bloqueadas sem expor dados de outro usuário.
- **SC-006**: Em testes com conexão interrompida após sincronização prévia, próximo jogo e escalação
  ativa ficam legíveis em até 2 segundos e nenhuma escrita é apresentada como concluída.
- **SC-007**: Em testes de reagendamento, consolidação repetida e votação concorrente, não ocorre
  duplicação de presença, estatística ou voto em 100% dos cenários cobertos.
- **SC-008**: Pelo menos 90% dos participantes de um teste de usabilidade completam confirmação ou
  recusa de presença na primeira tentativa, sem instruções externas.
- **SC-009**: Falhas de notificação não impedem criação de convocação, publicação de escalação,
  consolidação ou consulta das pendências em 100% dos testes de resiliência.

## Assumptions

- O MVP atende somente ao Meia Boca Juniors e a aproximadamente 15 usuários com acesso duas ou três
  vezes por semana.
- O produto é um webapp responsivo, mobile-first e acessado pelo navegador; aplicativos nativos não
  fazem parte deste MVP.
- O mesmo usuário pode acumular papéis, e Presidente ou Técnico só participa da votação quando também
  possuir o papel Atleta.
- Convites permanecem válidos até uso ou revogação; expiração automática pode ser adicionada depois se
  a operação real demonstrar necessidade.
- Para votação, são candidatos somente titulares e reservas da revisão oficial vinculada no instante
  da consolidação da partida.
- Cada reconsolidação cria uma rodada de votação independente; votos de rodadas invalidadas são
  preservados como histórico, mas não consomem o voto permitido na nova rodada válida.
- Alterar data ou horário reinicia presenças; alterar somente adversário, local ou competição não as
  reinicia.
- A temporada segue o ano informado na partida, e horários oficiais são exibidos para São Paulo.
- A operação sem conexão é somente de leitura e depende de o conteúdo ter sido consultado previamente
  pelo mesmo usuário no dispositivo.
- Avisos e notificações são auxiliares; o estado persistido no produto permanece como fonte oficial.
- Não existe recuperação automática de senha por e-mail; o Presidente executa o fluxo administrativo
  auditado de senha temporária.

## Dependencies

- O Presidente precisa fornecer os dados iniciais do elenco, papéis e temporada.
- Os usuários precisam de endereço de e-mail individual e acesso ao convite encaminhado pelo clube.
- Notificações no dispositivo dependem de consentimento e suporte do navegador, sem impedir o uso do
  restante do produto.
- A consulta offline depende de uma sincronização online anterior no mesmo dispositivo e usuário.

## Scope Boundaries

### Included

- Acesso por convite, autenticação, múltiplos papéis e recuperação administrativa de senha.
- Elenco, partidas, convocações, presenças, escalações, estatísticas, votação e mural.
- Notificações operacionais com fallback visual e leitura offline essencial.
- Histórico esportivo, auditoria administrativa e rankings por temporada.

### Excluded

- Aplicativos nativos e publicação em lojas.
- Múltiplos clubes no mesmo ambiente de dados ou funcionalidades SaaS.
- Pagamentos, cobranças, emissão fiscal e qualquer movimentação financeira.
- E-mail transacional ou de marketing.
- Analytics comportamental, publicidade, inteligência artificial e múltiplos idiomas.
- Escritas offline, sincronização posterior e resolução de conflitos offline.
- Busca global, chat interno e integração bidirecional com WhatsApp.
