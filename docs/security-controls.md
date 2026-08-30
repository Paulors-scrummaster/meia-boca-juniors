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

| Ambiente   | Project ref público      | Signup aberto |   Limite | Teste 429 | Dados usados            |
| ---------- | ------------------------ | ------------: | -------: | --------- | ----------------------- |
| staging    | pendente de autenticação |      pendente | pendente | pendente  | somente fictícios       |
| production | pendente de autenticação |      pendente | pendente | pendente  | nenhuma identidade real |

O teste registra apenas timestamp UTC, ambiente, status HTTP `429`, código estável `RATE_LIMITED` e
trace ID técnico. Não registrar endereço IP, e-mail, request body, headers de autenticação ou payload
do provedor.

## Cloudflare Pages

- Preview usa exclusivamente variáveis públicas do Supabase staging.
- Service role e secrets das Edge Functions nunca entram no browser/Pages.
- CSP restringe script externo ao SDK OneSignal aprovado e conexões aos provedores necessários.
- `frame-ancestors 'none'`, HSTS, `nosniff`, no-referrer e Permissions Policy reduzem superfície.
- API/Auth Supabase nunca entram no cache do Service Worker.
- Domínio canônico, variáveis produtivas e redirects permanecem bloqueados até T178.
