# Tech Stack — Aplicativo Oficial Meia Boca Juniors

**Status:** aprovado para o planejamento do MVP  
**Data:** 2026-08-24  
**Responsável:** desenvolvedor solo, com SpecKit e Codex  
**Base:** Feature Specification do MBJ e decisões do responsável pelo projeto

> A decisão mais recente do responsável substitui a plataforma React Native citada na
> especificação inicial. O MVP será um webapp responsivo acessado pelo navegador.

## Diretrizes do MVP

- Priorizar simplicidade, aprendizado e baixo custo operacional.
- Construir um único webapp para um único clube, sem arquitetura SaaS.
- Usar TypeScript e nomes técnicos em inglês; interface em português do Brasil.
- Proteger regras críticas no PostgreSQL/RLS, sem confiar somente na interface.
- Não incluir pagamentos, emissão fiscal, e-mail, marketing, IA ou analytics comportamental.
- Preservar o histórico esportivo ao inativar ou excluir logicamente um atleta.

---

## 1. Arquitetura e organização

### Qual linguagem, framework e bibliotecas o time vai usar?

- **Decisão:** stack padronizada.
- Linguagem: `TypeScript`.
- Front-end: `React + Vite`, como Progressive Web App (PWA) responsivo.
- Backend: `Supabase Free` (Auth, PostgreSQL, Storage, Realtime e Edge Functions).
- Repositório e CI: `GitHub público + GitHub Actions`.
- Hospedagem e CDN: `Cloudflare Pages Free`.
- UI: `Tailwind CSS + shadcn/ui`.
- Dados remotos/cache: `TanStack Query`.
- Estado global pequeno: `Zustand`.
- Formulários/validação: `React Hook Form + Zod`.
- Rotas: `React Router`.
- Testes: `Vitest + Testing Library + Playwright`.
- Push: `OneSignal Web Push`, encapsulado em adapter próprio.
- Erros: `Sentry`.

> 💡 Motivo: React com Vite reduz a complexidade de um projeto solo, enquanto o Supabase cobre o
> backend já definido na especificação.

### Onde escrevemos as regras pesadas do app?

- **Decisão:** Service Layer no front-end; funções SQL/Edge Functions para regras privilegiadas.

> 💡 Motivo: separa telas da lógica e protege no servidor prazos, permissões e votação.

### Como agrupamos nossos arquivos e pastas?

- **Decisão:** por feature, com uma área compartilhada pequena.

> 💡 Motivo: elenco, partidas, convocações, escalação, estatísticas e mural ficam autocontidos.

### Textos e status mágicos

- **Decisão:** enums, constantes e tipos centralizados, com enums/constraints equivalentes no banco.

> 💡 Motivo: impede divergências como `PENDENTE`, `pendente` e valores inválidos.

### Como nomeamos as coisas no código?

- **Decisão:** código, banco e commits em inglês; interface e documentação funcional em português.
- TypeScript: `camelCase`, `PascalCase` e `UPPER_SNAKE_CASE`.
- PostgreSQL: `snake_case`, tabelas no plural e chaves `id` em UUID.

> 💡 Motivo: segue as convenções do ecossistema e mantém consistência.

### Como lidamos com ferramentas de terceiros?

- **Decisão:** adapters/interfaces para Supabase, OneSignal e Sentry.

> 💡 Motivo: SDKs externos não ficam espalhados pelos componentes e podem ser simulados em testes.

### O sistema tem planos com limites de uso?

- **Decisão:** não há planos nem limites comerciais.

> 💡 Motivo: o sistema atende somente ao Meia Boca Juniors e não é SaaS.

### O sistema precisa emitir Nota Fiscal ou boleto?

- **Decisão:** não aplicável ao MVP.

> 💡 Motivo: não haverá cobrança, venda ou faturamento.

### Como organizamos os repositórios?

- **Decisão:** um repositório público no GitHub contendo webapp, migrations, Edge Functions e
  documentação. `.env`, backups, chaves e dados reais de jogadores são proibidos no repositório.

