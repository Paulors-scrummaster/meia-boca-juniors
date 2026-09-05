# Ativação de produção do MBJ

## Marco de implementação — T176

Data: 2026-09-01.

- Pull Request de implementação: `#183` (`feature/mbj-mvp-core` → `main`).
- Head revisado da implementação: `f65f7d7683d0dfc46738cd9617e761c5164c149a`.
- Merge commit em `main`: `8f4ce45e625ad47b60abe7f5728e0fc19233bdf4`.
- Branch de ativação criada e publicada a partir desse merge:
  `chore/mbj-production-activation`.
- Os checklists de requisitos, segurança e pré-release estavam completos; os dois conjuntos de
  frontend, banco, jornadas de navegador e gate `Required`, além do Cloudflare Pages, passaram no
  head revisado antes do merge.
- A auto-revisão assistida foi registrada no PR. O único achado final, espaços em branco ao fim de
  três linhas de documentação, foi corrigido no próprio head e toda a validação passou novamente.

O merge entregou somente a implementação e as definições operacionais. Nenhum workflow de backup ou
database release foi disparado, nenhuma migration foi aplicada em production e nenhum recurso de
OneSignal, R2 ou n8n foi configurado ou acionado. A ativação operacional permanece restrita às
T177–T181 e deve ser registrada nesta branch antes do segundo Pull Request.

## T179 — Backup de produção: diagnóstico de `DATABASE_SCHEMA_EXPORT_FAILED`

Data: 2026-09-05. Status: **em andamento; backup de produção ainda não verificado. T179 permanece
aberta.**

### Contexto

O backup verificado da T177 rodou com sucesso (`VERIFIED`) contra o Supabase **staging**
`lqkybvqnppxxehiriunq` (run GitHub `33640922116`, commit `8946735`). O mesmo script
`scripts/backup/export-supabase.ps1` falhou com `DATABASE_SCHEMA_EXPORT_FAILED` ao ser apontado para
o Supabase **production** `sclxmrondkegopyokdym` (`us-east-1`, `ACTIVE_HEALTHY`, ainda sem as 25
migrations). Correções já aplicadas pelo operador antes deste diagnóstico: Network Restrictions do
projeto production, reset da senha do banco, atualização de `SUPABASE_DB_URL` (environment `backup`) e
de `SUPABASE_DB_PASSWORD` (environment `production-release`); Session Pooler em `5432` com usuário
`postgres.sclxmrondkegopyokdym`.

### Causa provável

`DATABASE_SCHEMA_EXPORT_FAILED` era um código genérico: `Invoke-NativeChecked` enviava **todo** o
stderr do `pg_dump` para `Write-Verbose` (oculto por padrão) e lançava apenas o código genérico, sem
distinguir falha de conexão, de autenticação, de host ou de versão. Todas as tentativas anteriores da
cadeia de backup (`aws cli`, session pooler, roles sem Docker) foram correções às cegas por causa
disso.

Revisão estática do script contra as boas práticas de Supabase/Postgres identificou **um problema de
configuração concreto** além da opacidade do erro:

1. **Host do pooler fixado.** `Get-BackupDatabaseUrl` só aceitava o host literal
   `aws-0-us-east-1.pooler.supabase.com`. A frota de poolers do Supabase é dependente de região e de
   capacidade no momento da criação do projeto (`aws-0-<região>`, `aws-1-<região>`, …). Um projeto
   production criado em 2026-08-31 pode estar em `aws-1-us-east-1.pooler.supabase.com`. Nesse caso:
   - se `SUPABASE_DB_URL` fosse a URI real do Session Pooler (`aws-1-…`), o script lançaria
     `DATABASE_URL_HOST_REJECTED` — não `DATABASE_SCHEMA_EXPORT_FAILED`;
   - se `SUPABASE_DB_URL` fosse a **conexão direta** (`db.<ref>.supabase.co`), o script reescrevia o
     host silenciosamente para `aws-0-us-east-1…`; conectar ao pooler errado faz o pooler recusar o
     tenant e o `pg_dump` sair com erro → `DATABASE_SCHEMA_EXPORT_FAILED`. Este é o cenário mais
     consistente com o sintoma observado.
2. **Conexão direta é IPv6-only.** `db.<ref>.supabase.co` não tem rota IPv4 a partir de runners
   hospedados no GitHub; por isso o Session Pooler (IPv4, `5432`) é obrigatório, não opcional.
