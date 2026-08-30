# Contribuindo com o MBJ

## Fluxo de branch e Pull Request

- crie branches `feature/*`, `fix/*`, `docs/*` ou `chore/*` a partir da base correta;
- nunca envie commits de projeto diretamente para `main` nem force-push em branch protegida;
- mantenha commits pequenos, em inglês, e limitados ao escopo aprovado;
- abra Pull Request para `main`, resolva conversas e aguarde o check agregado `Required`;
- faça auto-review estruturada assistida pelo Codex, registrando achados e correções no PR;
- não faça merge com checklist, CI, preview ou evidência obrigatória incompleta.

## Liberação em duas etapas

1. O PR de implementação entrega código, migrations e definições operacionais; valida local, staging e
   preview, mas não executa migrations de production.
2. Depois do merge, `chore/mbj-production-activation` nasce da `main` atualizada. Essa branch registra
   a ativação real de n8n, R2, domínio, monitoramento, backup, migration e smoke tests em um segundo PR.

Convites reais só podem ocorrer após o segundo PR, os testes de produção e a aprovação do responsável.

## Definition of Done

- requisitos e contratos satisfeitos sem ampliar escopo;
- formatação, lint, TypeScript, unidades, banco/RLS/RPC, E2E e build aprovados conforme o risco;
- autorização validada por solicitação direta, não apenas por controles visuais;
- acessibilidade, privacidade, cache offline e logs revisados;
- documentação e tipos gerados atuais;
- preview conferido quando houver impacto web;
- backup verificado antes de migration crítica;
- auto-review do PR concluída e worktree limpo.

## Proibições de segredo e dados

Nunca versionar ou publicar:

- `.env`, senha, token, cookie, convite, `service_role`, secret key, chave privada `age` ou credencial
  de Supabase, R2, GitHub, n8n, OneSignal, Sentry ou UptimeRobot;
- URL de banco contendo credenciais, signed URL ou resposta bruta de provedor;
- dump, backup, manifesto plaintext, objeto Storage, dados ou identidade de jogador real;
- ID/valor de credencial n8n em exports;
- logs com e-mail, IP, nome, justificativa, Authorization ou payload sensível.

Use somente seed e identidades fictícias fora de production. Segredos pertencem aos stores aprovados;
evidências no repositório devem conter apenas IDs técnicos públicos, checksums e códigos seguros.

## Banco e ambientes

- toda mudança de schema usa migration SQL versionada e retrocompatível;
- staging, preview e local nunca apontam para production;
- restauração usa alvo isolado e cleanup obrigatório;
- workflows de backup/release executam somente de `main` e falham fechados;
- nenhum contribuinte cria recursos externos ou amplia permissões sem autorização explícita.