> 💡 Motivo: permite mudanças atômicas, serve como portfólio do curso e libera os recursos gratuitos
> de CI e proteção da branch principal oferecidos a projetos públicos.

---

## 2. Banco de dados

### Qual o tipo de banco principal?

- **Decisão:** banco relacional SQL.
- Banco escolhido: `PostgreSQL no Supabase`.

> 💡 Motivo: o domínio é relacional e exige integridade, constraints e transações.

### Quando o usuário clica em “Excluir Conta”?

- **Decisão:** soft delete com anonimização dos dados pessoais e revogação do acesso.

> 💡 Motivo: preserva estatísticas e histórico do clube e libera o número da camisa.

### Quem valida os dados?

- **Decisão:** cliente, Service Layer e banco com constraints, RLS e triggers.

> 💡 Motivo: requisições diretas não podem contornar as regras de negócio.

### Como guardamos dados muito variados?

- **Decisão:** colunas relacionais para o domínio; JSONB apenas para configurações opcionais que não
  precisem de filtro ou relatório.

> 💡 Motivo: preserva consultas e relatórios sem eliminar flexibilidade onde ela é útil.

### Como paginamos listas grandes?

- **Decisão:** paginação por cursor, ordenada por data e UUID como desempate.

> 💡 Motivo: permanece eficiente com o crescimento do histórico.

### Como alteramos a estrutura do banco?

- **Decisão:** migrations SQL obrigatórias e versionadas.

> 💡 Motivo: o schema deve ser reproduzível em desenvolvimento, teste e produção.

### Onde fazemos agregações e contas?

- **Decisão:** PostgreSQL, por views ou funções SQL.

> 💡 Motivo: estatísticas, artilharia e votação são calculadas com consistência perto dos dados.

### Precisamos de auditoria?

- **Decisão:** audit log para ações administrativas e alterações críticas.

> 💡 Motivo: mudanças de presença, partida, escalação, senha, estatísticas e permissões devem registrar
> ator, data, ação e recurso.

### Single-tenant ou multi-tenant?

- **Decisão:** o MVP permanece estritamente single-tenant, exclusivo para o MBJ. O schema não terá
  `club_id`, isolamento multi-tenant ou regras de acesso destinadas a vários clubes nesta fase.
- O front-end será preparado para customização estética White-Label de baixo custo: cores do
  Tailwind definidas por CSS Variables/temas do shadcn/ui, logos e textos institucionais fornecidos
  por uma configuração centralizada por deploy, sem espalhar valores do MBJ pelos componentes.
- Se outros clubes adotarem o sistema, a estratégia inicial será **multi-instance**: o mesmo
  código-fonte gera instâncias separadas no Cloudflare Pages e no Supabase para cada clube. Um banco
  compartilhado multi-tenant somente será considerado se escala e operação futuras o justificarem.

> 💡 Motivo: mantém banco, RLS e operação simples no MVP, mas evita acoplar a identidade visual ao
> MBJ. Instâncias separadas oferecem isolamento forte e reaproveitamento do código sem antecipar a
> complexidade de uma plataforma SaaS.

### Normalização

- **Decisão:** até a 3ª Forma Normal; desnormalizar apenas após medição que justifique.

> 💡 Motivo: reduz duplicidade e divergência de dados.

### Relacionamentos

- **Decisão:** Foreign Keys reais, `ON DELETE` explícito e unicidade composta.

> 💡 Motivo: impede registros órfãos e duplicidade de presença ou voto.

### SQL ou ORM?

- **Decisão:** `supabase-js` para CRUD/PostgREST e SQL/RPC para operações complexas.

> 💡 Motivo: um ORM adicional duplicaria a abstração já oferecida pelo Supabase.

### ORM, query builder e migrations

- ORM/query builder: `supabase-js`, sem ORM adicional.
- Migration tool: `Supabase CLI + migrations SQL`.

> 💡 Motivo: mantém a stack pequena e o banco versionado pelo fluxo oficial escolhido.

### Índices

