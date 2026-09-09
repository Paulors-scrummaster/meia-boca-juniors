import { expect, test, type Route } from '@playwright/test';

import { json, mockAuthenticatedSession } from './support/auth-mock';

/**
 * quickstart Cenário 2 — rateio de churrasco.
 * Mock com estado: o evento começa OPEN com 15 pessoas confirmadas (10 atletas,
 * 5 com +1 acompanhante); ao fechar, congela em R$ 40,00 e passa a CLOSED.
 */

const EVENT_ID = '40000000-0000-4000-8000-000000000c01';
const EMPTY_EVENT_ID = '40000000-0000-4000-8000-000000000c02';

function makeState() {
  const event = {
    event_at: '2026-09-20T21:00:00Z',
    id: EVENT_ID,
    location_name: 'Sede do clube',
    status: 'OPEN' as 'OPEN' | 'CLOSED',
    title: 'Churrasco da Vitória',
    total_cost: 600,
  };
  let peopleCount = 15;

  return {
    close() {
      event.status = 'CLOSED';
    },
    event,
    split() {
      if (event.status === 'CLOSED')
        return [{ cost_per_person: 40, people_count: peopleCount, split_unavailable: false }];
      if (peopleCount === 0)
        return [{ cost_per_person: null, people_count: 0, split_unavailable: true }];
      return [
        {
          cost_per_person: Math.round((event.total_cost / peopleCount) * 100) / 100,
          people_count: peopleCount,
          split_unavailable: false,
        },
      ];
    },
    setPeople(value: number) {
      peopleCount = value;
    },
  };
}

async function routeSocial(route: Route, state: ReturnType<typeof makeState>) {
  const url = new URL(route.request().url());
  const { pathname } = url;
  const single = route.request().headers().accept?.includes('vnd.pgrst.object');

  if (pathname === '/rest/v1/social_events') {
    if (url.searchParams.get('id')?.includes(EMPTY_EVENT_ID))
      return json(route, single ? emptyEvent() : [emptyEvent()]);
    return json(route, single ? state.event : [state.event]);
  }
  if (pathname === '/rest/v1/rpc/social_event_split') {
    const body = JSON.parse(route.request().postData() ?? '{}') as { event_uuid: string };
    if (body.event_uuid === EMPTY_EVENT_ID)
      return json(route, [{ cost_per_person: null, people_count: 0, split_unavailable: true }]);
    return json(route, state.split());
  }
  if (pathname === '/rest/v1/rpc/social_event_participants') return json(route, []);
  if (pathname === '/rest/v1/rpc/close_social_event') {
    state.close();
    return json(route, { costPerPerson: 40, eventId: EVENT_ID, peopleCount: 15, status: 'CLOSED' });
  }
  return null;
}

function emptyEvent() {
  return {
    event_at: '2026-09-25T21:00:00Z',
    id: EMPTY_EVENT_ID,
    location_name: 'Quadra',
    status: 'OPEN',
    title: 'Resenha sem confirmados',
    total_cost: 200,
  };
}

test('rateio mostra R$ 40,00/pessoa, congela no fechamento e some sem confirmados', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const state = makeState();

  await mockAuthenticatedSession(page, 'PRESIDENT', { fullName: 'Presidente Teste' });
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const handled = await routeSocial(route, state);
    if (handled === null) return route.fallback();
  });

  await page.goto(`/app/resenhas/${EVENT_ID}`);
  await expect(page.getByRole('heading', { name: 'Churrasco da Vitória' })).toBeVisible();
  await expect(page.getByText('R$ 40,00')).toBeVisible();
  await expect(page.getByText('15 confirmada(s)')).toBeVisible();

  await page.getByRole('button', { name: /Fechar Evento/ }).click();
  await expect(page.getByText('Fechado')).toBeVisible();
  await expect(page.getByRole('button', { name: /Fechar Evento/ })).toHaveCount(0);
  await expect(page.getByText('R$ 40,00')).toBeVisible(); // valor congelado

  // Evento sem ninguém confirmado → rateio indisponível, sem erro.
  await page.goto(`/app/resenhas/${EMPTY_EVENT_ID}`);
  await expect(page.getByText(/Rateio indisponível/)).toBeVisible();
});
