# Validação pré-release — T175

Data: 2026-08-30. Alvos produtivos, usuários reais e recursos externos não foram utilizados. A T175
permanece aberta porque staging depende da T165 e porque não houve navegador interativo, R2 ou n8n
autorizados/disponíveis para os cenários reais.

## Local

- [x] Formatação, lint, TypeScript, bindings gerados e build de produção aprovados.
- [x] 104 testes unitários aprovados, incluindo Auth, redaction/Sentry, cache offline e contratos dos
      workflows de backup/release/n8n.
- [x] Supabase local reinicializado com 25 migrations e seed exclusivamente fictício.
- [x] Lint do banco aprovado e 348 testes SQL de constraints, RLS e RPC aprovados em 18 arquivos.
- [x] Os 28 cenários Playwright passaram em Chromium desktop e mobile: acessibilidade, Auth/convite,
      resposta 429, elenco, partidas/presença, escalação, estatísticas/MVP, avisos/notificações,
      privacidade offline e orçamento de desempenho.
- [ ] O comando Playwright encerra com sucesso sem intervenção. **Defeito `LOCAL-E2E-001`:** após o
      28º teste aprovado, o runner permaneceu aberto sem resumo/exit code e foi interrompido; durante
      alguns cenários também houve warnings React de atualização de `ConnectedOfflineStatus` durante
      renderização. Não corrigido porque está fora de T167–T175. Os dois jobs equivalentes no runner
      Linux do GitHub encerraram normalmente e foram aprovados.

## Feature preview público

- [x] `GET /` e acesso direto a `GET /app/matches` retornaram HTTP 200 com HTML SPA.
- [x] `manifest.webmanifest` retornou HTTP 200 e `application/manifest+json`.
- [x] `sw.js` e `push/onesignal/OneSignalSDKWorker.js` retornaram HTTP 200 e JavaScript, sem fallback
      HTML.
- [x] Respostas observadas com HSTS, CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`,
      `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, Permissions Policy e
      `X-Robots-Tag: noindex`.
- [x] O check Cloudflare Pages do novo head `eef0967` foi aprovado; após o deploy, as cinco rotas
      públicas acima foram novamente consultadas e retornaram HTTP 200 com MIME esperado.
- [ ] Confirmar visualmente título/canonical, navegação por teclado, foco, contraste, touch targets,
      instalação/atualização PWA e preservação de formulário no deployment do novo head. **Bloqueio:**
      nenhum navegador interativo estava conectado.
- [ ] Inspecionar Cache Storage e rede no preview para confirmar ausência de Auth/Data API e ausência
      de inicialização OneSignal produtiva. **Bloqueio:** exige navegador interativo.

## Staging e outros cenários não produtivos

- [ ] Confirmar que o preview aponta somente para o ref público staging `lqkybvqnppxxehiriunq`, com
      dados fictícios, convite fechado e throttling Auth produzindo 429 real. **Bloqueio:** T165 não
      concluiu configuração/validação hospedada; a tabela RAG alheia ao MBJ não foi acessada.
- [ ] Executar jornadas reais de convite, MFA, papéis, RLS, Storage privado, Realtime, notificações e
      redaction no staging. **Bloqueio:** depende da T165; nenhum convite real foi enviado.
- [ ] Executar upload/readback/retenção criptografada no R2 e restauração isolada. **Bloqueio:** R2
      não autorizado/provisionado; nenhuma credencial, bucket ou objeto foi criado.
- [ ] Importar e testar os ramos de sucesso/falha do workflow n8n. **Bloqueio:** ativação e
      credenciais pertencem à T177; o JSON permaneceu inativo e sanitizado.
- [ ] Validar Sentry staging, heartbeat UptimeRobot e alertas reais. **Bloqueio:** integrações externas
      não configuradas/confirmadas por T165/T177.

## Resultado

Os controles locais e HTTP públicos possíveis foram executados. T175 não recebe `[X]`: faltam
cenários hospedados reais e o encerramento limpo da suíte E2E. Nenhuma evidência foi simulada.