- **Decisão:** indexar FKs, filtros, ordenações e constraints frequentes.
- Mínimo: `athletes.user_id`; status e número de camisa ativo; `matches.match_date` e status; FKs de
  presenças/votos; unicidade de `(match_id, athlete_id)` em presenças e
  `(match_id, voter_athlete_id)` em votos.

> 💡 Motivo: acelera as consultas principais e reforça regras de unicidade.

### Transações

- **Decisão:** funções PostgreSQL transacionais para fluxos multi-etapas.

> 💡 Motivo: reagendamento com reset de presenças e consolidação de estatísticas devem ser atômicos.

---

## 3. Performance e tarefas assíncronas

### Tarefas demoradas

- **Decisão:** notificações assíncronas por Edge Functions; sem broker de filas dedicado no MVP.

> 💡 Motivo: o usuário não espera o push, mas Redis/RabbitMQ seria excesso para um clube.

### Cache da tela inicial

- **Decisão:** cache no PWA/navegador, TanStack Query e CDN; sem Redis inicialmente.

> 💡 Motivo: cumpre o cache local do próximo jogo sem infraestrutura desnecessária.

### Problema do N+1

- **Decisão:** consultas relacionais agregadas, views e carregamento em lote.

> 💡 Motivo: listas não farão uma consulta separada por atleta ou partida.

### Imagens dos usuários

- **Decisão:** validar, redimensionar e comprimir para WebP antes do upload.

> 💡 Motivo: requisito explícito que reduz tráfego e armazenamento.

### Falha de API externa

- **Decisão:** fallback gracioso, timeout e retry limitado.

> 💡 Motivo: falha de push ou monitoramento não pode bloquear o webapp.

### Cliques ou requisições duplicadas

- **Decisão:** desabilitar a ação durante o envio e garantir idempotência/constraints no servidor.

> 💡 Motivo: debounce sozinho não protege contra chamadas feitas fora da interface.

### Busca de conteúdo

- **Decisão:** sem busca global no MVP; filtros SQL simples quando necessários.

> 💡 Motivo: o volume de um único clube não justifica um motor de busca.

---

## 4. Segurança

### Como o app mantém o login?

- **Decisão:** Supabase Auth com access token curto e refresh token rotacionado pelo SDK.

> 💡 Motivo: é apropriado para um SPA que consome APIs autenticadas.

### Onde guardamos chaves secretas?

- **Decisão:** `.env.local` ignorado pelo Git em desenvolvimento. A `service_role` fica somente nos
  secrets das Edge Functions e nunca chega ao navegador.

> 💡 Motivo: apenas chaves explicitamente públicas podem integrar o bundle web.

### Como os segredos chegam à produção?

- **Decisão:** Supabase Secrets para Edge Functions, variáveis de ambiente do Cloudflare Pages para o
  front-end e GitHub Actions Secrets para credenciais usadas exclusivamente pelo CI/CD. Somente a URL
  e a chave pública do Supabase podem ser expostas no bundle do navegador.

> 💡 Motivo: é suficiente para um desenvolvedor solo e não versiona credenciais.

### Como guardamos senhas?

- **Decisão:** hash seguro gerenciado exclusivamente pelo Supabase Auth.

> 💡 Motivo: o aplicativo nunca salva, registra ou lê a senha em texto puro.

### Controle de acesso

- **Decisão:** RBAC por papéis mais policies RLS por operação e recurso.

> 💡 Motivo: a matriz Presidente, Comissão, Jogador e Visitante exige granularidade.

### CSRF e CORS

- **Decisão:** CORS com origens permitidas, tokens bearer e headers de segurança/CSP.

> 💡 Motivo: restringe origens e reduz o impacto de injeções no SPA.

### IDOR

- **Decisão:** toda operação verifica identidade, papel e propriedade com RLS; um ID nunca autoriza
  acesso sozinho.

> 💡 Motivo: esconder botões no front-end não é controle de segurança.

### Estratégia de autenticação

- **Decisão:** e-mail e senha após validação de convite individual.

> 💡 Motivo: escolha do responsável para simplificar o MVP e restringir o acesso ao elenco.

### Expiração da sessão

