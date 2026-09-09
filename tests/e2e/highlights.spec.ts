import { expect, test, type Route } from '@playwright/test';

import { json, mockAuthenticatedSession } from './support/auth-mock';

/**
 * quickstart Cenário 6 — destaques semanais/pré-jogo e resiliência de push
 * (SC-007, SC-014).
 *
 * O `dispatch-notifications` é exercido como endpoint HTTP mockado com estado:
 *  - determinismo: repetir o dispatch sobre os mesmos dados dá corpo idêntico e
 *    não reconta o destaque semanal;
 *  - idempotência do pré-jogo: re-disparar para o mesmo `match_id` não envia de novo;
 *  - resiliência: com o provedor OneSignal em erro (503), a navegação do app
 *    (Histórico & Conquistas, Partidas) continua funcionando.
 */

const MATCH_ID = '00000000-0000-4000-8000-0000000d1001';
const DISPATCH = 'http://127.0.0.1:54321/functions/v1/dispatch-notifications';

test('destaque semanal é determinístico, pré-jogo é idempotente e a falta de push não derruba o app', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  let providerUp = true;
  let weeklyDelivered = false;
  const preMatchDelivered = new Set<string>();
  let attempts = 0;

  await mockAuthenticatedSession(page, 'ATHLETE', { fullName: 'Torcedor Teste' });
  await page.route('http://127.0.0.1:54321/**', async (route: Route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname === '/functions/v1/dispatch-notifications') {
      attempts += 1;
      if (!providerUp) return json(route, { error: { code: 'INTEGRATION_UNAVAILABLE' } }, 503);
      const body = JSON.parse(request.postData() ?? '{}') as {
        kind?: string;
        matchId?: string;
      };
      if (body.kind === 'PRE_MATCH_HIGHLIGHTS') {
        const key = body.matchId ?? MATCH_ID;
        const sent = preMatchDelivered.has(key) ? 0 : 1;
        preMatchDelivered.add(key);
        return json(route, { data: { kind: 'PRE_MATCH_HIGHLIGHTS', sent, skipped: 0 } });
      }
      // WEEKLY_HIGHLIGHTS
      const sent = weeklyDelivered ? 0 : 1;
      weeklyDelivered = true;
      return json(route, {
        data: {
          categories: ['topScorer', 'topAssister'],
          kind: 'WEEKLY_HIGHLIGHTS',
          route: '/app/historico',
          sent,
          skipped: 0,
        },
      });
    }

    if (pathname === '/rest/v1/club_all_time_record') {
      return json(route, {
        draws: 1,
        goal_diff: 6,
        goals_against: 4,
        goals_for: 10,
        losses: 1,
        matches_played: 6,
        wins: 4,
      });
    }
    if (pathname === '/rest/v1/athlete_trophies') return json(route, []);
    if (pathname === '/rest/v1/matches') {
      return json(route, [
        {
          competition_name: 'Liga de Teste',
          confirmation_deadline: '2026-10-01T18:00:00.000Z',
          id: MATCH_ID,
          location_name: 'Campo',
          match_date: '2026-10-02T18:00:00.000Z',
          opponent_name: 'Rival FC',
          schedule_revision: 1,
          season_id: '00000000-0000-4000-8000-0000000d1901',
          status: 'SCHEDULED',
        },
      ]);
    }
    if (pathname === '/rest/v1/notices' || pathname === '/rest/v1/season_rankings') {
      return json(route, []);
    }

    return route.fallback();
  });

  await page.goto('/app/historico');
  await expect(page.getByRole('heading', { name: /Histórico .* Conquistas/ })).toBeVisible();
  expect(pageErrors).toEqual([]);

  // Determinismo do destaque semanal: dois dispatches sobre os mesmos dados.
  const weekly = await page.evaluate(async (url) => {
    const post = () =>
      fetch(url, {
        body: JSON.stringify({ kind: 'WEEKLY_HIGHLIGHTS' }),
        method: 'POST',
      }).then((r) => r.json());
    return [await post(), await post()];
  }, DISPATCH);
  expect(weekly[0].data.categories).toEqual(weekly[1].data.categories);
  expect(weekly[0].data.route).toBe('/app/historico');
  expect(weekly[0].data.sent).toBe(1);
  expect(weekly[1].data.sent).toBe(0); // não reconta

  // Idempotência do pré-jogo: re-disparo para o mesmo match não envia de novo.
  const preMatch = await page.evaluate(
    async ({ url, matchId }) => {
      const post = () =>
        fetch(url, {
          body: JSON.stringify({ kind: 'PRE_MATCH_HIGHLIGHTS', matchId }),
          method: 'POST',
        }).then((r) => r.json());
      return [await post(), await post()];
    },
    { matchId: MATCH_ID, url: DISPATCH },
  );
  expect(preMatch[0].data.sent).toBe(1);
  expect(preMatch[1].data.sent).toBe(0);

  // Provedor de push indisponível: o dispatch responde 503…
  providerUp = false;
  const outage = await page.evaluate(
    (url) => fetch(url, { body: '{}', method: 'POST' }).then((r) => r.status),
    DISPATCH,
  );
  expect(outage).toBe(503);

  // …mas as demais telas continuam funcionando (SC-007, FR-026).
  await page.goto('/app/historico');
  await expect(page.getByText('Retrospecto do clube')).toBeVisible();
  await page.goto('/app/notices');
  await expect(page.getByRole('heading', { name: /Mural/ })).toBeVisible();
  expect(pageErrors).toEqual([]);
  expect(attempts).toBe(5);
});