3. **Senha na URL precisa ser percent-encoded.** A senha vive entre `:` e `@` na URI. Uma senha
   recém-resetada com `@`, `/`, `#`, `?` ou `:` quebra o parsing e resulta em falha de autenticação
   mascarada. Preferir senha apenas alfanumérica ou `@`→`%40` etc.
4. **Restrições de rede não podem allowlistar runners do GitHub.** O egress de `windows-2025` é amplo
   e dinâmico; a única configuração válida é Network Restrictions **desabilitado / liberar tudo**
   (`0.0.0.0/0` e `::/0`), não um CIDR específico.

### Alterações aplicadas nesta rodada (código, sem novo disparo de backup)

`scripts/backup/export-supabase.ps1`:

- `Get-BackupDatabaseUrl` agora aceita **qualquer** host de Session Pooler
  `^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$` na porta `5432`, mantendo a exigência de usuário
  `postgres.<project-ref>`. A reescrita da conexão direta usa `SUPABASE_DB_POOLER_HOST` quando
  presente (validado contra o mesmo padrão) e cai no host histórico `aws-0-us-east-1…` por
  compatibilidade.
- O Transaction Pooler (`6543`) é rejeitado explicitamente com
  `DATABASE_URL_TRANSACTION_POOLER_REJECTED` (o `pg_dump` exige sessão).
- `Invoke-NativeChecked` classifica o stderr contra uma lista estática de frases neutras e anexa a
  categoria ao código lançado (ex.: `DATABASE_SCHEMA_EXPORT_FAILED:POOLER_TENANT_OR_USER_NOT_FOUND`,
  `:PASSWORD_AUTHENTICATION_FAILED`, `:CONNECTION_FAILED`, `:PG_HBA_NO_ENTRY`,
  `:HOST_NAME_RESOLUTION_FAILED`, `:SERVER_VERSION_MISMATCH`, `:NO_MATCHING_TABLES`). Só o token fixo
  é preservado; nenhuma linha de conexão, credencial ou URL é ecoada.

Testes: `npm run test:unit -- src/operations/backup-automation.test.ts` (12/12) e verificação de
parsing/execução das funções alteradas.

### Verificações pendentes antes do próximo disparo (somente o operador tem acesso)

1. No dashboard Supabase do projeto `sclxmrondkegopyokdym` → Project Settings → Database → Connection
   string → **Session pooler**: confirmar o host exato e a porta `5432`. Definir `SUPABASE_DB_URL`
   (environment `backup`) **exatamente** com essa URI (`postgresql://postgres.sclxmrondkegopyokdym:<senha-encoded>@<host-do-dashboard>:5432/postgres`),
   não a conexão direta e não o Transaction Pooler (`6543`).
2. Confirmar que a senha embutida em `SUPABASE_DB_URL` é a **senha atual** (o reset foi posterior?) e
   está **percent-encoded**, e que `SUPABASE_DB_PASSWORD` (environment `production-release`) tem o
   mesmo valor.
3. Confirmar Network Restrictions do projeto production = liberar tudo (`0.0.0.0/0` + `::/0`).
4. Confirmar a versão de Postgres do projeto production ≤ 17.6 (versão fixada do `pg_dump` no
   workflow). Se for maior, subir a versão fixada em `.github/workflows/backup.yml`.
5. Reexecutar `MBJ verified backup` a partir de `main` com um `request_id` UUID novo. Se falhar, o
   código agora traz a categoria da falha — anexar aqui e tratar a causa específica (sem novo disparo
   às cegas).

### Tentativa 2026-09-05 15:23 UTC — ainda falha

Após o operador confirmar no dashboard: Session Pooler `aws-0-us-east-1.pooler.supabase.com:5432`,
database `postgres`, usuário `postgres.sclxmrondkegopyokdym`, `SUPABASE_DB_URL` atualizado com a senha
nova e Network Restrictions liberadas.

- Run: GitHub Actions `33974310437`, `request_id` `2d7ea5ae-523d-436c-a3a8-938f10f6e599`, a partir de
  `main` (`8946735`).
- Etapas `Install pinned database and R2 clients`, `Install pinned age`, `Verify locked backup tool
versions` passaram (pg_dump 17.6 / aws-cli 2.28.8 / age 1.3.2 confirmados).
- Etapa `Export, encrypt, upload, verify, and retain` falhou com
  `MBJ backup failed [DATABASE_SCHEMA_EXPORT_FAILED]` **3,5 s** após o início da etapa — ou seja,
  ~2 s de execução real do `pg_dump`. É uma **rejeição imediata de conexão**, não timeout nem dump
  lento.
