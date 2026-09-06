# Evidências operacionais

Este documento registra somente identificadores operacionais não sensíveis. Chaves, tokens, URLs com
credenciais, payloads de backup e dados pessoais não devem ser copiados para este arquivo.

## T177 — Orquestração de backup no n8n

Status: **aprovado em staging; ativado em produção na T180** (ver seção T180).

### Configuração segura

- Instância: `https://labworkflow.dbidigital.com.br/`
- Workflow: `MBJ verified backup orchestrator`
- Workflow ID: `VdI3a4KywhCSemU9` (reimportado do repositório; o ID `oIdZumg59fEUKDYP` usado nos
  testes de T177 pertence agora ao workflow receptor separado — ver "Topologia atual do n8n" na
  seção T180)
- Estado durante os testes: inativo
- Credencial n8n: `MBJ GitHub Actions`, limitada a `api.github.com`
- Token GitHub: fine-grained, restrito ao repositório `Paulors-scrummaster/meia-boca-juniors`,
  com Actions read/write e Metadata read-only
- GitHub Environment: `backup`, limitado a branches protegidas
- Alvo da validação: Supabase staging `lqkybvqnppxxehiriunq`
- R2: bucket privado `mbj-backups`, credencial restrita a Object Read & Write nesse bucket
- Identidade privada `age`: mantida fora de Git, GitHub e n8n; somente o recipient público está no
  environment `backup`
- Heartbeat/alerta durante T177: endpoints HTTP sintéticos temporários; substituídos na T180 pelo
  monitor UptimeRobot HTTP/keyword e por `.github/workflows/backup-freshness.yml` (ver seção T180)

### Evidências executadas

| Cenário                                | Evidência segura                               | Resultado                                                                                                                      |
| -------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Incompatibilidade inicial do Code node | n8n `2877`                                     | Falhou antes do dispatch porque `crypto` não era global; fallback UUID v4 aplicado ao workflow importado e ao JSON versionado. |
| Falha da execução GitHub               | n8n `2878`; GitHub run `33608576626`           | A correlação em `main` funcionou e `RUN_FAILURE` percorreu o ramo fail-closed, produzindo um único alerta sanitizado.          |
| Run ambíguo                            | n8n `2879`                                     | Mock com dois runs equivalentes em `main` retornou `RUN_CORRELATION_AMBIGUOUS` no ramo de erro.                                |
| Sucesso                                | n8n `2886`; GitHub run `33640922116`           | `VERIFIED` no commit `8946735`; correlação, artifact, upload privado, readback, checksum, retenção e cleanup aprovados.        |
| Timeout                                | teste automatizado `backup-automation.test.ts` | `RUN_POLL_TIMEOUT`. O relógio reutilizado pelo editor do n8n tornou o mock visual inadequado como evidência.                   |
| Artefato ausente/expirado              | teste automatizado `backup-automation.test.ts` | `RESULT_ARTIFACT_MISSING_OR_EXPIRED`.                                                                                          |
| Request divergente                     | teste automatizado `backup-automation.test.ts` | `RESULT_CORRELATION_MISMATCH`.                                                                                                 |
| Resultado malformado                   | teste automatizado `backup-automation.test.ts` | `RESULT_JSON_MALFORMED`.                                                                                                       |
| Resultado não verificado               | teste automatizado `backup-automation.test.ts` | `RESULT_NOT_VERIFIED`.                                                                                                         |

Comando reproduzível: `npm run test:unit -- src/operations/backup-automation.test.ts` — 12 testes
aprovados em 2026-09-02.

### Evidência final sanitizada

- Request ID: `bd1cdb24-cdcf-488e-965e-87bb04997ba6`
- Backup ID: `cbe40278bf864700839eeaebece54cac`
- Manifest SHA-256: `7693fb251b1f40ce1eb8e1f3daf9ff0d1be55097f947ceae0ee387256c671982`
- Objeto privado: `backups/2026/09/cbe40278bf864700839eeaebece54cac.age`
- Verificado em: `2026-09-02T14:21:39Z`
- CI pós-merge: GitHub run `33640446488`, aprovado

O artefato sanitizado foi validado e removido da máquina local após a leitura. O workflow permaneceu
inativo e com endpoints sintéticos temporários, que serão substituídos na T180. Nenhuma migração ou
configuração de produção foi executada.

## T180 — Monitoramento externo e ativação de produção

Status: **concluído**. Monitor de disponibilidade e verificação de frescor do backup em operação; a
correção do orquestrador foi validada por uma execução `VERIFIED` em produção e o agendamento semanal
foi ativado.

### Topologia atual do n8n

- Instância: `https://labworkflow.dbidigital.com.br/`
- Orquestrador: `MBJ verified backup orchestrator`, ID `VdI3a4KywhCSemU9` (reimportado do
  repositório; substitui o ID `oIdZumg59fEUKDYP` citado na seção T177)
