# Evidências operacionais

Este documento registra somente identificadores operacionais não sensíveis. Chaves, tokens, URLs com
credenciais, payloads de backup e dados pessoais não devem ser copiados para este arquivo.

## T177 — Orquestração de backup no n8n

Status: **aprovado em staging; workflow mantido inativo até T180**.

### Configuração segura

- Instância: `https://labworkflow.dbidigital.com.br/`
- Workflow: `MBJ verified backup orchestrator`
- Workflow ID: `oIdZumg59fEUKDYP`
- Estado durante os testes: inativo
- Credencial n8n: `MBJ GitHub Actions`, limitada a `api.github.com`
- Token GitHub: fine-grained, restrito ao repositório `Paulors-scrummaster/meia-boca-juniors`,
  com Actions read/write e Metadata read-only
- GitHub Environment: `backup`, limitado a branches protegidas
- Alvo da validação: Supabase staging `lqkybvqnppxxehiriunq`
- R2: bucket privado `mbj-backups`, credencial restrita a Object Read & Write nesse bucket
- Identidade privada `age`: mantida fora de Git, GitHub e n8n; somente o recipient público está no
  environment `backup`
- Heartbeat/alerta durante T177: endpoints HTTP sintéticos temporários; substituir pelos endpoints
  UptimeRobot reais em T180 antes de ativar o agendamento

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
