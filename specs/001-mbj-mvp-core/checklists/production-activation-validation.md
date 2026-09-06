# Validação de ativação de produção — T181

Data: 2026-09-06. Executados os cenários exclusivamente produtivos de
`specs/001-mbj-mvp-core/quickstart.md`, seção "Post-merge production activation", contra o domínio
canônico `https://meiabocajuniors.dbidigital.com.br/`. Nenhum usuário real foi convidado e nenhuma
credencial, token, URL assinada ou dado pessoal foi registrado. Verificações somente-leitura por HTTP
e inspeção do bundle publicado; as ações interativas usaram o navegador autenticado do dono. Nenhuma
migração de produção foi executada.

## Domínio canônico e alias `pages.dev`

- [x] `GET https://meiabocajuniors.dbidigital.com.br/` retornou HTTP 200 com HTML SPA e a keyword
      `Meia Boca Juniors` presente.
- [x] `manifest.webmanifest` (`application/manifest+json`), `sw.js` e
      `push/onesignal/OneSignalSDKWorker.js` (`application/javascript`) retornaram HTTP 200 sem
      fallback HTML; a rota profunda `GET /app/matches` retornou HTTP 200 com o shell SPA.
- [x] Cabeçalhos observados: HSTS, CSP com `frame-ancestors 'none'`, `X-Frame-Options: DENY`,
      `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- [x] O alias `meia-boca-juniors.pages.dev` respondeu `301` preservando caminho e query:
      `/` → `https://meiabocajuniors.dbidigital.com.br/` e
      `/app/matches?x=1&y=2` → `https://meiabocajuniors.dbidigital.com.br/app/matches?x=1&y=2`.

## PWA e prompt de atualização

- [x] Service worker ativo (`sw.js`) controlando o cliente; manifesto válido — PWA instalável.
- [x] O prompt de atualização é opcional: o toast "Uma nova versão do MBJ está disponível." oferece
      "Atualizar agora" e "Depois", nunca recarrega automaticamente, e "Depois" mantém a página e
      qualquer formulário preenchido. Cenário "prompted updates do not discard a filled form"
      atendido: o descarte só ocorre por escolha explícita do usuário.
- [x] Comportamento observado e registrado: ao clicar "Atualizar agora" com um valor não salvo no
      formulário de `/login`, a atualização faz `location.reload()` e o campo volta vazio. A inspeção
      do bundle de produção confirma ausência de guarda `beforeunload` e de persistência de rascunho
      de formulário. Tratado como melhoria não bloqueante em
      [#198](https://github.com/Paulors-scrummaster/meia-boca-juniors/issues/198).

## Source maps e Sentry

- [x] Nenhum arquivo `.map` é recuperável publicamente: `/assets/index-*.js.map`,
      `/assets/index-*.css.map` e `/sw.js.map` retornam o shell HTML da SPA (1421 B), não um source
      map; o bundle principal de produção não contém comentário `//# sourceMappingURL`.
- [ ] "Sentry reports use the deployment commit as release and contain no personal fields" e
      "source maps resolve errors in Sentry" — **não verificável**. A organização Sentry `dbi-digital`
      possui apenas `mbj-staging` (0 erros) e `n8n-dbi` (não relacionado); não há projeto
      `mbj-production`. O bundle de produção não embute DSN de ingest do Sentry (apenas um link para
      `docs.sentry.io`); `Sentry.init()` existe no código, mas o DSN estava vazio no build, então o
      cliente não inicializa em produção (`window.__SENTRY__` ausente) e não há eventos com
      `environment:production` na organização. O pipeline de redação (`beforeSend`, `denyUrls`, sem
      Replay) está no código e foi validado contra `mbj-staging` na T175. Rastreado em
      [#200](https://github.com/Paulors-scrummaster/meia-boca-juniors/issues/200) para o dono decidir
      entre configurar o Sentry de produção ou aceitar formalmente a ausência de telemetria de erro.

## Monitor externo (UptimeRobot)

- [x] Monitor HTTP/keyword `803921970` "MBJ canonical home (HTTP/keyword)" alvo
      `https://meiabocajuniors.dbidigital.com.br/`, keyword `Meia Boca Juniors`, intervalo 5 min,
      alerta por e-mail ao dono, reportando `Up`.
- [x] Teste do caminho de alerta de indisponibilidade (keyword-miss controlado): a keyword foi
      trocada para uma string ausente da página e o incidente `354986164260080559` foi registrado —
      "Keyword has not been found" detectado 10:47:32 GMT-3, confirmado por quatro regiões, status
      `Down` às 10:48:16 e **e-mail de indisponibilidade enviado ao dono às 10:48:18 (SUCCESS)** no
      log de atividade. A keyword foi restaurada; o incidente resolveu às 10:50:58 (duração 2m42s) e
      **e-mail de recuperação enviado às 10:51:01 (SUCCESS)**. O monitor voltou a `Up` com a resposta
      contendo `Meia Boca Juniors`.

## Push em iOS

- [ ] "on a supported iPhone/iPad, install to Home Screen, ... receive/open a test notification" —
      **não executado, limitação explícita, não aprovado**. Sem dispositivo Apple disponível; o push
      web em iOS/iPadOS exige PWA instalada na tela inicial (iOS 16.4+), não reproduzível por
      automação desktop. Rastreado em
      [#199](https://github.com/Paulors-scrummaster/meia-boca-juniors/issues/199).

## Resultado

Aprovados: alias `pages.dev` preservando caminho/query, MIME/fallback SPA e cabeçalhos de segurança
do domínio canônico, prompt de atualização PWA opcional e não destrutivo, ausência de `.map`
recuperável e de `sourceMappingURL`, e o monitor UptimeRobot HTTP/keyword com o caminho de alerta de
indisponibilidade testado ponta a ponta.

Pendências rastreadas, não bloqueantes para a T181:

- [#198](https://github.com/Paulors-scrummaster/meia-boca-juniors/issues/198) — guarda
  `beforeunload`/rascunho para atualização explícita com formulário preenchido (melhoria).
- [#199](https://github.com/Paulors-scrummaster/meia-boca-juniors/issues/199) — push iOS não
  validado (sem dispositivo).
- [#200](https://github.com/Paulors-scrummaster/meia-boca-juniors/issues/200) — Sentry de produção
  não configurado; cenários de release/PII/source maps no Sentry adiados.

T181 recebe `[X]` com as três pendências acima registradas como issues. Nenhuma alteração de produção,
OneSignal, R2 ou n8n foi feita nesta validação.
