# Validação pré-release — T175

Data: 2026-08-31. Alvos produtivos e usuários reais não foram utilizados. O navegador interativo e
identidades exclusivamente sintéticas permitiram validar as jornadas hospedadas de Auth, MFA,
papéis, convite e ciclo de vida do atleta descritas abaixo. A T175 permanece aberta porque os demais
cenários staging ainda não foram executados integralmente.

## Local

- [x] Formatação, lint, TypeScript, bindings gerados e build de produção aprovados.
- [x] 109 testes unitários aprovados, incluindo Auth, redaction/Sentry, cache offline e contratos dos
      workflows de backup/release/n8n.
- [x] Supabase local reinicializado com 26 migrations e seed exclusivamente fictício.
- [x] Lint do banco aprovado e 353 testes SQL de constraints, RLS e RPC aprovados em 18 arquivos.
- [x] Os 28 cenários Playwright passaram em Chromium desktop e mobile: acessibilidade, Auth/convite,
      resposta 429, elenco, partidas/presença, escalação, estatísticas/MVP, avisos/notificações,
      privacidade offline e orçamento de desempenho.
- [x] O CI final expôs uma dependência temporal no cenário MVP: o encerramento fictício fixado em
      31/08/2026 já havia passado e, corretamente, desabilitava o botão de voto. A falha foi
      reproduzida localmente e o relógio exclusivamente simulado foi movido para um instante futuro
      estável; o cenário afetado passou em desktop e mobile e a suíte completa voltou a 28/28.
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
- [x] Confirmar visualmente título/canonical, navegação por teclado, foco, contraste, touch targets,
      instalação/atualização PWA e preservação de formulário no deployment do novo head. Título,
      canonical, teclado/foco, contraste, alvos de toque e preservação do formulário durante o prompt
      de atualização passaram em desktop e mobile no preview. Após o deploy corrigido, o prompt
      atualizou o bundle e a PWA foi instalada e aberta em janela standalone, com título MBJ, sessão
      preservada, navegação e grid desktop corretos.
- [x] Inspecionar Cache Storage e rede no preview para confirmar ausência de Auth/Data API e ausência
      de inicialização OneSignal produtiva. A inspeção manual do único cache Workbox encontrou nove
      entradas, todas assets estáticos same-origin (HTML, CSS, JavaScript, manifesto, logo, favicon,
      ícone PWA e worker isolado), sem Supabase, `/auth/v1`, `/rest/v1`, `/storage/v1` ou OneSignal.
      A configuração sanitizada do Pages confirmou `VITE_ONESIGNAL_APP_ID` vazio no Preview; após
      recarga autenticada, o filtro `onesignal` da aba Network retornou zero correspondências enquanto
      as requisições normais do app foram observadas.

## Staging e outros cenários não produtivos

- [x] O preview aponta somente para o ref público staging `lqkybvqnppxxehiriunq`; as 25 migrations e
      o seed fictício foram aplicados sem drift posterior; signup está fechado; `profiles` rejeita
      acesso anônimo; e o Auth produziu HTTP 429 real na 31ª tentativa sintética. A tabela RAG alheia
      ao MBJ não foi acessada.
- [ ] Executar jornadas hospedadas de convite, MFA, papéis, RLS, Storage privado, Realtime,
      notificações e redaction no staging. Uma identidade `.invalid` autenticável foi vinculada a um
      perfil `PRESIDENT` fictício e confirmou login, cadastro TOTP, AAL2 e acesso a `/app/admin`. A
      consulta do Coach fictício encontrou um defeito real: a role existente era exibida desmarcada
      porque a UI usava a política self-only. A correção adicionou `get_user_roles`, negada para
      Atleta, Técnico, Presidente AAL1 e Presidente desativado; 353 testes SQL e a aplicação da 26ª
      migration no staging passaram, sem reaplicar seed. No commit `2baff66`, os nove checks do GitHub
      e o deploy Cloudflare passaram; após atualizar o PWA, a consulta hospedada exibiu somente
      `COACH` marcado. A role foi removida e restaurada pela UI, com mensagens de sucesso; a
      verificação agregada confirmou uma atribuição ativa e exatamente dois eventos sanitizados de
      auditoria.

      Os controles de convite foram então exercitados apenas com atletas e endereços `.invalid`. O
      teste encontrou e corrigiu três defeitos hospedados: o preflight da Edge Function não permitia
      `apikey` (`1170728`), o redirect de Auth não chegava à rota de ativação (`b2690b1`) e a renovação
      de convite pendente gerava um link do tipo incorreto, imediatamente inválido (`2d8df1c`). Após
      o último deploy, a renovação alterou o link, preservou o redirect allowlisted e abriu
      imediatamente `/convite` com a identidade confirmada, sem parâmetros de erro ou exposição do
      token nos registros desta checklist.

      Uma conta Atleta sintética foi ativada por convite e acessou `/app/athlete` sem MFA. A adição do
      papel Técnico redirecionou a mesma sessão para `/mfa`, confirmando a exigência administrativa;
      a remoção dos papéis e a inativação do atleta preservaram o histórico esportivo. O convite de
      renovação foi revogado e o segundo atleta sintético também foi inativado. Uma consulta final
      limitada retornou somente quatro booleanos verdadeiros: papel único da conta Presidente de
      recuperação, dois atletas inativos, convite revogado e identidade revogada desabilitada. A
      senha perdida da primeira conta Presidente sintética exigiu uma substituta: ela recebeu somente
      `PRESIDENT`, concluiu MFA/AAL2, e a conta anterior teve o papel removido e foi bloqueada até
      2126. Faltam as verificações hospedadas integrais de matriz RLS, Storage privado, Realtime,
      notificações e redaction; nenhum usuário real foi convidado e nenhum segredo, UUID ou link de
      convite foi registrado.
- [ ] Validar redaction/erro controlado no Sentry staging. **Bloqueio:** integração staging não
      configurada: a consulta sanitizada do Pages confirmou ausência de `VITE_SENTRY_DSN` no Preview.
      Nenhum valor de DSN foi lido e nenhum evento foi simulado.

### Cenários pós-merge diferidos

R2/n8n não são pré-requisitos de T175: T177 importa e testa o workflow somente depois que T176 o
publicar em `main`; T179 verifica backup e release production; T180 valida UptimeRobot/alertas; T181
executa a aceitação exclusivamente produtiva. Nenhum desses cenários foi antecipado.

## Resultado

Os controles locais, HTTP públicos e as jornadas hospedadas de Auth/convite acima foram executados.
T175 não recebe `[X]`: faltam os cenários hospedados integrais de RLS, Storage privado, Realtime,
notificações e redaction/Sentry. Nenhuma evidência foi simulada.
