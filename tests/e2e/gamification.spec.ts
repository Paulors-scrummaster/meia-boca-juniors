import { expect, test, type Route } from '@playwright/test';

import { json, mockAuthenticatedSession } from './support/auth-mock';

/**
 * quickstart Cenário 5 — cartões de atributos, Raio-X e histórico (US4 · SC-009/SC-010).
 *
 * Toda a camada Supabase é interceptada. O cartão é renderizado só de tokens +
 * SVG do projeto: nenhuma string de marca EA/FIFA e nenhum JPEG de referência
 * deve aparecer no DOM.
 */

const COMPLETE_ID = '00000000-0000-4000-8000-0000000ca001';
const INCOMPLETE_ID = '00000000-0000-4000-8000-0000000ca002';
const MATCH_HIST_ID = '00000000-0000-4000-8000-0000000ca101';
const MATCH_NEW_ID = '00000000-0000-4000-8000-0000000ca102';

const OPPONENT_WITH_HISTORY = 'Adversário Tradicional';
const OPPONENT_DEBUT = 'Estreante FC';

function rosterRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    anonymized_at: null,
    avatar_url: null,
    created_at: '2026-08-25T00:00:00.000Z',
    full_name: 'Atleta Completo',
    id,
    inactivated_at: null,
    photo_path: null,
    primary_position: 'Atacante',
    shirt_name: 'Fera',
    shirt_number: 9,
    status: 'ACTIVE',
    updated_at: '2026-08-25T00:00:00.000Z',
    user_id: null,
    ...overrides,
  };
}

function cardRow(id: string, complete: boolean) {
  const base = {
    athlete_id: id,
    photo_path: null,
    primary_position: id === COMPLETE_ID ? 'Atacante' : 'Zagueiro',
    shirt_name: id === COMPLETE_ID ? 'Fera' : 'Muralha',
    shirt_number: id === COMPLETE_ID ? 9 : 3,
  };
  if (complete) {
    return {
      ...base,
      defending: 60,
      dribbling: 72,
      incomplete: false,
      overall: 70,
      pace: 80,
      passing: 68,
      physical: 66,
      shooting: 74,
    };
  }
  return {
    ...base,
    defending: null,
    dribbling: null,
    incomplete: true,
    overall: null,
    pace: null,
    passing: null,
    physical: null,
    shooting: null,
  };
}

function matchRow(id: string, opponent: string) {
  return {
    competition_name: 'Liga de Teste',
    confirmation_deadline: '2026-10-01T18:00:00.000Z',
    id,
    location_name: 'Campo Fictício',
    match_date: '2026-10-02T18:00:00.000Z',
    opponent_name: opponent,
    schedule_revision: 1,
    season_id: '00000000-0000-4000-8000-0000000ca901',
    status: 'SCHEDULED',
  };
}

const trophyRows = [
  {
    athlete_id: COMPLETE_ID,
    athletes: { shirt_name: 'Fera', shirt_number: 9 },
    awarded_at: '2026-09-01T12:00:00.000Z',
    season_id: '00000000-0000-4000-8000-0000000ca901',
    seasons: { year: 2026 },
    trophy_catalog: { title_pt: 'Artilheiro' },
    trophy_code: 'ARTILHEIRO',
  },
];

async function routeGamification(route: Route): Promise<boolean> {
  const request = route.request();
  const url = new URL(request.url());
  const { pathname } = url;
  const single = request.headers().accept?.includes('vnd.pgrst.object');

  if (pathname === '/rest/v1/athletes') {
    const idFilter = url.searchParams.get('id') ?? '';
    if (idFilter) {
      const id = idFilter.includes(INCOMPLETE_ID) ? INCOMPLETE_ID : COMPLETE_ID;
      const row = rosterRow(id, {
        full_name: id === COMPLETE_ID ? 'Atleta Completo' : 'Atleta Incompleto',
        primary_position: id === COMPLETE_ID ? 'Atacante' : 'Zagueiro',
        shirt_name: id === COMPLETE_ID ? 'Fera' : 'Muralha',
        shirt_number: id === COMPLETE_ID ? 9 : 3,
      });
      return json(route, single ? row : [row]).then(() => true);
    }
    return json(route, [
      rosterRow(COMPLETE_ID, { full_name: 'Atleta Completo' }),
      rosterRow(INCOMPLETE_ID, {
        full_name: 'Atleta Incompleto',
        primary_position: 'Zagueiro',
        shirt_name: 'Muralha',
        shirt_number: 3,
      }),
    ]).then(() => true);
  }

  if (pathname === '/rest/v1/rpc/athlete_card') {
    const body = JSON.parse(request.postData() ?? '{}') as { athlete_uuid?: string };
    const id = body.athlete_uuid ?? COMPLETE_ID;
    return json(route, [cardRow(id, id === COMPLETE_ID)]).then(() => true);
  }

  if (pathname === '/rest/v1/rpc/head_to_head_record') {
    const body = JSON.parse(request.postData() ?? '{}') as { opponent_name_input?: string };
    if (body.opponent_name_input === OPPONENT_WITH_HISTORY) {
      return json(route, [
        { draws: 1, goal_diff: 4, has_history: true, losses: 1, matches_played: 5, wins: 3 },
      ]).then(() => true);
    }
    return json(route, [
      { draws: 0, goal_diff: 0, has_history: false, losses: 0, matches_played: 0, wins: 0 },
    ]).then(() => true);
  }

  if (pathname === '/rest/v1/matches') {
    const idFilter = url.searchParams.get('id') ?? '';
    const row = idFilter.includes(MATCH_NEW_ID)
      ? matchRow(MATCH_NEW_ID, OPPONENT_DEBUT)
      : matchRow(MATCH_HIST_ID, OPPONENT_WITH_HISTORY);
    return json(route, single ? row : [row]).then(() => true);
  }

  if (pathname === '/rest/v1/athlete_trophies') return json(route, trophyRows).then(() => true);

  if (pathname === '/rest/v1/club_all_time_record') {
    return json(route, {
      draws: 2,
      goal_diff: 11,
      goals_against: 9,
      goals_for: 20,
      losses: 2,
      matches_played: 10,
      wins: 6,
    }).then(() => true);
  }

  if (pathname === '/rest/v1/call_ups' || pathname === '/rest/v1/next_match_view') {
    return json(route, []).then(() => true);
  }

  return false;
}

