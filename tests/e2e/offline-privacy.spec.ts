import { expect, test, type Page, type Route } from '@playwright/test';

const userA = '00000000-0000-4000-8000-000000000146';
const userB = '00000000-0000-4000-8000-000000000147';
const matchId = '00000000-0000-4000-8000-000000000148';
const lineupId = '00000000-0000-4000-8000-000000000149';
const athleteId = '00000000-0000-4000-8000-000000000150';
const candidateId = '00000000-0000-4000-8000-000000000151';
const roundId = '00000000-0000-4000-8000-000000000152';

interface MockState {
  networkAvailable: boolean;
  userId: string;
  writes: string[];
}

function jwt(userId: string) {
  return `header.${Buffer.from(
    JSON.stringify({ aal: 'aal2', exp: 2_000_000_000, sub: userId }),
  ).toString('base64url')}.signature`;
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });
}

function nextMatch(userId: string) {
  return {
    applicable_deadline: '2026-09-30T18:00:00.000Z',
    call_status: 'CALLED',
    competition_name: 'Liga Local',
    confirmation_deadline: '2026-09-30T18:00:00.000Z',
    id: matchId,
    individual_deadline: null,
    is_exceptional_call: false,
    location_name: 'Campo Principal',
    match_date: '2026-09-30T21:00:00.000Z',
    opponent_name: userId === userA ? 'Adversário Alfa' : 'Adversário Beta',
    presence_id: athleteId,
    presence_status: 'PENDING',
    schedule_revision: 1,
    season_id: '00000000-0000-4000-8000-000000000153',
    status: 'SCHEDULED',
  };
}

async function installOnlineSignal(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'onLine', {
      configurable: true,
      get() {
        return localStorage.getItem('__mbj_online') !== 'false';
      },
    });
  });
}

async function setBrowserOnline(page: Page, online: boolean) {
  await page.evaluate((nextOnline) => {
    localStorage.setItem('__mbj_online', String(nextOnline));
    window.dispatchEvent(new Event(nextOnline ? 'online' : 'offline'));
  }, online);
}