- A classificação sanitizada de stderr adicionada nesta branch **ainda não está em `main`**, então o
  run trouxe apenas o código genérico. Log bruto não expõe stderr do `pg_dump` (o script envia tudo
  para `Write-Verbose`, suprimido).

Causas prováveis para falha de conexão em ~2 s, em ordem de aderência ao sintoma:

1. **Senha em `SUPABASE_DB_URL` incorreta ou sem percent-encoding.** Se a senha nova contém
   `@ / : ? # % [ ]`, colada crua na URI, o parser trunca/corrompe a credencial → o pooler responde
   `FATAL: password authentication failed` em ~1 s. Também cobre secret salvo com espaço/quebra de
   linha ao final ou não efetivamente salvo.
2. **`FATAL: Tenant or user not found`** do pooler — usuário na URI diferente de
   `postgres.sclxmrondkegopyokdym` exato, ou pooler não habilitado para esse usuário.
3. **`no pg_hba.conf entry` / connection refused** — restrição de rede ainda ativa ou host IPv6-only
   (não é o caso aqui: pooler é IPv4).

Para identificar a causa exata sem expor credenciais é necessário a classificação sanitizada de
stderr rodando em `main`.

### Tentativas 2026-09-05 16:07–16:24 UTC — mesma falha

O operador identificou que, após o último reset, `SUPABASE_DB_PASSWORD` fora atualizado no
environment `production-release` mas `SUPABASE_DB_URL` do environment `backup` (o secret que o backup
consome) ainda tinha a senha antiga; regravou `SUPABASE_DB_URL` do `backup` com Session Pooler,
`aws-0-us-east-1.pooler.supabase.com:5432`, database `postgres`, usuário
`postgres.sclxmrondkegopyokdym` e a mesma senha atual do banco / `SUPABASE_DB_PASSWORD`.

Runs após a regravação, todos a partir de `main`, todos `DATABASE_SCHEMA_EXPORT_FAILED` com a mesma
assinatura de ~1,6–2 s (rejeição imediata):

| Run           | request_id                                                                  |
| ------------- | --------------------------------------------------------------------------- |
| `33976641456` | `840e2d79-6cfd-421e-b213-c9575a611a55`                                      |
| `33976885049` | `edde5f95-6ed0-4c82-97fe-540c81b6d016`                                      |
| `33977511869` | `56cc807b-8c3a-459c-a288-030e3dc9f1b1` (tentativa única após aguardar 60 s) |

Próximo passo definido: consultar `supavisor_logs` do projeto `sclxmrondkegopyokdym` via Supabase MCP
para ler o motivo real da rejeição. Sem novo disparo e sem alterar secrets enquanto o motivo não for
confirmado. Se for `password authentication failed`, seguir com o PR dedicado da classificação
sanitizada de stderr para `main` antes de qualquer nova tentativa.

`.github/workflows/database-release.yml`, migrations de produção, Edge Functions e smoke checks
**não** foram executados. T180–T182 não foram iniciadas.

## T179 — Concluída: release de produção aplicada e verificada

Data: 2026-09-05. Status: **T179 fechada.** `database-release.yml` executado a partir de `main` com
sucesso de ponta a ponta.

### Evidência da execução verde

- Run GitHub Actions `33988696969`, a partir de `main` (`78f0130`). Os três jobs (`request`,
  `verified-backup`, `release`) e todos os seus steps concluíram com sucesso.
- Backup verificado que liberou o gate:
  - `backup_id` `d4528873e32a4d698d332ee3c9f88689` (32 hex)
  - `manifest_sha256` `eb47f84460f7d3da7222cc29ef8122352a3a9e127e4aa33bccf74895564af8f5` (64 hex)
  - `verification_status` `VERIFIED`
- Sequência do job `release`: gate → dry run (`supabase db push --linked --dry-run`) → aplicação
  (`supabase db push --linked`) → lint (`supabase db lint --linked --fail-on error`, com
  `No schema errors found` nos schemas `extensions`, `private` e `public`) → smoke da Data API.
- Confirmação independente via Supabase MCP (somente leitura): 27 migrations registradas em
  `supabase_migrations.schema_migrations` — as 25 de `20260825*` (`foundation` …
  `notification_reminders`) mais `20260831000100 admin_role_lookup` e
  `20260901000100 allow_avatar_insert_returning`. Schema `public` com 21 tabelas, RLS habilitada em
  todas, `allowed_formations` semeada com 4 linhas.

### Causa raiz da falha de conexão diagnosticada nas tentativas anteriores