- **Decisão:** tokens expiram e são renovados com rotação; sessões podem ser revogadas e expiram após
  período definido de inatividade.

> 💡 Motivo: equilibra conveniência e proteção contra token roubado.

### 2FA

- **Decisão:** TOTP obrigatório para Presidente e Comissão Técnica; opcional para jogadores.

> 💡 Motivo: contas administrativas alteram elenco, presenças, escalações e estatísticas.

### Força bruta no login

- **Decisão:** rate limit, bloqueio temporário progressivo e registro de tentativas suspeitas.

> 💡 Motivo: proteção mínima contra força bruta e credential stuffing.

### Recuperação de conta

- **Decisão:** sem recuperação automática por e-mail. O Presidente define uma senha temporária por
  fluxo administrativo auditado, e o jogador deve trocá-la no primeiro acesso.

> 💡 Motivo: segue a simplificação solicitada sem permitir que o administrador conheça a senha
> permanente do jogador.

---

## 5. Front-end e back-end

### Plataforma de acesso

- **Decisão:** webapp responsivo mobile-first para navegador no celular e computador.

> 💡 Motivo: elimina publicação em lojas e substitui a decisão inicial por React Native.

### Renderização

- **Decisão:** SPA/PWA renderizado no navegador.

> 💡 Motivo: o conteúdo é privado, SEO não importa e a navegação deve parecer um app.

### Resposta de sucesso da API

- **Decisão:** Service Layer normaliza retornos como `{ data, error }`, compatível com Supabase.

> 💡 Motivo: mantém o consumo previsível sem lutar contra o SDK escolhido.

### Resposta de erro da API

- **Decisão:** erros tipados com código, mensagem segura e mapa de campos quando aplicável.

> 💡 Motivo: dá feedback específico sem expor SQL ou stack trace.

### Envio de filtros

- **Decisão:** query string para leitura; body JSON para comandos e escritas.

> 💡 Motivo: respeita a semântica HTTP e torna filtros reproduzíveis.

### Versionamento

- **Decisão:** migrations retrocompatíveis; Edge Functions públicas versionadas em `/v1` quando
  houver contrato próprio.

> 💡 Motivo: evita quebrar uma versão do PWA ainda em cache.

### Documentação da API

- **Decisão:** documentação do Supabase, tipos TypeScript gerados do schema e Edge Functions
  documentadas no repositório.

> 💡 Motivo: reduz documentação manual defasada.

### Componentes visuais

- **Decisão:** shadcn/ui e primitives acessíveis, customizados com Tailwind e identidade MBJ.

> 💡 Motivo: acelera o MVP sem perder a aparência azul-escuro, dourada e preta.

### Estilo de comunicação

- **Decisão:** REST/PostgREST do Supabase e RPC SQL para operações transacionais.

> 💡 Motivo: GraphQL e tRPC não trazem benefício proporcional neste projeto.

### Estado global

- **Decisão:** TanStack Query gerencia exclusivamente o estado do servidor — cache, requisições,
  invalidações e dados vindos do Supabase. Zustand fica restrito ao estado de interface do cliente,
  como visibilidade de menus e modais e seleção do tema visual. Context pode manter a sessão quando
  for suficiente.

> 💡 Motivo: evita duplicar dados remotos no Zustand, deixa explícita a responsabilidade de cada
> ferramenta e reduz inconsistências entre cache e interface.

---

## 6. Erros, logs e alertas

### Erro fatal na tela

- **Decisão:** Error Boundary com mensagem amigável, ação de tentar novamente e Trace ID.

> 💡 Motivo: protege detalhes internos e facilita localizar a falha.

### Registro de erros

- **Decisão:** Sentry no front-end e Edge Functions, mais logs do Supabase.
- Em builds de produção, source maps serão enviados de forma autenticada ao release identificado pelo
  commit e removidos de `dist` antes da publicação; o CI falha se algum `.map` permanecer público.

> 💡 Motivo: oferece diagnóstico suficiente sem uma suíte cara.

### Monitoramento de disponibilidade

