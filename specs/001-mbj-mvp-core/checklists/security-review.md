# Revisão de segurança e privacidade — T174

Data da revisão: 2026-08-31. Esta checklist registra somente evidência técnica sanitizada. A revisão
local e os controles hospedados pré-merge de T165 foram verificados sem leitura de valores secretos.

## Banco, papéis e superfícies expostas

- [x] As 21 tabelas `public` foram inventariadas e exercitadas por constraints/RLS: `profiles`,
      `user_roles`, `athletes`, `audit_logs`, `athlete_invites`, `notification_events`,
      `notification_deliveries`, `seasons`, `matches`, `match_presences`,
      `presence_justifications`, `allowed_formations`, `lineups`, `lineup_players`,
      `match_consolidations`, `match_goals`, `mvp_voting_rounds`, `mvp_votes`, `mvp_awards`,
      `notices` e `push_subscriptions`.
- [x] Todas as tabelas `public` têm RLS habilitada e grants explícitos; os testes negativos cobrem
      acesso anônimo, atleta, técnico, presidente, AAL2 e conta inativa conforme aplicável.
- [x] As tabelas internas `private.command_results`, `private.identity_command_results` e
      `private.rate_limit_counters` não são expostas pela Data API e têm privilégios revogados.
- [x] As dez views foram revisadas: `next_match_view`, `roster_presence_view`,
      `staff_attendance_view`, `published_lineup_view`, `season_rankings_view` e
      `open_mvp_voting_view` usam `security_invoker`; `notification_delivery_metrics`,
      `pending_action_metrics`, `notification_dispatch_health` e `notification_failure_metrics`
      aplicam barreira de segurança, papel e AAL2 explicitamente.
- [x] Realtime contém somente `matches`, `match_presences`, `lineups` e `notices`; a autorização
      continua sendo aplicada pelas políticas das tabelas.
- [x] O bucket privado é fixado em `athlete-avatars`; caminhos aceitos seguem
      `athletes/<uuid>/avatar.webp`, sem listagem/download genérico nem signed URL em logs.

## RPCs e funções

- [x] As 28 RPCs públicas foram revisadas e exercitadas conforme o papel: `accept_athlete_invitation`,
      `admin_set_presence`, `anonymize_athlete`, `cancel_match`, `cast_mvp_vote`,
      `claim_notification_deliveries`, `close_mvp_voting`, `complete_admin_password_reset`,
      `complete_forced_password_change`, `complete_notification_delivery`, `consolidate_match`,
      `consume_identity_rate_limit`, `create_athlete`, `create_exceptional_call`,
      `create_identity_invite`, `create_match`, `publish_lineup`, `publish_notice`,
      `reactivate_match`, `record_identity_invite_resend`, `reopen_match_statistics`,
      `reschedule_match`, `respond_to_call`, `revoke_identity_invite`, `set_athlete_status`,
      `set_match_callups`, `set_user_role` e `update_athlete`.
- [x] As 24 funções privadas/trigger helpers foram inventariadas: `append_audit_log`,
      `append_identity_audit_for_actor`, `assert_service_identity_actor`, `audit_role_change`,
      `claim_notification_deliveries`, `close_expired_mvp_voting`,
      `complete_notification_delivery`, `consume_rate_limit`, `current_session_is_aal2`,
      `current_user_is_active`, `enqueue_notification`, `generate_attendance_reminders`,
      `guard_lineup_membership`, `guard_lineup_revision`,
      `guard_match_consolidation_immutability`, `has_any_role`, `has_role`, `payload_is_safe`,
      `reject_audit_log_mutation`, `reject_statistics_history_mutation`,
      `require_president_aal2`, `require_staff_aal2`, `validate_consolidation_goal_count` e
      `validate_match_presence_integrity`.
- [x] Funções `security definer` fixam `search_path = ''`, qualificam objetos e não concedem execução
      ampla por acidente; wrappers de serviço exigem identidade técnica e/ou segredo apropriado.
- [x] As Edge Functions `athlete-invitations`, `admin-reset-password`, `push-identity` e
      `dispatch-notifications` fazem autorização no código, validação de origem, rate limit e
      respostas sanitizadas; `verify_jwt = false` não é tratado como autorização.

## Logs, cache e dados pessoais

- [x] `audit_logs` é append-only, tem payload allowlisted/redigido e rejeita mutação direta.
- [x] O adaptador Sentry do frontend e o helper das Edge Functions removem e-mail, IP, nomes,
      Authorization, cookies, tokens, URLs assinadas e payloads antes do envio; Replay não é usado.
- [x] O cache offline persiste somente snapshots allowlisted de próxima partida e escalação
      publicada, separa deployment/usuário/aba, expira dados e limpa no logout.
- [x] Auth permanece no armazenamento próprio do cliente Supabase; caches/PWA não interceptam Auth,
      Data API, Storage ou Realtime e mutações offline não são enfileiradas/reexecutadas.
- [x] A preferência local de push registra apenas negação booleana, sem identificador pessoal.

## Secrets e deployment

- [x] Varredura do repositório não encontrou valor de senha, token, chave privada, service role,
      database URL com credencial, dump, manifesto plaintext ou ID de credencial n8n versionado.
- [x] Workflows novos usam apenas nomes de secrets/variables, permissões mínimas, refs protegidas,
      ações e ferramentas fixadas; o resultado publicado é allowlisted e tem retenção de um dia.
- [x] Preview e staging estão documentados como não produtivos; o preview tem `noindex`, CSP, HSTS,
      `nosniff`, anti-frame e Permissions Policy observados por HTTPS público.
- [x] Staging e production usam refs Supabase distintos; o preview contém somente o ref staging; e o
      ambiente GitHub `production-release`, limitado a `main` e sem bypass administrativo, contém a
      variável/ref production e os três nomes de secrets exigidos. Valores não foram lidos; o usuário
      confirmou a inserção direta dos valores production no secret store, e os refs/chaves públicas
      específicas de projeto permanecem separados por ambiente.

### Controles pós-merge diferidos

Os itens abaixo foram revisados como contratos/código, mas a verificação operacional real não integra
o gate de T174: o plano de duas etapas exige que os workflows existam primeiro em `main` por T176.

- T177 confirmará no ambiente protegido `backup` o recipient público `age`, a credencial R2 limitada
  ao bucket `mbj-backups` e a credencial fine-grained/webhook do n8n.
- T179 verificará o backup real e o gate de checksum antes de qualquer migration production.
- T180 verificará heartbeat e alertas reais. Nenhum desses recursos foi antecipado nesta revisão.

## Evidência executada

- `npm run db:reset`: 25 migrations e seed fictício aplicados localmente.
- `npm run db:lint`: nenhum erro de schema.
- `npm run test:db`: 18 arquivos, 348 testes aprovados.
- `npm run test:unit`: 27 arquivos, 106 testes aprovados.
- `npm run lint`, `npm run typecheck`, `npm run db:types:check` e `npm run build`: aprovados.
- `npm run test:e2e`: os 28 cenários chegaram ao fim em desktop/mobile sem o warning React corrigido,
  mas o runner não encerrou sozinho; ver `LOCAL-E2E-001` na checklist de pré-release.
- GitHub no head `5405e28`: dois conjuntos de `Required`, frontend, banco e Playwright aprovados;
  Cloudflare Pages aprovado.

Conclusão: T174 está completa para o gate pré-merge. R2, n8n, backup/release e monitoramento reais
continuam deliberadamente diferidos para T177–T180.