async function installMocks(page: Parameters<typeof mockAuthenticatedSession>[0]) {
  await mockAuthenticatedSession(page, 'ATHLETE', { fullName: 'Torcedor Teste' });
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    if (!(await routeGamification(route))) return route.fallback();
  });
}

test('cartão detalhado: moldura, coluna de info, foto, nameplate e tira de atributos', async ({
  page,
}) => {
  await installMocks(page);
  await page.goto(`/app/roster/${COMPLETE_ID}`);

  const card = page.getByRole('article');
  await expect(card).toHaveAttribute('data-variant', 'detailed');
  await expect(card).not.toHaveAttribute('data-incomplete', 'true');

  // moldura + fundo desenhados em SVG
  expect(await card.locator('svg').count()).toBeGreaterThan(0);
  // coluna de informação
  await expect(card.getByText('70', { exact: true })).toBeVisible(); // overall = round(média dos seis)
  await expect(card.getByText('ATA', { exact: true })).toBeVisible(); // sigla de posição pt-BR
  await expect(card.getByRole('img', { name: 'Bandeira do Brasil' })).toBeVisible();
  await expect(card.getByRole('img', { name: 'Escudo do MBJ' })).toBeVisible();
  // nameplate
  await expect(card.getByText('Fera', { exact: true })).toBeVisible();
  // tira RIT/FIN/PAS/CON/DEF/FÍS com valores
  for (const sigla of ['RIT', 'FIN', 'PAS', 'CON', 'DEF', 'FÍS']) {
    await expect(card.getByText(sigla, { exact: true })).toBeVisible();
  }
  await expect(card.getByText('80', { exact: true })).toBeVisible();
  await expect(card.getByText('74', { exact: true })).toBeVisible();

  // SC-009: nenhuma marca EA/FIFA e nenhum JPEG de referência no DOM
  const html = await page.content();
  expect(html).not.toMatch(/EA\s*FC|EA\s*SPORTS|FIFA/i);
  expect(html).not.toMatch(/exemplo[ -]card|card[ -]ea|\.jpe?g/i);
});

test('estado incompleto: "—" por atributo e sem overall (detalhado e compacto)', async ({
  page,
}) => {
  await installMocks(page);

  await page.goto(`/app/roster/${INCOMPLETE_ID}`);
  const card = page.getByRole('article');
  await expect(card).toHaveAttribute('data-incomplete', 'true');
  await expect(card.getByText('—')).not.toHaveCount(0);
  await expect(card.getByText('70')).toHaveCount(0);

  // grade do elenco: o incompleto perde o selo de overall, o completo mantém
  await page.goto('/app/roster');
  const cards = page.getByRole('article');
  await expect(cards).toHaveCount(2);
  await expect(page.getByText('Atleta Completo')).toBeVisible();
  await expect(page.getByText('Atleta Incompleto')).toBeVisible();
});

test('cartão compacto: grade do elenco reflui em desktop, tablet e mobile', async ({ page }) => {
  await installMocks(page);
  await page.goto('/app/roster');
  await expect(page.getByRole('heading', { name: 'Elenco' })).toBeVisible();

  for (const size of [
    { height: 900, width: 1280 },
    { height: 1112, width: 834 },
    { height: 844, width: 390 },
  ]) {
    await page.setViewportSize(size);
    await expect(page.getByRole('article')).toHaveCount(2);
    await expect(page.getByText('Fera', { exact: true })).toBeVisible();
    await expect(page.getByText('70', { exact: true })).toBeVisible(); // selo de overall
  }
});

test('Raio-X mostra o retrospecto quando há histórico e "primeiro confronto" quando não há', async ({
  page,
}) => {
  await installMocks(page);

  await page.goto(`/app/matches/${MATCH_HIST_ID}`);
  const raioX = page.getByRole('heading', { name: `Raio-X · MBJ × ${OPPONENT_WITH_HISTORY}` });
  await expect(raioX).toBeVisible();
  const raioXCard = page.locator('section', { has: raioX });
  await expect(raioXCard.getByText('3', { exact: true })).toBeVisible(); // vitórias
  await expect(raioXCard.getByText('+4', { exact: true })).toBeVisible(); // saldo

  await page.goto(`/app/matches/${MATCH_NEW_ID}`);
  await expect(
    page.getByText(`Primeiro confronto contra ${OPPONENT_DEBUT} — sem histórico registrado.`),
  ).toBeVisible();
});

test('aba "Histórico & Conquistas": retrospecto do clube + galeria de troféus', async ({
  page,
}) => {
  await installMocks(page);
  await page.goto('/app/historico');

  await expect(page.getByRole('heading', { name: /Histórico .* Conquistas/ })).toBeVisible();
  await expect(page.getByText('Retrospecto do clube')).toBeVisible();
  await expect(page.getByText('10', { exact: true })).toBeVisible(); // jogos
  await expect(page.getByText('Galeria de troféus')).toBeVisible();
  await expect(page.getByText('Artilheiro')).toBeVisible();
});