- **Decisão:** UptimeRobot Free com verificação HTTP/keyword a cada 5 minutos na URL canônica de
  produção e heartbeat separado concluído pelo backup semanal do n8n; ambos alertam o responsável.

> 💡 Motivo: permite descobrir uma queda antes dos jogadores.

### APM e tracing

- **Decisão:** Sentry Performance com baixa amostragem nas operações críticas; sem tracing distribuído
  completo no MVP.

> 💡 Motivo: traz visibilidade proporcional a um monólito pequeno.

### Dados proibidos nos logs

- **Decisão:** sanitizar senhas, tokens, convites, autenticação e dados pessoais desnecessários.

> 💡 Motivo: logs não podem virar uma fonte de vazamento.

---

## 7. Git e deploy

### Fluxo Git

- **Decisão:** branch por feature/correção e Pull Request antes da `main`, que fica protegida contra
  push direto e exige os checks do GitHub Actions. Na criação do repositório remoto, a `main` terá
  somente um README neutro de bootstrap; o código do projeto será publicado primeiro na branch de
  feature e chegará à `main` exclusivamente pelo primeiro Pull Request já protegido. Como o
  repositório local já possui histórico, a branch de feature incorporará explicitamente a `main`
  remota de bootstrap com merge de históricos não relacionados antes de ser publicada, criando a
  ancestralidade comum necessária para o primeiro PR sem levar código diretamente à `main`.

> 💡 Motivo: o PR vira ponto de auto-review, revisão do Codex e validação automática.

### Commits

- **Decisão:** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).

> 💡 Motivo: mantém o histórico compreensível.

### Deploy

- **Decisão:** GitHub Actions executa `npm ci`, lint, typecheck, testes e build em todo Pull Request.
  O Cloudflare Pages, conectado ao GitHub, cria um preview por PR e publica a `main` em produção.
  Migrations e Edge Functions do Supabase são publicadas por workflow separado após merge na `main`.
- A primeira liberação ocorre em duas etapas. O PR `feature/mbj-mvp-core` entrega aplicação, migrations
  e workflows, valida apenas ambiente local/staging/preview e é mesclado sem executar migrations de
  produção. Depois do merge, criar `chore/mbj-production-activation` a partir da `main`: nessa branch
  serão registradas as evidências da ativação do n8n, domínio canônico, monitoramento, backup real,
  migration de produção e smoke tests. Essa branch encerra em um segundo PR operacional com CI e
  auto-review antes do convite dos jogadores.

> 💡 Motivo: separa validação, preview e produção, mantendo todo o fluxo rastreável no GitHub.

### Rollback

- **Decisão:** rollback documentado do webapp; migrations preferencialmente forward-only e restauração
  de backup apenas em incidente de dados.

> 💡 Motivo: código volta rápido, mas reverter banco pode destruir dados novos.

### Definition of Done

- **Decisão:** critérios aceitos, lint/typecheck/testes passando, segurança/RLS revisadas,
  documentação atualizada e preview validado.

> 💡 Motivo: funcionar localmente não comprova o fluxo completo.

### Ambientes

- **Decisão:** três ambientes lógicos: Supabase local para desenvolvimento; um projeto Supabase Free
  de staging com dados fictícios para previews; e outro projeto Supabase Free de produção para os
  jogadores. Cloudflare Pages usa variáveis distintas em Preview e Production.

> 💡 Motivo: testes não podem modificar dados reais do clube.

### Domínio e URLs de publicação

- **Decisão:** validar inicialmente a build de produção em `<projeto>.pages.dev`. Após a primeira
  publicação estável, cadastrar `meiabocajuniors.dbidigital.com.br` como Custom Domain do projeto
  Cloudflare Pages. A `main` continuará sendo a origem de produção; Pull Requests usarão URLs
  temporárias de preview e nunca o subdomínio oficial.
- Se o DNS de `dbidigital.com.br` estiver no Cloudflare, o registro CNAME será criado pelo próprio
  assistente. Se estiver em outro provedor, criar o CNAME `meiabocajuniors` apontando para
  `<projeto>.pages.dev`, somente depois de cadastrar o domínio dentro do Pages.
