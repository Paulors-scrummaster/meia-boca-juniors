# Controles de segurança

## Monitoramento e privacidade

- Sentry habilita somente em staging/produção quando existe DSN.
- `sendDefaultPii` permanece falso e Session Replay não é instalado; amostras de Replay são zero.
- Tracing usa amostragem baixa: 10% em staging e 5% em produção.
- `beforeSend` remove authorization, cookies, tokens, convites, e-mails, nomes, justificativas,
  motivos, IP e parâmetros/fragmentos de URL.
- Usuários são identificados somente por UUID técnico; papel e trace ID são tags controladas.
- Edge Functions criam escopo por requisição, capturam erro sanitizado e limitam flush a dois segundos.
- Falha no Sentry nunca bloqueia o fluxo principal.
- Source maps são enviados pelo SHA do deployment, apagados após upload e proibidos no artefato público.

## Supabase Auth hospedado

Configuração obrigatória, separadamente em staging e production:

- signup aberto desativado;
- acesso somente por convite administrativo;
- `sign_in_sign_ups = 30` por janela de cinco minutos/IP;
- staging contém apenas identidades fictícias;
- production permanece sem jogadores até concluir T179/T181;
- 429 mapeado para `RATE_LIMITED` sem e-mail, IP, token ou detalhe do provedor.

### Evidência sanitizada T165

| Ambiente   | Project ref público    | Signup aberto |          Limite | Teste 429          | Dados usados                    |
| ---------- | ---------------------- | ------------: | --------------: | ------------------ | ------------------------------- |
| staging    | `lqkybvqnppxxehiriunq` |           não | 30 por 5 min/IP | HTTP 429 observado | identidade sintética `.invalid` |
| production | `sclxmrondkegopyokdym` |           não | 30 por 5 min/IP | não repetido       | nenhuma identidade              |

O teste registra apenas timestamp UTC, ambiente, status HTTP `429`, código estável `RATE_LIMITED` e
trace ID técnico. Não registrar endereço IP, e-mail, request body, headers de autenticação ou payload
do provedor.

Evidência final de staging em 2026-08-31: projeto `Manager01` ativo/saudável em `us-east-1`; signup
fechado confirmado pelo endpoint público de configuração; 30 respostas HTTP 422 sem criação de
usuário e HTTP 429 na 31ª tentativa controlada às `2026-08-31T01:20:47.7664083Z`. O endereço sintético
e os corpos das requisições não foram registrados. As 25 migrations e o seed exclusivamente fictício
foram aplicados, o dry-run posterior ficou sem drift, `public.profiles` rejeitou acesso anônimo com
HTTP 401 e as quatro Edge Functions ficaram ativas. Nenhuma tabela alheia ao MBJ foi consultada.

Evidência production em 2026-08-31: projeto separado `sclxmrondkegopyokdym` ativo/saudável em
`us-east-1`; dry-run confirmou as 25 migrations e seed ainda pendentes; Auth foi configurado
manualmente com signup fechado e limite 30/5 min; zero usuários; e nenhum workflow foi executado. O
ambiente protegido GitHub `production-release` restringe deployments a `main`, desabilita bypass
administrativo e contém `SUPABASE_PROJECT_REF` mais os nomes `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DB_PASSWORD` e `SUPABASE_PUBLISHABLE_KEY`. Valores não foram visualizados ou registrados. O
HTTP 429 real não foi repetido em production vazio; a evidência controlada permanece a de staging.

## Cloudflare Pages

- Preview usa exclusivamente variáveis públicas do Supabase staging.
- Service role e secrets das Edge Functions nunca entram no browser/Pages.
- CSP restringe script externo ao SDK OneSignal aprovado e conexões aos provedores necessários.
- `frame-ancestors 'none'`, HSTS, `nosniff`, no-referrer e Permissions Policy reduzem superfície.
- API/Auth Supabase nunca entram no cache do Service Worker.
- Domínio canônico, variáveis produtivas e redirects permanecem bloqueados até T178.
