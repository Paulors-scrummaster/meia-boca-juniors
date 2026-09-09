# Contract — Módulo UX & Gamificação

Segue o **Common contract** de `../../001-mbj-mvp-core/contracts/commands.md`.

## RPC `set_athlete_attributes(athlete_id uuid, pace int|null, shooting int|null, passing int|null, dribbling int|null, defending int|null, physical int|null, idempotency_key uuid)`

- **Autorização**: `COACH` ou `PRESIDENT` + AAL2.
- **Efeito**: upsert 1:1 em `athlete_card_attributes`. Cada valor `null` ou `1..99`. `overall` é
  coluna gerada = `round(média dos seis)`, `null` se algum for `null` (FR-018, FR-3.1, R4).
- **Retorno**: `{ athleteId, attributes: {...}, overall: int | null }`.
- **Erros**: `VALIDATION_ERROR` (fora de 1..99), `NOT_FOUND`.

## RPC `open_season(year integer, starts_on date, idempotency_key uuid)`

- **Autorização**: `COACH` ou `PRESIDENT` + AAL2.
- **Efeito**: exige nenhuma temporada `status='ACTIVE'`; insere/atualiza `public.seasons` para
  `status='ACTIVE'`, `is_active=true`, `starts_on`, `ends_on=null` (Clarificação Q3, R1). Contadores
  de troféu e estatística passam a contar a partir desta temporada; histórico anterior preservado.
- **Erros**: `CONFLICT` (já existe ativa), `VALIDATION_ERROR` (ano fora de 1000–9999).

## RPC `close_season(season_id uuid, ends_on date, idempotency_key uuid)`

- **Autorização**: `COACH` ou `PRESIDENT` + AAL2.
- **Efeito**: `ACTIVE → CLOSED`, grava `ends_on` (`>= starts_on`), `is_active=false`. Troféus e
  agregados da temporada ficam imutáveis; nada é apagado.
- **Erros**: `CONFLICT` (não está ativa), `VALIDATION_ERROR`.

## Atribuição de troféus (sem interface — roda dentro de `finalize_sumula`)

`private.evaluate_trophies(season_id uuid, athlete_ids uuid[])` — para cada atleta afetado e cada
troféu de `trophy_catalog`, avalia o gatilho e faz
`insert into athlete_trophies ... on conflict (athlete_id, trophy_code, season_id) do nothing`
(FR-021, FR-3.2, SC-011). Nunca revoga (FR-027). Catálogo fixo:

| `code` | Gatilho (temporada ativa salvo indicação) |
|---|---|
| `ARTILHEIRO` | ≥ 10 gols |
| `GARCOM` | ≥ 10 assistências |
| `HAT_TRICK` | ≥ 3 gols na **mesma** partida finalizada |
| `VETERANO` | ≥ 10 partidas finalizadas em que jogou (no lineup consolidado como titular, ou reserva que entrou por substituição) |
| `MURALHA` | ≥ 5 clean sheets como goleiro da partida (0 gols sofridos, sem troca de goleiro naquela partida) |

## Leituras (views/queries com RLS — contas ativas)

- `public.athlete_card(athlete_id)` → `{ attributes, overall, incomplete: bool, shirtName,
  shirtNumber, primaryPosition, photoPath }` para renderizar o cartão colecionável premium MBJ
  (tokens Dark Navy + gold + escudo — FR-019/FR-019a–h/FR-040). `primaryPosition` é o texto livre
  `athletes.primary_position`; a sigla (GOL/ZAG/LAT/VOL/MEI/ATA…) é derivada no cliente por um mapa
  pt-BR em `attributeCard.constants.ts`, com fallback para as 3 primeiras letras maiúsculas.
- `public.athlete_trophy_gallery(athlete_id)` → lista de `{ trophyCode, titlePt, seasonYear,
  awardedAt }`, todas as temporadas (FR-021b).
- `public.head_to_head_record(opponent_name text)` → `{ hasHistory: bool, wins, draws, losses,
  goalDiff, matchesPlayed }`; `hasHistory=false` quando `matchesPlayed=0` (FR-022/023, SC-010).
  Consumida pelo card "Raio-X" no detalhe da partida agendada.
- `public.club_all_time_record` → agregado do clube para a aba "Histórico & Conquistas" (FR-024).
- `public.season_trophy_progress(athlete_id, season_id)` → progresso atual vs. `threshold` por
  troféu (para a barra de progresso do perfil).

## Notificações (sem interface — pg_cron semanal)

`generate_weekly_highlights()` — segunda, 08:00. Regra determinística sobre consolidações
`VALID` da temporada ativa dos últimos 7 dias (FR-025a, SC-014):

- **Artilheiro da semana**: atleta com mais `GOAL`.
- **Garçom da semana**: atleta com mais `ASSIST`.
- **Goleiro da semana**: goleiro com menor soma de `opponent_score` nas partidas em que foi
  goleiro; empate → mais partidas; ainda empatado → categoria **omitida** (FR-025b).

Enfileira 1 item em `notification_outbox` via `private.enqueue_notification('WEEKLY_HIGHLIGHTS',
...)` com `route = '/app/historico'`, destinatários = contas `ATHLETE` ativas com push habilitado.
Consumo pela Edge Function `dispatch-notifications` existente; falha de push não bloqueia nada
(FR-026, SC-007).

`generate_pre_match_highlights(match_id)` — disparada pela rotina de lembrete de partida existente
do MVP (~24 h antes do início; reusa o agendador de lembretes, **sem** novo scheduler). Uma push
por partida. Payload determinístico: **estatísticas-chave da temporada ativa do MBJ** (artilheiros,
garçons, retrospecto) + o **registro de confronto direto (Raio-X)** contra o adversário da partida
(`head_to_head_record(opponent_name)`; se `hasHistory=false`, informar "primeiro confronto").
**Estatísticas de temporada do adversário não são incluídas** — o MVP só rastreia dados do MBJ.
`route = '/app/partidas/:matchId'`. Idempotente por partida (não reenvia se já houver um item
`PRE_MATCH_HIGHLIGHTS` enfileirado para aquele `match_id`). Consumo pela Edge Function
`dispatch-notifications`; falha de push não bloqueia o lembrete nem qualquer outro fluxo.