- Configurar `https://meiabocajuniors.dbidigital.com.br` como Site URL de produção no Supabase Auth.

> 💡 Motivo: o endereço `pages.dev` permite validar o deploy sem mexer no DNS; depois, o subdomínio
> definitivo fornece uma origem estável para autenticação, PWA e Web Push.

### Backup

- **Decisão:** no Supabase Free, sem backup automático gerenciado. O n8n auto-hospedado será o
  orquestrador principal dos backups e exportações agendados: ele dispara e acompanha um workflow
  reutilizável do GitHub Actions executado em runner Windows efêmero, sem depender do sistema
  operacional, das ferramentas ou do acesso ao repositório no host do n8n. O runner instala versões
  fixadas do Supabase CLI e `age`, executa o script PowerShell permitido e remove artefatos temporários
  em texto puro ao finalizar. Comandos CLI executados localmente ficam documentados como contingência.
  O Codex poderá criar, executar sob solicitação e verificar esses comandos, mas não será tratado como
  o agendador permanente do processo.
- Executar exportação ao menos semanalmente e antes de migrations ou mudanças importantes. Manter
  as quatro cópias mais recentes no bucket privado Cloudflare R2 Standard `mbj-backups`. Cada conjunto
  será empacotado e criptografado localmente com `age` antes do upload, verificado remotamente por
  manifesto e SHA-256, e somente então entrará na retenção. Credenciais do Supabase e o token limitado
  ao bucket ficam no ambiente protegido do GitHub; o n8n guarda somente uma credencial GitHub
  fine-grained limitada a disparar e consultar Actions deste repositório. Nenhum valor ou ID de
  credencial aparece no workflow exportado; a chave privada de recuperação fica fora do n8n, GitHub e
  Git. O fluxo deve registrar sucesso/falha, emitir alerta e prever teste de restauração.
- Para correlacionar cada disparo, o n8n envia um `request_id` UUID sem dados pessoais. O workflow usa
  esse identificador no nome da execução e publica por apenas 1 dia um artefato sanitizado
  `backup-result.json`, contendo somente versão do contrato, `request_id`, ID do backup, checksum do
  manifesto, chave não sensível do objeto criptografado, instante de verificação e estado final. O n8n
  localiza a execução pelo `request_id`, exige conclusão bem-sucedida, baixa e valida esse artefato e
  só então confirma o heartbeat. Chamadas reutilizáveis entre workflows recebem os mesmos valores como
  outputs, sem depender do artefato.

> 💡 Motivo: automação reduz o risco de esquecimento sem exigir o plano Pro. Cadência, retenção,
> alerta de falha e teste de restauração evitam que exista apenas uma falsa sensação de segurança.

---

## 8. Testes e qualidade

### Testes automatizados

- **Decisão:** unitários para regras, integração/RLS do Supabase e E2E dos fluxos críticos.

> 💡 Motivo: login, presença, reagendamento, escalação, consolidação e voto precisam ser protegidos.

### Code Review

- **Decisão:** auto-review estruturado e revisão com Codex em todo PR; CI obrigatório.

> 💡 Motivo: checklist e automação compensam parcialmente a ausência de outro desenvolvedor.

### Lint e formatação

- **Decisão:** ESLint + Prettier localmente e no CI.

> 💡 Motivo: o código mantém um único padrão.

### Pagamentos e integrações perigosas

- **Decisão:** pagamentos não se aplicam. Integrações externas usam projetos/chaves de teste separados
  quando disponíveis.

> 💡 Motivo: testes não devem disparar ações reais.

### Acessibilidade

- **Decisão:** WCAG nível AA: contraste, foco, teclado, HTML semântico, leitor de tela e alvos de toque.

> 💡 Motivo: acessibilidade integra a qualidade do produto.

### Feature flags

- **Decisão:** flags simples em tabela/configuração só para funcionalidades de maior risco; sem serviço
  dedicado no MVP.

> 💡 Motivo: oferece controle básico sem adicionar outra plataforma.

---

## 9. Infraestrutura e arquivos

