# Deployment do MBJ

Este documento define a preparação de staging, preview e produção sem versionar credenciais nem
misturar dados entre ambientes. A ativação produtiva continua separada conforme T178/T179.

## Matriz de ambientes

| Ambiente      | Frontend                    | Backend                     | Dados                         | Push                | Monitoramento           |
| ------------- | --------------------------- | --------------------------- | ----------------------------- | ------------------- | ----------------------- |
| Local         | Vite em `127.0.0.1`         | Supabase local              | seed fictício                 | adaptador de falha  | desativado              |
| Preview de PR | Cloudflare Pages preview    | Supabase staging            | somente fictícios             | produção desativada | Sentry staging opcional |
| Staging       | alias não canônico do Pages | projeto Supabase staging    | somente fictícios             | produção desativada | Sentry staging          |
| Produção      | domínio canônico após T178  | projeto Supabase production | dados reais somente após T179 | OneSignal canônico  | Sentry production       |

O preview nunca recebe URL, chave, project ref, banco, Storage ou secrets do projeto de produção.

## Build e Cloudflare Pages

- Projeto Pages: `meia-boca-juniors` (`meia-boca-juniors.pages.dev`).
- Repositório: `Paulors-scrummaster/meia-boca-juniors`.
- Branch produtiva: `main`.
- Branch de preview desta entrega: `feature/mbj-mvp-core`.
- Comando: `npm run build`.
- Diretório publicado: `dist`.
- Versão Node: `24` por `NODE_VERSION=24`.
- Diretório raiz: raiz do repositório.
- O projeto deve usar integração Git; Direct Upload não satisfaz o fluxo de previews do PR.
- Deploy produtivo permanece desativado durante T166. O filtro de preview aceita somente
  `feature/mbj-mvp-core`; produção, domínio personalizado e DNS continuam adiados para T178.

Não existe `404.html` na raiz. Assim, o serving do Pages aplica fallback SPA para rotas profundas.
Validar uma rota como `/app/matches` por acesso direto e recarga. Os caminhos
`/manifest.webmanifest`, `/sw.js` e `/push/onesignal/OneSignalSDKWorker.js` precisam retornar seus
tipos reais, nunca o HTML de fallback.

## Variáveis públicas de build

Configurar no escopo **Preview** do Pages:

| Nome                            | Origem                                  | Regra                              |
| ------------------------------- | --------------------------------------- | ---------------------------------- |
| `NODE_VERSION`                  | literal `24`                            | não é segredo                      |
| `VITE_APP_ENV`                  | literal `staging`                       | nunca usar `production` no preview |
| `VITE_CLUB_DEPLOYMENT_ID`       | identificador público de staging        | distinto de produção               |
| `VITE_SUPABASE_URL`             | URL pública do Supabase staging         | nunca produção                     |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave pública de staging                | nunca service role                 |
| `VITE_SENTRY_DSN`               | DSN público de staging, se provisionado | sem PII/Replay                     |
| `VITE_ONESIGNAL_APP_ID`         | vazio                                   | push produtivo proibido no preview |