- Receptor de alerta: workflow separado, ID `oIdZumg59fEUKDYP`, contendo apenas um Webhook trigger
  que recebe o payload `MBJ_BACKUP_FAILED`. O nó de entrega ao operador (Evolution API/WhatsApp)
  ainda não existe e é responsabilidade do dono, fora do escopo deste lote.
- Agendamento: semanal, segundas-feiras às 03:00 (timezone da instância n8n)
- Trigger pré-migração: webhook autenticado `mbj-backup-pre-migration`

### Monitor de disponibilidade (UptimeRobot Free)

- Tipo: HTTP/keyword, intervalo de 5 minutos
- Alvo: `https://meiabocajuniors.dbidigital.com.br/`
- Keyword monitorada: `Meia Boca Juniors` (presença)
- Alertas: e-mail do dono do projeto
- Estado após criação: `Up`

### Verificação de frescor do backup

O plano Free do UptimeRobot deixou de oferecer monitores de heartbeat/cron, então a ausência de
backup é coberta por `.github/workflows/backup-freshness.yml` em `main`: um job agendado diariamente
(12:00 UTC) que falha quando a run `success` mais recente de `backup.yml` em `main` está ausente ou
tem mais de 192 h. A falha aciona a notificação nativa "workflow run failed" do GitHub para o dono.
Não substitui o alerta interno do orquestrador; cobre o caso em que o agendamento semanal do n8n
nunca dispara.

| Cenário                 | Evidência segura         | Resultado                                                     |
| ----------------------- | ------------------------ | ------------------------------------------------------------- |
| Frescor OK              | GitHub run `33995476467` | `PASS` — backup recente dentro do limite                      |
| Backup ausente/obsoleto | GitHub run `33995494312` | `FAIL` — notificação "workflow run failed" recebida pelo dono |

### Payload de alerta sanitizado

O nó `Send success heartbeat` foi removido. `Build sanitized failure` produz apenas um objeto com 15
campos allowlistados (`event`, `schemaVersion`, `source`, `severity`, `title`, `occurredAt`,
`trigger`, `stage`, `code`, `remediationHint`, `requestId`, `runId`, `runUrl`, `repository`,
`n8nExecutionId`, `summary`) e o entrega ao webhook do operador (config de instância; endpoint HTTPS
com token, nunca versionado). Nenhuma resposta de provedor, segredo ou conteúdo de backup é incluído.
Commit `858a1fd` no branch `chore/mbj-production-activation`.

### Correção do download de artefato

O nó único `Download exact artifact` seguia o 302 do GitHub para o Azure Blob Storage reenviando o
header `Authorization` do GitHub, que o Azure rejeita com `401 InvalidAuthenticationInfo`. Foi
dividido em `Resolve artifact URL` (credencial `MBJ GitHub Actions`, redirects desligados, resposta
completa, never-error — captura o `headers.location`) e `Download artifact zip` (sem autenticação,
resposta em arquivo `data`). Ambos falham fechado para `Build sanitized failure`. Aplicado na
instância (`VdI3a4KywhCSemU9`) e em `ops/n8n/backup-workflow.json` (commit `9ac683b`).

### Incidente: loop de webhook (mitigado, não-destrutivo)

Entre ~2026-09-06 00:16 e 00:57 UTC, o nó de alerta de falha entregava o payload a um webhook que
reentrava no próprio trigger pré-migração do orquestrador (mesmo path), formando um loop que disparou
cerca de nove backups de produção não planejados (`backup.yml` runs `33998524921`…`34002386008`).
Todas terminaram `VERIFIED` e não-destrutivas; a retenção continuou mantendo quatro conjuntos. O loop
foi quebrado desativando o orquestrador e movendo o receptor de alerta para um workflow separado
(ID `oIdZumg59fEUKDYP`), sem trigger que reentre no orquestrador.

### Execução verificada em produção

- n8n execution ID: `2906` (manual, a partir de `Weekly schedule`)
- Janela: `2026-09-06T11:06:18Z` – `2026-09-06T11:11:24Z`
- GitHub run: `34029273889` (`workflow_dispatch` em `main`, `success`, 4m31s)
- Request ID: `67e47f6e-9407-4776-8e14-83e756e7e82e`
- Backup ID: `235b55f087dd42259783a903d89c086f`
- Manifest SHA-256: `19a2d30c29da0734712c244189e154169a62bc877d08a4d0e79d140ba6039fc2`
- Verificado em: `2026-09-06T11:10:46Z`
- `Resolve artifact URL` retornou HTTP 302 com `headers.location`; `Download artifact zip` baixou o
  zip sem 401; o ramo `Build sanitized failure` / `Send failure alert` não executou.

### Ativação

Após a execução verificada, `VdI3a4KywhCSemU9` foi marcado como **Active**, habilitando o agendamento
semanal. Nenhuma migração ou outra configuração de produção foi executada neste lote.