async function navigateClient(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function mockBackend(page: Page, state: MockState) {
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!state.networkAvailable) return route.abort('internetdisconnected');
    if (request.method() === 'OPTIONS') return json(route, null, 204);

    if (url.pathname === '/auth/v1/token') {
      const body = request.postData() ?? '';
      state.userId = body.includes('usuario-b') ? userB : userA;
      return json(route, {
        access_token: jwt(state.userId),
        expires_at: 2_000_000_000,
        expires_in: 3600,
        refresh_token: `refresh-${state.userId}`,
        token_type: 'bearer',
        user: {
          app_metadata: {},
          aud: 'authenticated',
          created_at: '2026-08-29T00:00:00.000Z',
          email: state.userId === userA ? 'usuario-a@mbj.test' : 'usuario-b@mbj.test',
          id: state.userId,
          role: 'authenticated',
          updated_at: '2026-08-29T00:00:00.000Z',
          user_metadata: {},
        },
      });
    }
    if (url.pathname === '/auth/v1/logout') return json(route, {}, 200);
    if (url.pathname === '/auth/v1/user') return json(route, { id: state.userId });
    if (url.pathname === '/rest/v1/profiles')
      return json(route, {
        account_status: 'ACTIVE',
        id: state.userId,
        must_change_password: false,
      });
    if (url.pathname === '/rest/v1/user_roles')
      return json(route, [{ role: 'PRESIDENT' }, { role: 'COACH' }, { role: 'ATHLETE' }]);
    if (url.pathname === '/rest/v1/next_match_view') return json(route, nextMatch(state.userId));
    if (url.pathname === '/rest/v1/matches')
      return json(route, [
        {
          cancelled_at: null,
          competition_name: 'Liga Local',
          confirmation_deadline: '2026-09-30T18:00:00.000Z',
          created_at: '2026-08-29T00:00:00.000Z',
          created_by: state.userId,
          current_consolidation_id: null,
          id: matchId,
          location_name: 'Campo Principal',
          match_date: '2026-09-30T21:00:00.000Z',
          opponent_name: nextMatch(state.userId).opponent_name,
          schedule_revision: 1,
          season_id: '00000000-0000-4000-8000-000000000153',
          status: 'SCHEDULED',
          updated_at: '2026-08-29T00:00:00.000Z',
          updated_by: state.userId,
        },
      ]);
    if (url.pathname === '/rest/v1/published_lineup_view')
      return json(route, [
        {
          assignment: 'STARTER',
          athlete_id: athleteId,
          display_order: 0,
          formation_code: '4-4-2',
          lineup_id: lineupId,
          match_id: matchId,
          position_x: 50,
          position_y: 80,
          published_at: '2026-08-29T18:00:00.000Z',
          revision: 1,
          shirt_name: state.userId === userA ? 'Alfa' : 'Beta',
          shirt_number: 9,
          tactical_position: 'ATA',
        },
      ]);
    if (url.pathname === '/rest/v1/open_mvp_voting_view')
      return json(route, [
        {
          assignment: 'STARTER',
          candidate_athlete_id: candidateId,
          closes_at: '2026-09-30T23:00:00.000Z',
          has_voted: false,
          match_id: matchId,
          shirt_name: 'Candidato',
          shirt_number: 10,
          voter_athlete_id: athleteId,
          voting_round_id: roundId,
        },
      ]);
    if (url.pathname === '/rest/v1/mvp_voting_rounds') return json(route, []);
    if (url.pathname === '/rest/v1/notices') return json(route, []);
    if (url.pathname === '/rest/v1/seasons')
      return json(route, [
        {
          created_at: '2026-01-01T00:00:00.000Z',
          id: '00000000-0000-4000-8000-000000000153',
          is_current: true,
          name: '2026',
          year: 2026,
        },
      ]);

    if (request.method() !== 'GET' && !url.pathname.startsWith('/auth/')) {
      state.writes.push(`${request.method()} ${url.pathname}`);
      return json(route, { unexpectedWrite: true }, 409);
    }
    return json(route, []);
  });
}

async function signIn(page: Page, email = 'usuario-a@mbj.test') {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-local');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/app\/(admin|staff|athlete)$/);
}

