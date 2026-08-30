# Verificação de restauração de backup

Esta é a rotina mensal para verificar um conjunto já marcado como `VERIFIED`. A primeira restauração
real depende do provisionamento autorizado de R2 e pertence à ativação pós-merge; este documento não é
evidência de que ela já ocorreu.

## Isolamento obrigatório

- usar máquina/runner temporário e alvo local ou staging vazio, nunca production;
- confirmar por project ref que o alvo não é production antes de qualquer importação;
- não restaurar em um projeto que contenha dados externos ao MBJ;
- manter rede, arquivos temporários e logs restritos ao operador autorizado;
- obter a identidade privada `age` diretamente da custódia de recuperação, fora de GitHub e n8n;
- apagar dumps, objetos e identidade temporária em `finally`, inclusive após falha.

## Procedimento mensal

1. Selecionar a cópia verificada mais recente sem modificar a retenção.
2. Baixar do prefixo privado `backups/yyyy/mm/`, conferir o SHA-256 criptografado e descriptografar em
   diretório temporário isolado.
3. Recalcular o SHA-256 de `manifest.json` e de cada arquivo; qualquer divergência encerra o teste.
4. Criar/restabelecer um alvo vazio com versão PostgreSQL compatível.
5. Aplicar `schema-migrations/`, restaurar roles compatíveis e carregar os dumps allowlisted de schema
   e dados. Não aplicar comandos destrutivos a outro ambiente.
6. Recriar somente o bucket privado `athlete-avatars` no alvo isolado e carregar seus objetos.
7. Executar lint, testes de constraints/RLS/RPC e smoke reads com identidades fictícias.
8. Apagar incondicionalmente todo plaintext e destruir o alvo temporário quando a evidência estiver
   registrada.

## Limites de continuidade do Auth

O dump preserverva registros allowlisted de Auth, mas não garante continuidade transparente de
sessões, refresh tokens, MFA/TOTP, chaves JWT, SMTP, secrets de Edge Functions ou configuração do
Dashboard no projeto de destino. Após recuperação real, revogar sessões, reconfigurar secrets por
secret store, validar MFA dos administradores e emitir novas credenciais/convites quando necessário.
Nunca documentar hashes, e-mails, fatores MFA, tokens ou payloads de Auth.

## Evidência sanitizada

Registrar uma linha por teste, sem nomes, e-mails, justificativas, URLs assinadas ou caminhos locais:

| Campo            | Valor permitido                                          |
| ---------------- | -------------------------------------------------------- |
| mês UTC          | `YYYY-MM`                                                |
| backup ID        | identificador opaco de 32 hex                            |
| manifest SHA-256 | 64 hex minúsculos                                        |
| alvo             | `local-isolado` ou ref público de staging autorizado     |
| duração          | minutos inteiros                                         |
| tabelas          | contagem agregada por tabela MBJ allowlisted             |
| Auth             | `VALIDADO_COM_LIMITES` ou código de falha seguro         |
| avatar           | object key técnico allowlisted + SHA-256, sem signed URL |
| testes           | quantidade aprovada/falha e link técnico do run/defeito  |
| cleanup          | `CONFIRMADO`                                             |

### Registro

| Mês      | Backup              | Manifesto | Alvo     | Duração | Row counts | Auth     | Avatar checksum | Testes   | Cleanup  |
| -------- | ------------------- | --------- | -------- | ------: | ---------- | -------- | --------------- | -------- | -------- |
| pendente | pendente de R2/T177 | pendente  | pendente |       — | pendente   | pendente | pendente        | pendente | pendente |

Falha de checksum, restauração, RLS ou cleanup bloqueia mudanças destrutivas e deve acionar o alerta
operacional. Nunca transformar este template em evidência sem executar a restauração.
