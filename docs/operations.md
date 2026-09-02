# Evidências operacionais

Este documento registra somente identificadores operacionais não sensíveis. Chaves, tokens, URLs com
credenciais, payloads de backup e dados pessoais não devem ser copiados para este arquivo.

## T177 — Orquestração de backup no n8n

Status: **em validação; não aprovado para produção**.

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
| Sucesso                                | teste automatizado `backup-automation.test.ts` | Contrato `VERIFIED`, request/run IDs, checksum, object key e timestamp aceitos. Validação real pendente da correção em `main`. |
| Timeout                                | teste automatizado `backup-automation.test.ts` | `RUN_POLL_TIMEOUT`. O relógio reutilizado pelo editor do n8n tornou o mock visual inadequado como evidência.                   |
| Artefato ausente/expirado              | teste automatizado `backup-automation.test.ts` | `RESULT_ARTIFACT_MISSING_OR_EXPIRED`.                                                                                          |
| Request divergente                     | teste automatizado `backup-automation.test.ts` | `RESULT_CORRELATION_MISMATCH`.                                                                                                 |
| Resultado malformado                   | teste automatizado `backup-automation.test.ts` | `RESULT_JSON_MALFORMED`.                                                                                                       |
| Resultado não verificado               | teste automatizado `backup-automation.test.ts` | `RESULT_NOT_VERIFIED`.                                                                                                         |

Comando reproduzível: `npm run test:unit -- src/operations/backup-automation.test.ts` — 12 testes
aprovados em 2026-09-02.

### Gate pendente

O runner `windows-2025` passou a incluir AWS CLI `2.36.29`. O workflow pinado em `2.28.8` falhou
porque Chocolatey recusou instalar uma versão anterior. A branch de ativação acrescenta
`--allow-downgrade`, preservando o pin. T177 só pode ser marcada como concluída depois que essa
correção estiver em `main`, um backup staging real terminar como `VERIFIED` e os IDs finais forem
registrados aqui. Nenhuma migração ou configuração de produção foi executada.