test.describe('offline privacy and restoration', () => {
  test('restores sanitized snapshots under two seconds, isolates users/tabs, and purges logout', async ({
    context,
    page,
  }) => {
    const state: MockState = { networkAvailable: true, userId: userA, writes: [] };
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await installOnlineSignal(page);
    await mockBackend(page, state);
    await signIn(page);

    await page.goto('/app/matches');
    await expect(page.getByText('Adversário Alfa')).toBeVisible();
    await navigateClient(page, `/app/matches/${matchId}/lineup`);
    await expect(page.getByText('9 · Alfa')).toBeVisible();

    const storageKey = `mbj:query-cache:v1:mbj-e2e:mbj:${userA}`;
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
      .not.toBeNull();

    const persisted = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      storageKey,
    );
    expect(persisted.clientState.mutations).toEqual([]);
    expect(persisted.clientState.queries).toHaveLength(2);
    expect(
      persisted.clientState.queries.map((query: { queryKey: unknown[] }) => query.queryKey),
    ).toEqual(
      expect.arrayContaining([
        ['offline', userA, 'next-match'],
        ['offline', userA, 'published-lineup', matchId],
      ]),
    );
    const persistedData = persisted.clientState.queries.map(
      (query: { state: { data: unknown } }) => query.state.data,
    );
    expect(JSON.stringify(persistedData)).not.toMatch(
      /access_token|refresh_token|email|refusal|reason|audit|role/i,
    );

    const cacheAudit = await page.evaluate(async () => {
      const entries = [];
      for (const cacheName of await caches.keys()) {
        const cache = await caches.open(cacheName);
        for (const request of await cache.keys()) {
          entries.push({ body: await (await cache.match(request))!.text(), url: request.url });
        }
      }
      return entries;
    });
    expect(
      cacheAudit.every(({ url }) => !/54321|supabase|\/auth\/|\/rest\/|\/functions\//i.test(url)),
    ).toBe(true);
    expect(JSON.stringify(cacheAudit)).not.toContain('usuario-a@mbj.test');

    state.networkAvailable = false;
    await setBrowserOnline(page, false);
    const restoredAt = Date.now();
    await page.reload();
    await expect(page.getByRole('status').filter({ hasText: 'Modo Offline' })).toBeVisible();
    await expect(page.getByText('9 · Alfa')).toBeVisible({ timeout: 2_000 });
    await navigateClient(page, '/app/matches');
    await expect(page.getByText('Adversário Alfa')).toBeVisible({ timeout: 2_000 });
    expect(Date.now() - restoredAt).toBeLessThan(2_000);
    expect(pageErrors).toEqual([]);

    state.networkAvailable = true;
    await setBrowserOnline(page, true);
    const secondTab = await context.newPage();
    await installOnlineSignal(secondTab);
    await mockBackend(secondTab, state);
    await secondTab.goto('/app/matches');
    await expect(secondTab).toHaveURL(/\/app\/matches$/);

    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(secondTab).toHaveURL(/\/$/);
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), storageKey))
      .toBeNull();

    await signIn(page, 'usuario-b@mbj.test');
    await page.goto('/app/matches');
    await expect(page.getByText('Adversário Beta')).toBeVisible();
    await expect(page.getByText('Adversário Alfa')).toHaveCount(0);
    const userBKey = `mbj:query-cache:v1:mbj-e2e:mbj:${userB}`;
    await expect
      .poll(() => page.evaluate((key) => localStorage.getItem(key), userBKey))
      .not.toBeNull();
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
  });

  test('disables different write classes and never queues or replays a mutation', async ({
    page,
  }) => {
    const state: MockState = { networkAvailable: true, userId: userA, writes: [] };
    await installOnlineSignal(page);
    await mockBackend(page, state);
    await signIn(page);

    await navigateClient(page, `/app/athlete/matches/${matchId}/attendance`);
    await expect(page.getByRole('button', { name: 'Confirmar presença' })).toBeVisible();
    await navigateClient(page, '/app/athlete/mvp-voting');
    await expect(page.getByRole('button', { name: /Votar em Candidato/ })).toBeVisible();
    await navigateClient(page, '/app/notices');
    await expect(page.getByRole('button', { name: 'Publicar aviso' })).toBeVisible();
    await navigateClient(page, '/app/staff/matches/new');
    await expect(page.getByRole('button', { name: 'Salvar partida' })).toBeVisible();

    await setBrowserOnline(page, false);
    await expect(
      page.getByText('Controles de escrita estão desabilitados até a reconexão.'),
    ).toBeVisible();

    await navigateClient(page, `/app/athlete/matches/${matchId}/attendance`);
    await expect(page.getByRole('button', { name: 'Confirmar presença' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Recusar presença' })).toBeDisabled();

    await navigateClient(page, '/app/athlete/mvp-voting');
    await expect(page.getByRole('button', { name: /Votar em Candidato/ })).toBeDisabled();

    await navigateClient(page, '/app/notices');
    await expect(page.getByRole('button', { name: 'Publicar aviso' })).toBeDisabled();

    await navigateClient(page, '/app/staff/matches/new');
    await expect(
      page.getByRole('button', { name: /Salvar partida|Salvar alterações/ }),
    ).toBeDisabled();

    expect(state.writes).toEqual([]);
    const serializedClients = await page.evaluate(() =>
      Object.entries(localStorage)
        .filter(([key]) => key.startsWith('mbj:query-cache:'))
        .map(([, value]) => JSON.parse(value)),
    );
    expect(
      serializedClients.every(
        (client: { clientState?: { mutations?: unknown[] } }) =>
          client.clientState?.mutations?.length === 0,
      ),
    ).toBe(true);

    await setBrowserOnline(page, true);
    await page.waitForTimeout(500);
    expect(state.writes).toEqual([]);
  });
});
