import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

import { json, mockAuthenticatedSession } from './support/auth-mock';

/**
 * Feature 003 · T097 — auditoria WCAG A/AA (@axe-core/playwright) de cada tela nova
 * de US1–US4 e as especificidades do cartão de atributos (FR-019): foto com `alt`
 * significativo, informação nunca só por cor (rótulos + números presentes), as duas
 * variantes (detalhada e compacta) sem violação.
 */

const MATCH_ID = '00000000-0000-4000-8000-0000000e6001';
const ATHLETE_COMPLETE = '00000000-0000-4000-8000-0000000e6a01';
const ATHLETE_INCOMPLETE = '00000000-0000-4000-8000-0000000e6a02';

async function expectWcagAa(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

const NEW_SCREENS = [
  {
    data: {
      '/rest/v1/athlete_trophies': [],
      '/rest/v1/club_all_time_record': {
        draws: 1,
        goal_diff: 6,
        goals_against: 4,
        goals_for: 10,
        losses: 1,
        matches_played: 6,
        wins: 4,
      },
    },
    label: 'Histórico & Conquistas',
    path: '/app/historico',
    role: 'ATHLETE' as const,
  },
  {
    data: { '/rest/v1/social_events': [] },
    label: 'Resenhas',
    path: '/app/resenhas',
    role: 'ATHLETE' as const,
  },
  {
    data: {
      '/rest/v1/athlete_charges': [],
      '/rest/v1/finance_overview': [],
    },
    label: 'Financeiro',
    path: '/app/financeiro',
    role: 'PRESIDENT' as const,
  },
  {
    data: {
      '/rest/v1/athletes': [],
      '/rest/v1/live_match_events': [],
      '/rest/v1/live_match_setups': [],
      '/rest/v1/matches': {
        competition_name: 'Liga de Teste',
        confirmation_deadline: '2026-10-01T18:00:00.000Z',
        current_consolidation_id: null,
        id: MATCH_ID,
        location_name: 'Campo',
        match_date: '2026-10-02T18:00:00.000Z',
        opponent_name: 'Adversário Teste',
        schedule_revision: 1,
        season_id: '00000000-0000-4000-8000-0000000e6901',
        status: 'SCHEDULED',
      },
    },
    label: 'Súmula ao vivo',
    path: `/app/partidas/${MATCH_ID}/sumula`,
    role: 'COACH' as const,
  },
];

for (const { data, label, path, role } of NEW_SCREENS) {
  test(`${label} (${path}) não viola WCAG A/AA`, async ({ page }) => {
    await mockAuthenticatedSession(page, role, { routes: data });
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expectWcagAa(page);
  });
}

// ---- Cartão de atributos: especificidades de acessibilidade (FR-019) ----

function cardRow(id: string, complete: boolean) {
  const base = {
    athlete_id: id,
    photo_path: null,
    primary_position: 'Atacante',
    shirt_name: complete ? 'Fera' : 'Reserva',
    shirt_number: complete ? 9 : 12,
  };
  return complete
    ? {
        ...base,
        defending: 60,
        dribbling: 72,
        incomplete: false,
        overall: 70,
        pace: 80,
        passing: 68,
        physical: 66,
        shooting: 74,
      }
    : {
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

function rosterRow(id: string, complete: boolean) {
  return {
    anonymized_at: null,
    avatar_url: null,
    created_at: '2026-08-25T00:00:00.000Z',
    full_name: complete ? 'Atleta Completo' : 'Atleta Incompleto',
    id,
    inactivated_at: null,
    photo_path: null,
    primary_position: 'Atacante',
    shirt_name: complete ? 'Fera' : 'Reserva',
    shirt_number: complete ? 9 : 12,
    status: 'ACTIVE',
    updated_at: '2026-08-25T00:00:00.000Z',
    user_id: null,
  };
}

async function routeCard(route: Route): Promise<boolean> {
  const request = route.request();
  const url = new URL(request.url());
  const { pathname } = url;
  const single = request.headers().accept?.includes('vnd.pgrst.object');

  if (pathname === '/rest/v1/athletes') {
    const idFilter = url.searchParams.get('id') ?? '';
    if (idFilter) {
      const complete = !idFilter.includes(ATHLETE_INCOMPLETE);
      const id = complete ? ATHLETE_COMPLETE : ATHLETE_INCOMPLETE;
      const row = rosterRow(id, complete);
      return json(route, single ? row : [row]).then(() => true);
    }
    return json(route, [
      rosterRow(ATHLETE_COMPLETE, true),
      rosterRow(ATHLETE_INCOMPLETE, false),
    ]).then(() => true);
  }
  if (pathname === '/rest/v1/rpc/athlete_card') {
    const body = JSON.parse(request.postData() ?? '{}') as { athlete_uuid?: string };
    const id = body.athlete_uuid ?? ATHLETE_COMPLETE;
    return json(route, [cardRow(id, id !== ATHLETE_INCOMPLETE)]).then(() => true);
  }
  if (pathname === '/rest/v1/athlete_trophies') return json(route, []).then(() => true);
  return false;
}

async function installCardMocks(page: Page) {
  await mockAuthenticatedSession(page, 'ATHLETE', { fullName: 'Torcedor Teste' });
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    if (!(await routeCard(route))) return route.fallback();
  });
}

test('cartão detalhado no perfil: foto com alt, rótulos textuais e WCAG A/AA', async ({ page }) => {
  await installCardMocks(page);
  await page.goto(`/app/roster/${ATHLETE_COMPLETE}`);

  const card = page.getByRole('article');
  await expect(card).toHaveAttribute('data-variant', 'detailed');
  // FR-019d: a foto (ou seu placeholder) tem nome acessível significativo
  await expect(card.getByRole('img', { name: /Foto de|Sem foto de/ })).toBeVisible();
  // FR-019b/g: a informação não depende só de cor — siglas e números são texto
  for (const sigla of ['RIT', 'FIN', 'PAS', 'CON', 'DEF', 'FÍS']) {
    await expect(card.getByText(sigla, { exact: true })).toBeVisible();
  }
  await expectWcagAa(page);
});

test('cartão incompleto: "—" textual por atributo, sem overall, e WCAG A/AA', async ({ page }) => {
  await installCardMocks(page);
  await page.goto(`/app/roster/${ATHLETE_INCOMPLETE}`);

  const card = page.getByRole('article');
  await expect(card).toHaveAttribute('data-incomplete', 'true');
  await expect(card.getByText('—')).not.toHaveCount(0);
  await expectWcagAa(page);
});

test('cartão compacto na grade do elenco: WCAG A/AA', async ({ page }) => {
  await installCardMocks(page);
  await page.goto('/app/roster');
  await expect(page.getByRole('heading', { name: 'Elenco' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(2);
  await expectWcagAa(page);
});