Os `supavisor_logs` do projeto confirmaram o que as seções acima não conseguiam distinguir: o
`SUPABASE_DB_URL` do environment `backup` autenticava normalmente, enquanto o `SUPABASE_DB_PASSWORD`
do environment `production-release` produzia `FATAL: password authentication failed` (`SQLSTATE
28P01`) no pooler. Eram dois secrets distintos, e apenas o segundo estava incorreto — hipótese
principal: valor colado ainda percent-encoded, extraído do trecho de senha da própria URI. O operador
regravou `SUPABASE_DB_PASSWORD` com a senha real decodificada, igual à embutida em `SUPABASE_DB_URL`.

### Correções de código necessárias para fechar a T179

Cinco defeitos, cada um mascarado pelo anterior, todos com PR isolado a partir de `origin/main` e
teste em `src/operations/backup-automation.test.ts`:

| PR     | Defeito                                                                                                                                                                                                                                                               | Por que só apareceu nesta execução                                                                                          |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `#192` | O gate usava `!=` sob `shell: pwsh`, que é `ParserError` em PowerShell (`-ne`); o script abortava antes de avaliar qualquer condição. O teste de contrato afirmava a forma inválida, fixando o defeito.                                                               | Primeira execução real de `database-release.yml`.                                                                           |
| `#193` | `$ErrorActionPreference = 'Stop'` promove a primeira linha de stderr de tool nativo sob `2>&1` a `NativeCommandError` terminante, antes da checagem de `$LASTEXITCODE`. Mascarava o código classificado e derrubava o backup em _warning_ de `pg_dump` com exit zero. | Pré-migration o `pg_dump` cobria só `auth`/`storage` e ficava silencioso.                                                   |
| `#194` | `Get-StorageEntries` e `Export-Storage` chamavam `Invoke-RestMethod`/`Invoke-WebRequest` sem `try/catch`; qualquer falha HTTP virava exceção crua sob o `BACKUP_FAILED` genérico. O `catch` externo não reportava estágio nem stack.                                  | O crawl de storage só passou a executar após a criação do bucket.                                                           |
| `#195` | Bucket existente **e vazio**: a listagem retorna `[]`, `Invoke-RestMethod` entrega `$null`, e `@($null)` é um array de um elemento nulo — `Set-StrictMode -Version Latest` então torna `$entry.name` um `RuntimeException` fatal.                                     | O bucket `athlete-avatars` foi criado por migration em `2026-09-05 18:47:57Z`; antes o caminho era sempre "bucket ausente". |
| `#196` | O smoke da Data API sondava a raiz do PostgREST (`/rest/v1/`), que o Supabase serve apenas a chaves _secret_, portando somente a chave publishable.                                                                                                                   | A variável `SUPABASE_URL` não existia, então o step falhava antes por URI vazia.                                            |

O diagnóstico de estágio adicionado em `#194` (`stage=`, tipo da exceção, mensagem e
`$_.ScriptStackTrace`, todos passados por um scrub de segredos linha a linha) foi o que permitiu
localizar `#195` em uma única execução, em vez de mais uma rodada às cegas.

### Configuração de CI ajustada

- Criada a variável `SUPABASE_URL` no environment `production-release`
  (`https://sclxmrondkegopyokdym.supabase.co`). Não existia; o step de smoke montava a URI com valor
  vazio e falhava com `Invalid URI: The hostname could not be parsed`.
- `SUPABASE_DB_PASSWORD` (environment `production-release`) regravado pelo operador, conforme a causa
  raiz acima. Nenhum valor de secret foi lido, exibido ou registrado por esta sessão.

### Posture da Data API após a release

Com a chave publishable, nenhum endpoint do PostgREST responde `200` — as migrations não concedem
nada ao papel `anon`. O comportamento observado em produção é o esperado e passou a ser o que o smoke
verifica:

| Situação                         | Resposta                         |
| -------------------------------- | -------------------------------- |
| Tabela migrada, `anon` sem grant | `401` + código PostgREST `42501` |
| Tabela inexistente               | `404` + `PGRST205`               |
| Data API fora do ar              | `5xx` ou falha de transporte     |

### Observação de segurança registrada, não bloqueante

O advisor do Supabase reporta RLS desabilitada em `private.rate_limit_counters`,
`private.identity_command_results` e `private.command_results`. O schema `private` não está exposto na
Data API (apenas `public` e `graphql_public`), portanto não há exposição real ao papel `anon`; as
tabelas são de uso interno das funções. Registrado aqui porque o advisor continuará reportando.

### Escopo não executado

T180 (UptimeRobot), T181 (aceitação de produção) e T182 (PR operacional) **não** foram iniciadas.