### Uploads

- **Decisão:** Supabase Storage com buckets privados e URLs assinadas quando necessárias.

> 💡 Motivo: integra autenticação/RLS e não mistura arquivos com código.

### Ambiente local

- **Decisão:** scripts documentados para Vite + Supabase CLI; Docker usado pelo Supabase local.

> 💡 Motivo: o ambiente deve ser reproduzível mesmo havendo um único desenvolvedor.

### Monólito ou microsserviços

- **Decisão:** monólito modular no mesmo repositório.

> 💡 Motivo: microsserviços seriam engenharia excessiva para o MVP.

### Funcionamento sem internet

- **Decisão:** offline parcial, somente para ler o último estado conhecido do próximo jogo e da
  escalação ativa. Escritas continuam exigindo conexão e não serão enfileiradas para sincronização.
- Persistir apenas essas queries do TanStack Query em `localStorage`, com chave versionada, prazo de
  validade e limpeza obrigatória no logout ou troca de usuário. Dados pessoais desnecessários não
  entram no cache offline.
- Exibir um indicador visual discreto **“Modo Offline”** quando houver perda de conectividade. A
  detecção considera tanto o estado de rede do navegador quanto falhas reais das requisições.
- Desabilitar proativamente botões e controles de escrita enquanto estiver offline. Ao tentar uma
  ação indisponível, mostrar mensagem amigável explicando que é necessário reconectar.

> 💡 Motivo: mantém informações essenciais disponíveis instantaneamente no vestiário, comunica com
> clareza o estado da conexão e evita chamadas que certamente falhariam, sem assumir a complexidade
> de sincronização e resolução de conflitos offline.

### Atualização de dependências

- **Decisão:** Dependabot, auditoria no CI e revisão manual de versões principais.

> 💡 Motivo: automatiza alertas sem aceitar incompatibilidades às cegas.

### CDN

- **Decisão:** Cloudflare Pages Free para hospedar e distribuir o PWA com CDN/cache versionado;
  fotos continuam sendo entregues pelo Supabase Storage.

> 💡 Motivo: os assets imutáveis de um PWA se beneficiam diretamente de CDN.

### Limitação aceita do plano gratuito

- **Decisão:** aceitar que o projeto Supabase Free pode pausar após um período prolongado sem uso e
  ser reativado manualmente pelo responsável.

> 💡 Motivo: os jogadores normalmente acessarão o sistema duas ou três vezes por semana. Durante
> férias ou intervalos do calendário, uma eventual reativação manual é aceitável para este MVP.

---

## 10. Tempo real e rotinas

### Atualizações em tempo real

- **Decisão:** Supabase Realtime apenas nas telas que precisam refletir alterações administrativas.

> 💡 Motivo: a comissão vê respostas de presença sem recarregar.

### Webhooks de terceiros

- **Decisão:** somente se uma integração futura exigir; nenhum é obrigatório no MVP.

> 💡 Motivo: não cria endpoints sem consumidor real.

### Tarefas agendadas

- **Decisão:** Supabase Cron/rotinas agendadas para notificações, janelas e manutenção que não possam
  ser calculadas no acesso.

> 💡 Motivo: prazos não podem depender de alguém abrir o painel.

---

## 11. Dados, métricas e conhecimento

### Histórico de cliques e telas

- **Decisão:** sem analytics comportamental; somente métricas operacionais de presença e notificações.

> 💡 Motivo: basta para os critérios de sucesso e reduz coleta de dados.

### Robôs e raspadores

- **Decisão:** RLS nos dados privados e rate limit em login, convites e Edge Functions.

> 💡 Motivo: conteúdo autenticado também precisa de proteção contra abuso.

### Refatoração

- **Decisão:** melhoria contínua ao tocar no código; reescrita total só com justificativa.

> 💡 Motivo: mantém o ritmo do projeto e evita trabalho sem valor funcional.

### Fator ônibus

- **Decisão:** README completo, este documento, migrations e instruções de operação no repositório.

> 💡 Motivo: o projeto não pode existir somente na memória do desenvolvedor.

