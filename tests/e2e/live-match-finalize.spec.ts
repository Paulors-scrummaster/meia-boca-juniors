import { expect, test, type Route } from '@playwright/test';

import { json, mockAuthenticatedSession } from './support/auth-mock';

/**
 * quickstart Cenário 4 — revisão pós-jogo e consolidação, como COACH (AAL2).
 * A súmula já está em IN_REVIEW com gols, cartão e uma substituição de goleiro.
 */

const MATCH = '50000000-0000-4000-8000-000000000e01';
const SUPABASE = 'http://127.0.0.1:54321/**';

const ROSTER = [
  { id: 'g-1', primary_position: 'Goleiro', shirt_name: 'Um', shirt_number: 1, status: 'ACTIVE', user_id: null },
  { id: 'g-2', primary_position: 'Goleiro', shirt_name: 'Doze', shirt_number: 12, status: 'ACTIVE', user_id: null },
  { id: 'g-9', primary_position: 'Ataque', shirt_name: 'Nove', shirt_number: 9, status: 'ACTIVE', user_id: null },
  { id: 'g-10', primary_position: 'Meio', shirt_name: 'Dez', shirt_number: 10, status: 'ACTIVE', user_id: null },
];

function makeState() {
  const events = [
    { athlete_id: 'g-9', client_event_id: 'c1', event_type: 'GOAL', id: 'e1', minute: 12, recorded_at: '2026-09-09T20:12:00Z', target_athlete_id: 'g-10', team_side: 'MBJ', undone: false },
    { athlete_id: 'g-10', client_event_id: 'c2', event_type: 'GOAL', id: 'e2', minute: 25, recorded_at: '2026-09-09T20:25:00Z', target_athlete_id: null, team_side: 'MBJ', undone: false },
    { athlete_id: 'g-1', client_event_id: 'c3', event_type: 'GOAL', id: 'e3', minute: 30, recorded_at: '2026-09-09T20:30:00Z', target_athlete_id: null, team_side: 'OPPONENT', undone: false },
    { athlete_id: 'g-9', client_event_id: 'c4', event_type: 'YELLOW_CARD', id: 'e4', minute: 40, recorded_at: '2026-09-09T20:40:00Z', target_athlete_id: null, team_side: 'MBJ', undone: false },
    { athlete_id: 'g-2', client_event_id: 'c5', event_type: 'SUBSTITUTION', id: 'e5', minute: 60, recorded_at: '2026-09-09T20:59:00Z', target_athlete_id: 'g-1', team_side: 'MBJ', undone: false },
  ];
  return {
    events,
    finalizeCalls: 0,
    amendCalls: 0,
    nonUndone() {
      return events
        .filter((event) => !event.undone)
        .sort((a, b) => a.minute - b.minute || a.recorded_at.localeCompare(b.recorded_at));
    },
  };
}

const SETUP = {
  created_at: '2026-09-09T20:00:00Z',
  enabled_by: '00000000-0000-4000-8000-0000000c0001',
  match_id: MATCH,
  pending_sync: false,
  recorder_user_id: '00000000-0000-4000-8000-0000000a0001',
  starting_goalkeeper_athlete_id: 'g-1',
  status: 'IN_REVIEW',
  updated_at: '2026-09-09T20:00:00Z',
};

async function routeLive(route: Route, state: ReturnType<typeof makeState>): Promise<'handled' | null> {
  const request = route.request();
  const { pathname } = new URL(request.url());
  const wantsObject = request.headers().accept?.includes('vnd.pgrst.object');
  const body = request.postData()
    ? (JSON.parse(request.postData() as string) as Record<string, unknown>)
    : {};

  if (pathname === '/rest/v1/live_match_setups') {
    await json(route, wantsObject ? SETUP : [SETUP]);
    return 'handled';
  }
  if (pathname === '/rest/v1/athletes') {
    await json(route, ROSTER);
    return 'handled';
  }
  if (pathname === '/rest/v1/live_match_events') {
    await json(route, state.nonUndone());
    return 'handled';
  }
  if (pathname === '/rest/v1/rpc/amend_live_event') {
    state.amendCalls += 1;
    const patch = (body.patch ?? {}) as Record<string, unknown>;
    const target = state.events.find((event) => event.id === body.event_id);
    if (target && typeof patch.target_athlete_id !== 'undefined') {
      target.target_athlete_id = patch.target_athlete_id ? String(patch.target_athlete_id) : null;
    }
    await json(route, { eventId: body.event_id, minute: target?.minute ?? 0 });
    return 'handled';
  }
  if (pathname === '/rest/v1/rpc/finalize_sumula') {
    state.finalizeCalls += 1;
    await json(route, {
      consolidationId: '60000000-0000-4000-8000-0000000000c1',
      matchId: MATCH,
      mbjScore: 2,
      opponentScore: 1,
      revision: 1,
      trophiesAwarded: [],
    });
    return 'handled';
  }
  return null;
}

test('comissão revisa, ajusta assistência e finaliza a súmula (idempotente na UI)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const state = makeState();

  await mockAuthenticatedSession(page, 'COACH', { fullName: 'Comissão Teste' });
  await page.route(SUPABASE, async (route) => {
    if ((await routeLive(route, state)) === null) await route.fallback();
  });

  await page.goto(`/app/partidas/${MATCH}/sumula`);
  await expect(page.getByRole('heading', { name: 'Revisão da súmula' }).first()).toBeVisible();

  // Todos os tipos revisáveis presentes, inclusive a substituição de goleiro (R3).
  await expect(page.getByText('Cartão amarelo')).toBeVisible();
  await expect(page.getByText('Substituição')).toBeVisible();
  await expect(page.getByText(/Placar corrente 2 . 1/)).toBeVisible();

  // Ajustar o autor da assistência do primeiro gol.
  await page
    .getByRole('combobox', { name: 'Assistência' })
    .first()
    .selectOption({ label: '#9 Nove' });
  await expect.poll(() => state.amendCalls).toBeGreaterThan(0);

  // Finalizar.
  await page.getByRole('button', { name: 'Confirmar e Finalizar Súmula' }).click();
  await expect(page.getByText('Súmula finalizada')).toBeVisible();
  await expect(page.getByText(/2\s+×\s+1/)).toBeVisible();
  await expect(page.getByText(/Revisão 1/)).toBeVisible();

  // Sem segunda consolidação: o botão some após o sucesso.
  await expect(page.getByRole('button', { name: 'Confirmar e Finalizar Súmula' })).toHaveCount(0);
  expect(state.finalizeCalls).toBe(1);
});
