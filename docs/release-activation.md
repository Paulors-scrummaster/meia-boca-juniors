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
