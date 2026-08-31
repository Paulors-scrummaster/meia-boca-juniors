# Validação pré-release — T175

Data: 2026-08-31. Alvos produtivos e usuários reais não foram utilizados. A T175 permanece aberta
porque não houve navegador interativo nem identidades de teste autenticáveis para todas as jornadas
staging.

## Local

- [x] Formatação, lint, TypeScript, bindings gerados e build de produção aprovados.
- [x] 107 testes unitários aprovados, incluindo Auth, redaction/Sentry, cache offline e contratos dos
      workflows de backup/release/n8n.
- [x] Supabase local reinicializado com 26 migrations e seed exclusivamente fictício.
- [x] Lint do banco aprovado e 353 testes SQL de constraints, RLS e RPC aprovados em 18 arquivos.
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
      instalação/atualização PWA e preservação de formulário no deployment do novo head. Título,
      canonical, teclado/foco, contraste, alvos de toque e preservação do formulário durante o prompt
      de atualização passaram em desktop e mobile no preview; falta instalar a PWA real e repetir no
      deployment que contém a correção hospedada descoberta abaixo.
- [ ] Inspecionar Cache Storage e rede no preview para confirmar ausência de Auth/Data API e ausência
      de inicialização OneSignal produtiva. **Bloqueio:** exige navegador interativo; a configuração
      sanitizada do Pages confirmou `VITE_ONESIGNAL_APP_ID` vazio no escopo Preview.

## Staging e outros cenários não produtivos

- [x] O preview aponta somente para o ref público staging `lqkybvqnppxxehiriunq`; as 25 migrations e
      o seed fictício foram aplicados sem drift posterior; signup está fechado; `profiles` rejeita
      acesso anônimo; e o Auth produziu HTTP 429 real na 31ª tentativa sintética. A tabela RAG alheia
      ao MBJ não foi acessada.
- [ ] Executar jornadas reais de convite, MFA, papéis, RLS, Storage privado, Realtime, notificações e
      redaction no staging. Uma identidade `.invalid` autenticável foi criada manualmente, vinculada a
      um perfil `PRESIDENT` fictício e confirmou login, cadastro TOTP, AAL2 e acesso a `/app/admin`.
      A consulta do Coach fictício encontrou um defeito real: a role existente era exibida desmarcada
      porque a UI usava a política self-only. A correção adiciona `get_user_roles`, negada para Atleta,
      Técnico, Presidente AAL1 e Presidente desativado; 353 testes SQL e a aplicação da 26ª migration
      no staging passaram, sem reaplicar seed. Falta revalidar o preview corrigido e executar as demais
      jornadas hospedadas; nenhum convite real foi enviado.
- [ ] Validar redaction/erro controlado no Sentry staging. **Bloqueio:** integração staging não
      configurada: a consulta sanitizada do Pages confirmou ausência de `VITE_SENTRY_DSN` no Preview.
      Nenhum valor de DSN foi lido e nenhum evento foi simulado.

### Cenários pós-merge diferidos

R2/n8n não são pré-requisitos de T175: T177 importa e testa o workflow somente depois que T176 o
publicar em `main`; T179 verifica backup e release production; T180 valida UptimeRobot/alertas; T181
executa a aceitação exclusivamente produtiva. Nenhum desses cenários foi antecipado.

## Resultado

Os controles locais e HTTP públicos possíveis foram executados. T175 não recebe `[X]`: faltam os
cenários hospedados reais descritos acima. Nenhuma evidência foi simulada.