O Pages fornece `CF_PAGES_COMMIT_SHA`; o Vite usa esse valor como release do Sentry. Credenciais de
upload (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`) pertencem somente ao secret store de build
produtivo. O plugin envia source maps e os apaga; o build falha se qualquer `.map` restar em `dist`.

## Secrets das Edge Functions

Os valores abaixo existem apenas no secret store de cada projeto Supabase. Não copiá-los para
`.env.local`, GitHub variables, documentação, logs ou artefatos:

- `SUPABASE_SERVICE_ROLE_KEY` (gerenciado pelo ambiente);
- `ONESIGNAL_REST_API_KEY`;
- `ONESIGNAL_IDENTITY_VERIFICATION_KEY`;
- `NOTIFICATION_DISPATCH_SECRET`;
- `SENTRY_DSN`;
- `SENTRY_RELEASE` quando definido pelo pipeline.

Valores de configuração por ambiente: `APP_ENV`, `ALLOWED_ORIGINS`, `CANONICAL_ORIGIN` e
`ONESIGNAL_APP_ID`. Preview/staging não usa credenciais da aplicação OneSignal produtiva.

## Supabase hospedado

Criar dois projetos distintos na mesma região apropriada:

1. staging com somente seed fictício;
2. production vazio até o workflow de ativação T179.

Em ambos: desativar signup aberto/invite público e configurar o limite
`sign_in_sign_ups = 30` por janela de cinco minutos. Registrar somente os project refs públicos e a
evidência sanitizada do HTTP 429 em `docs/security-controls.md`. Senhas, access tokens, database URLs
com senha, JWT secrets e chaves service role não entram no repositório.

## Validação do preview

Executar no deployment associado ao PR #183:

1. confirmar commit igual ao head do PR;
2. abrir a home e recarregar uma rota profunda;
3. verificar título, canonical e manifesto em português;
4. validar instalação do PWA e prompt de atualização sem perda silenciosa de formulário;
5. confirmar headers CSP, HSTS, `nosniff`, anti-frame e política de permissões;
6. confirmar workers e manifesto com MIME correto;
7. executar testes de teclado, foco, semântica, contraste e alvos de toque;
8. inspecionar Cache Storage: nenhum Auth/Data API do Supabase;
9. confirmar que OneSignal produtivo não inicializa;
10. confirmar que todas as URLs/chaves públicas apontam somente para staging e dados são fictícios.

## Domínio canônico e produção — adiado

Somente T178, depois do merge e na branch `chore/mbj-production-activation`, pode:

- configurar variáveis produtivas do Pages;
- anexar `meiabocajuniors.dbidigital.com.br`;
- redirecionar aliases `pages.dev` preservando path e query;
- ativar OneSignal no domínio canônico;
- validar PWA/worker/canonical origin em produção.

T166 não altera DNS, não promove preview e não publica variáveis produtivas.

## Registro de evidência T165/T166

Preencher somente após validação real, sem secrets:

| Controle                             | Evidência segura                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| Supabase staging project ref         | `lqkybvqnppxxehiriunq` (`Manager01`, designado exclusivamente como staging do MBJ) |
| Supabase production project ref      | não provisionado; auditoria autenticada encontrou zero candidato MBJ separado      |
| Auth invite-only e limite staging    | concluído: signup fechado; limite 30/5 min; HTTP 429 verificado                    |
| Auth invite-only e limite production | bloqueado pelo projeto production ainda inexistente                                |
| Cloudflare Pages project/preview URL | `meia-boca-juniors`; `https://feature-mbj-mvp-core.meia-boca-juniors.pages.dev`    |
| Preview SHA/resultado                | `5405e285c136156fbba33b7d7e1e09a17f48e343`; build/deploy e gates aprovados         |

Validação manual do preview em 2026-08-30: home HTTPS carregada; rota profunda recarregada sem 404
e redirecionada pela proteção de autenticação; manifesto em português; `/sw.js` e o worker isolado
do OneSignal servidos como JavaScript. A validação encontrou e corrigiu uma interceptação indevida
de arquivos pelo fallback SPA, coberta por teste de regressão. Produção permaneceu sem variáveis e
com deploy desativado durante toda a T166.

Auditoria inicial em 2026-08-30 confirmou `Manager01` ativo e saudável em `us-east-1`, mas encontrou
signup aberto e schema MBJ ausente. Em 2026-08-31 foram aplicadas ao staging as 25 migrations e o seed
exclusivamente fictício; um dry-run posterior confirmou drift zero. As quatro Edge Functions ficaram
`ACTIVE`, com ambiente e origens públicas configurados no secret store e integrações sem credenciais
mantidas fail-closed. A configuração pública confirmou signup fechado; o endpoint `profiles` existe e
rejeitou acesso anônimo com HTTP 401; o throttling produziu HTTP 429 na 31ª tentativa sintética às
`2026-08-31T01:20:47.7664083Z`. Nenhum schema/tabela alheio ao MBJ foi enumerado ou lido. Criar
production permanece pendente; nenhuma configuração produtiva foi criada.

No head de implementação acima, Cloudflare Pages e os dois conjuntos de checks `Required`, frontend, banco e
Playwright foram aprovados. Home, rota profunda, manifesto e os dois workers foram consultados após o
deploy e retornaram HTTP 200 com MIME esperado.
