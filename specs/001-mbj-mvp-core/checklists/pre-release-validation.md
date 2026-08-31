# Validação pré-release — T175

Data: 2026-08-31. Alvos produtivos e usuários reais não foram utilizados. A T175 permanece aberta
porque não houve navegador interativo nem identidades de teste autenticáveis para todas as jornadas
staging.

## Local

- [x] Formatação, lint, TypeScript, bindings gerados e build de produção aprovados.
- [x] 106 testes unitários aprovados, incluindo Auth, redaction/Sentry, cache offline e contratos dos
      workflows de backup/release/n8n.
- [x] Supabase local reinicializado com 25 migrations e seed exclusivamente fictício.
- [x] Lint do banco aprovado e 348 testes SQL de constraints, RLS e RPC aprovados em 18 arquivos.
- [x] Os 28 cenários Playwright passaram em Chromium desktop e mobile: acessibilidade, Auth/convite,
      resposta 429, elenco, partidas/presença, escalação, estatísticas/MVP, avisos/notificações,
      privacidade offline e orçamento de desempenho.
- [x] O comando Playwright encerrou com sucesso e sem intervenção: 28/28 cenários aprovados em
      Chromium desktop/mobile, resumo emitido em 59,0 s e exit code 0. O `LOCAL-E2E-001` era uma
      limitação do executor restrito no Windows: o Playwright não recebia permissão para finalizar
      sua própria árvore Vite com `taskkill`. A mesma execução fora dessa restrição encerrou
      normalmente, sem mudança no código, assim como os dois jobs equivalentes no runner Linux.

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
- [x] No head de implementação `5405e28`, Cloudflare Pages e os dois conjuntos de gates `Required`, frontend,
      banco e Playwright foram aprovados; as cinco rotas públicas foram novamente consultadas com
      HTTP 200 e MIME esperado.
- [ ] Confirmar visualmente título/canonical, navegação por teclado, foco, contraste, touch targets,
      instalação/atualização PWA e preservação de formulário no deployment do novo head. **Bloqueio:**
      nenhum navegador interativo estava conectado.
- [ ] Inspecionar Cache Storage e rede no preview para confirmar ausência de Auth/Data API e ausência
      de inicialização OneSignal produtiva. **Bloqueio:** exige navegador interativo.

## Staging e outros cenários não produtivos

- [x] O preview aponta somente para o ref público staging `lqkybvqnppxxehiriunq`; as 25 migrations e
      o seed fictício foram aplicados sem drift posterior; signup está fechado; `profiles` rejeita
      acesso anônimo; e o Auth produziu HTTP 429 real na 31ª tentativa sintética. A tabela RAG alheia
      ao MBJ não foi acessada.
- [ ] Executar jornadas reais de convite, MFA, papéis, RLS, Storage privado, Realtime, notificações e
      redaction no staging. **Pendente:** T165 está completa, mas não foram criadas credenciais de
      identidades fictícias autenticáveis nem enviados convites reais.
- [ ] Validar redaction/erro controlado no Sentry staging. **Bloqueio:** integração staging não
      configurada/confirmada; nenhum evento foi simulado.

### Cenários pós-merge diferidos

R2/n8n não são pré-requisitos de T175: T177 importa e testa o workflow somente depois que T176 o
publicar em `main`; T179 verifica backup e release production; T180 valida UptimeRobot/alertas; T181
executa a aceitação exclusivamente produtiva. Nenhum desses cenários foi antecipado.

## Resultado

Os controles locais e HTTP públicos possíveis foram executados. T175 não recebe `[X]`: faltam os
cenários hospedados reais descritos acima. Nenhuma evidência foi simulada.