### Analytics e privacidade

- **Decisão:** sem rastreamento comportamental ou publicidade. Política de privacidade informa os dados
  pessoais e esportivos necessários ao funcionamento.

> 💡 Motivo: transparência ainda é necessária mesmo sem cookies de marketing.

---

## 12. Internacionalização e localização

### Idiomas

- **Decisão:** somente português do Brasil; textos centralizados por módulo, sem biblioteca completa
  de i18n no MVP.

> 💡 Motivo: reduz escopo sem espalhar mensagens duplicadas pelo código.

### Datas, moedas e fuso

- **Decisão:** timestamps em UTC no PostgreSQL e exibição `pt-BR` em `America/Sao_Paulo`.

> 💡 Motivo: evita erros em prazos, partidas e votação.

---

## 13. Comunicação com o usuário

### E-mails transacionais

- **Decisão:** não haverá envio de e-mails no MVP, inclusive para recuperação de senha.

> 💡 Motivo: convites e recuperação serão administrados pelo Presidente.

### Separação de e-mail transacional e marketing

- **Decisão:** não aplicável; nenhum dos dois será enviado.

> 💡 Motivo: não existe canal de e-mail nesta fase.

### Avisos fora do app

- **Decisão:** Web Push via OneSignal com consentimento. Sem permissão/suporte, o webapp funciona e
  destaca pendências na tela inicial. O app OneSignal de produção será configurado somente para
  `https://meiabocajuniors.dbidigital.com.br`; push fica desativado nos previews.

> 💡 Motivo: atende à especificação. No iPhone, o Web Push pode exigir a instalação do PWA na tela inicial.

---

## 14. Pagamentos e recorrência

### Gateway de pagamento

- **Decisão:** não aplicável ao MVP.

### Cobrança recorrente

- **Decisão:** não aplicável ao MVP.

### Falha de cobrança

- **Decisão:** não aplicável ao MVP.

### Testes de pagamento

- **Decisão:** não aplicável ao MVP.

### Reembolsos e chargebacks

- **Decisão:** não aplicável ao MVP.

> 💡 Motivo da seção: o aplicativo é de uso interno do time e não processará dinheiro.

---

## 15. Inteligência Artificial e LLMs

### Modelo e provedor

- **Decisão:** não aplicável ao MVP.

### Prompts do sistema

- **Decisão:** não aplicável ao MVP.

### Custos de tokens

- **Decisão:** não aplicável ao MVP.

### Dados enviados à IA

- **Decisão:** nenhum dado de usuário será enviado a modelos de IA pelo produto.

### Indisponibilidade de API de IA

- **Decisão:** não aplicável ao MVP.

> 💡 Motivo da seção: Codex e SpecKit auxiliam o desenvolvimento, mas IA não é uma funcionalidade
> do aplicativo e não recebe dados dos usuários em produção.

---

## Resumo executivo

O MVP será um PWA responsivo em React/TypeScript, mantido em repositório público no GitHub, validado
por GitHub Actions, hospedado no Cloudflare Pages Free e integrado ao Supabase Free. A produção usará
`https://meiabocajuniors.dbidigital.com.br`. O sistema atenderá somente ao Meia Boca Juniors, com
autenticação por convite, e-mail e senha; RBAC + RLS; 2FA administrativo; Web Push com fallback visual;
cache offline persistido somente para leitura; e métricas operacionais calculadas no PostgreSQL. A
identidade visual será parametrizada para permitir futuras implantações White-Label em instâncias
separadas, sem introduzir multi-tenancy no MVP. Pagamentos, e-mails, analytics comportamental,
múltiplos idiomas, SaaS e IA ficam fora do escopo. O custo incremental mensal previsto é R$ 0; os
backups externos serão criptografados por um runner efêmero do GitHub Actions, orquestrados pelo n8n
auto-hospedado já disponível e retidos em bucket privado Cloudflare R2, com rotina CLI documentada como
contingência e apoio do Codex para criação e verificação. UptimeRobot Free monitorará a URL canônica e
o heartbeat semanal do backup.
