# Automação de backup pelo n8n

Este diretório contém somente uma definição sanitizada e inativa. A importação, associação de
credenciais e execução real pertencem à T177, depois que os workflows estiverem em `main`. Nenhum ID
ou valor de credencial deve ser adicionado ao JSON exportado.

## Fronteira de execução

O n8n orquestra agenda semanal, disparo pré-migração autenticado, correlação, polling, heartbeat e
alerta. Ele não clona o repositório, não executa PowerShell e não recebe acesso a Supabase, R2 ou à
chave privada `age`. O runner efêmero `windows-2025` do GitHub Actions instala as versões fixadas,
executa `scripts/backup/export-supabase.ps1`, criptografa antes do upload e limpa plaintext em
`finally`.

```text
n8n -> GitHub Actions em main -> Supabase staging/production -> age -> R2 privado
  \-> valida execução + artefato sanitizado -> heartbeat ou alerta
```

## Credencial GitHub mínima

Criar dentro de **n8n Credentials**, nunca no workflow exportado, uma credencial fine-grained limitada
ao repositório `Paulors-scrummaster/meia-boca-juniors`. Ela precisa apenas:

- Actions: `Read and write` para disparar o workflow e consultar runs/artefatos;
- Metadata: `Read` implícito;
- nenhum acesso a Contents write, Administration, Issues, Pull Requests, Secrets ou outros
  repositórios.

Associar essa credencial manualmente a todos os nós HTTP GitHub depois da importação. O webhook de
pré-migração também deve receber autenticação por header em uma credencial separada. O workflow deve
continuar inativo até que ambas estejam associadas e os testes negativos de T177 passem.

## Ambiente protegido `backup`

O job reutilizável usa o GitHub Environment `backup`, com aprovação quando aplicável, contendo apenas:

| Tipo | Nome | Finalidade |
| --- | --- | --- |
| secret | `SUPABASE_DB_URL` | conexão do alvo selecionado pelo environment |
| secret | `SUPABASE_SERVICE_ROLE_KEY` | download do bucket privado allowlisted |
| secret | `AGE_RECIPIENT` | chave pública de criptografia, nunca a identidade privada |
| secret | `R2_ACCOUNT_ID` | construção do endpoint S3 allowlisted |
| secret | `R2_ACCESS_KEY_ID` | credencial limitada ao bucket |
| secret | `R2_SECRET_ACCESS_KEY` | credencial limitada ao bucket |
| variable | `SUPABASE_PROJECT_REF` | ref público allowlisted do alvo |
| variable | `MBJ_BACKUP_ENVIRONMENT` | `staging` ou `production` |

O token R2 deve possuir somente Object Read & Write no bucket privado `mbj-backups`; não deve poder
criar/excluir buckets, alterar domínio, CORS, lifecycle, Workers, DNS ou WAF. O bucket e a credencial
não são provisionados por este lote porque o acesso R2 ainda não foi autorizado.

## Correlação e validação fail-closed

1. O n8n gera um UUID aleatório sem PII e dispara `backup.yml` com `ref=main`.
2. Consulta somente runs desse workflow e aceita exatamente um com nome `MBJ backup <request_id>`,
   branch `main`, evento `workflow_dispatch` e janela temporal atual.
3. Faz polling limitado. Zero, múltiplos, timeout, cancelamento ou conclusão diferente de `success`
   seguem para alerta.
4. Exige exatamente um artefato `backup-result-<request_id>` ainda válido e baixa somente esse.
5. Valida todos os campos de `backup-result.json` conforme
   `specs/001-mbj-mvp-core/contracts/backup-automation.md`.
6. Somente `VERIFIED`, com request/run correspondentes, checksum válido, chave sob `backups/` e
   timestamp da execução, pode confirmar sucesso e enviar heartbeat.

O artefato tem retenção de um dia e não contém dump, manifesto, objeto Storage, signed URL, log,
credencial ou dado pessoal.

## Retenção, heartbeat e alerta

O script do runner mantém as quatro cópias criptografadas verificadas mais recentes e só remove uma
quinta depois do upload atual passar por `HeadObject` e readback SHA-256. O heartbeat do UptimeRobot é
enviado pelo n8n apenas depois da validação do artefato. Toda condição fail-closed usa o webhook de
falha configurado em `MBJ_BACKUP_FAILURE_WEBHOOK_URL` e nunca inclui resposta do provedor, segredo ou
conteúdo do backup.

Variáveis n8n esperadas, configuradas fora do export:

- `MBJ_BACKUP_HEARTBEAT_URL`;
- `MBJ_BACKUP_FAILURE_WEBHOOK_URL`.

## Contingência local

Se n8n estiver indisponível, um responsável autorizado pode disparar manualmente `backup.yml` em
`main` e validar o artefato de um dia. Uma execução local do script requer os mesmos clientes e
segredos em uma sessão temporária; deve usar somente o project ref aprovado, nunca imprimir variáveis,
e deve terminar confirmando que não restou plaintext. A contingência não autoriza criar R2, ampliar
permissões ou usar dados de produção em desenvolvimento.

## Ativação posterior (T177)

Após o merge, importar `backup-workflow.json`, associar credenciais e testar: sucesso, timeout,
correlação ambígua, run cancelado/falho, artefato ausente/expirado, request/run divergente, JSON
malformado, chave fora da allowlist e estado não verificado. Registrar somente IDs técnicos e
resultados sanitizados em `docs/operations.md`.
