import { expect, test, type Page, type Route } from '@playwright/test';

const userId = '00000000-0000-4000-8000-000000000161';
const matchId = '00000000-0000-4000-8000-000000000162';

interface BackendState {
  available: boolean;
  counts: Record<string, number>;
}

function jwt() {
  return `header.${Buffer.from(
    JSON.stringify({ aal: 'aal2', exp: 2_000_000_000, sub: userId }),
  ).toString('base64url')}.signature`;
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });
}

function count(state: BackendState, resource: string) {
  state.counts[resource] = (state.counts[resource] ?? 0) + 1;
}

async function mockBackend(page: Page, state: BackendState) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => localStorage.getItem('__performance_online') !== 'false',
    });
  });
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!state.available) return route.abort('internetdisconnected');
    if (request.method() === 'OPTIONS') return json(route, null, 204);
    if (url.pathname === '/auth/v1/token')
      return json(route, {
        access_token: jwt(),
        expires_at: 2_000_000_000,
        expires_in: 3600,
        refresh_token: 'refresh-performance',
        token_type: 'bearer',
        user: {
          app_metadata: {},
          aud: 'authenticated',
          created_at: '2026-08-29T00:00:00.000Z',
          email: 'performance@mbj.test',
          id: userId,
          role: 'authenticated',
          updated_at: '2026-08-29T00:00:00.000Z',
          user_metadata: {},
        },
      });
    if (url.pathname === '/auth/v1/user') return json(route, { id: userId });
    if (url.pathname === '/rest/v1/profiles')
      return json(route, { account_status: 'ACTIVE', id: userId, must_change_password: false });
    if (url.pathname === '/rest/v1/user_roles')
      return json(route, [{ role: 'PRESIDENT' }, { role: 'ATHLETE' }]);
    if (url.pathname === '/rest/v1/athletes') {
      count(state, 'athletes');
      return json(route, []);
    }
    if (url.pathname === '/rest/v1/matches') {
      count(state, 'matches');
      return json(route, [
        {
          cancelled_at: null,
          competition_name: 'Liga Local',
          confirmation_deadline: '2026-09-30T18:00:00.000Z',
          created_at: '2026-08-29T00:00:00.000Z',
          created_by: userId,
          current_consolidation_id: null,
          id: matchId,
          location_name: 'Campo Principal',
          match_date: '2026-09-30T21:00:00.000Z',
          opponent_name: 'Adversário Performance',
          schedule_revision: 1,
          season_id: '00000000-0000-4000-8000-000000000163',
          status: 'SCHEDULED',
          updated_at: '2026-08-29T00:00:00.000Z',
          updated_by: userId,
        },
      ]);
    }
    if (url.pathname === '/rest/v1/notices') {
      count(state, 'notices');
      return json(route, []);
    }
    if (url.pathname === '/rest/v1/open_mvp_voting_view') return json(route, []);
    if (url.pathname === '/rest/v1/next_match_view') {
      count(state, 'next-match');
      return json(route, {
        applicable_deadline: '2026-09-30T18:00:00.000Z',
        call_status: 'CALLED',
        competition_name: 'Liga Local',
        confirmation_deadline: '2026-09-30T18:00:00.000Z',
        id: matchId,
        individual_deadline: null,
        is_exceptional_call: false,
        location_name: 'Campo Principal',
        match_date: '2026-09-30T21:00:00.000Z',
        opponent_name: 'Adversário Performance',
        presence_id: null,
        presence_status: 'PENDING',
        schedule_revision: 1,
        season_id: '00000000-0000-4000-8000-000000000163',
        status: 'SCHEDULED',
      });
    }
    return json(route, []);
  });
}

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('performance@mbj.test');
  await page.getByLabel('Senha').fill('senha-local');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/app\/admin$/);
}

test.describe('orçamento de desempenho', () => {
  test('mostra telas primárias em dois segundos sem regressão N+1 nas listas', async ({ page }) => {
    const state: BackendState = { available: true, counts: {} };
    await mockBackend(page, state);

    const welcomeStarted = Date.now();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Bem-vindo ao Meia Boca Juniors/ })).toBeVisible(
      { timeout: 2_000 },
    );
    expect(Date.now() - welcomeStarted).toBeLessThan(2_000);
    await signIn(page);

    const screens = [
      ['Elenco', 'Elenco'],
      ['Partidas', 'Partidas'],
      ['Mural', 'Mural de avisos'],
    ] as const;
    for (const [link, heading] of screens) {
      const started = Date.now();
      await page.getByRole('link', { name: link, exact: true }).click();
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({
        timeout: 2_000,
      });
      expect(Date.now() - started, link).toBeLessThan(2_000);
    }

    await expect.poll(() => state.counts.notices ?? 0).toBe(1);

    expect(state.counts.athletes ?? 0).toBeLessThanOrEqual(1);
    expect(state.counts.matches ?? 0).toBeLessThanOrEqual(1);
    expect(state.counts.notices ?? 0).toBeLessThanOrEqual(1);
    expect(state.counts['next-match'] ?? 0).toBeLessThanOrEqual(2);
  });

  test('restaura a próxima partida offline em menos de dois segundos', async ({ page }) => {
    const state: BackendState = { available: true, counts: {} };
    await mockBackend(page, state);
    await signIn(page);
    await page.goto('/app/matches');
    await expect(page.getByText('Adversário Performance')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.keys(localStorage).some((key) => key.startsWith('mbj:query-cache:')),
        ),
      )
      .toBe(true);

    state.available = false;
    await page.evaluate(() => {
      localStorage.setItem('__performance_online', 'false');
      window.dispatchEvent(new Event('offline'));
    });
    const started = Date.now();
    await page.reload();
    await expect(page.getByRole('status').filter({ hasText: 'Modo Offline' })).toBeVisible({
      timeout: 2_000,
    });
    await expect(page.getByText('Adversário Performance')).toBeVisible({ timeout: 2_000 });
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
