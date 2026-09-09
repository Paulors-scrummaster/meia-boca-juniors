import { expect, test, type Route } from '@playwright/test';

import { json, mockAuthenticatedSession } from './support/auth-mock';

/**
 * quickstart Cenário 3 — súmula ao vivo, desfazer e buffer offline.
 * Como Registrador (atleta, sem papel de comissão). Mock com estado em memória;
 * `state.online` espelha o modo offline do DevTools para que `log_live_event`
 * falhe como falha de rede quando offline.
 */

const MATCH = '50000000-0000-4000-8000-000000000d01';
const RECORDER_ID = '00000000-0000-4000-8000-0000000a0001'; // USER_ID.ATHLETE do auth-mock
const SUPABASE = 'http://127.0.0.1:54321/**';

interface LiveEvent {
  athlete_id: string;
  client_event_id: string;
  event_type: string;
  id: string;
  minute: number;
  recorded_at: string;
  target_athlete_id: string | null;
  team_side: string;
  undone: boolean;
}

const ROSTER = [
  { id: 'a-1', primary_position: 'Goleiro', shirt_name: 'Um', shirt_number: 1, status: 'ACTIVE', user_id: RECORDER_ID },
  { id: 'a-9', primary_position: 'Ataque', shirt_name: 'Nove', shirt_number: 9, status: 'ACTIVE', user_id: null },
  { id: 'a-10', primary_position: 'Meio', shirt_name: 'Dez', shirt_number: 10, status: 'ACTIVE', user_id: null },
];

function makeState() {
  const events: LiveEvent[] = [];
  let seq = 0;
  return {
    events,
    online: true,
    status: 'RECORDING' as 'RECORDING' | 'IN_REVIEW',
    log(body: Record<string, unknown>) {
      const clientEventId = String(body.client_event_id);
      const existing = events.find((event) => event.client_event_id === clientEventId);
      if (existing) return { deduped: true, row: existing };
      seq += 1;
      const row: LiveEvent = {
        athlete_id: String(body.athlete_id),
        client_event_id: clientEventId,
        event_type: String(body.event_type),
        id: `ev-${seq}`,
        minute: Number(body.minute),
        recorded_at: new Date(Date.now() + seq).toISOString(),
        target_athlete_id: body.target_athlete_id ? String(body.target_athlete_id) : null,
        team_side: String(body.team_side ?? 'MBJ'),
        undone: false,
      };
      events.push(row);
      return { deduped: false, row };
    },
    nonUndone() {
      return events
        .filter((event) => !event.undone)
        .sort((a, b) => a.minute - b.minute || a.recorded_at.localeCompare(b.recorded_at));
    },
    undoNewest() {
      const active = this.nonUndone();
      const target = active.at(-1);
      if (!target) return null;
      target.undone = true;
      return target;
    },
  };
}

function setup(state: ReturnType<typeof makeState>) {
  return {
    created_at: '2026-09-09T18:00:00Z',
    enabled_by: '00000000-0000-4000-8000-0000000c0001',
    match_id: MATCH,
    pending_sync: false,
    recorder_user_id: RECORDER_ID,
    starting_goalkeeper_athlete_id: 'a-1',
    status: state.status,
    updated_at: '2026-09-09T18:00:00Z',
  };
}

async function routeLive(route: Route, state: ReturnType<typeof makeState>): Promise<'handled' | null> {
  const request = route.request();
  const { pathname } = new URL(request.url());
  const wantsObject = request.headers().accept?.includes('vnd.pgrst.object');
  const body = request.postData()
    ? (JSON.parse(request.postData() as string) as Record<string, unknown>)
    : {};

  if (pathname === '/rest/v1/live_match_setups') {
    await json(route, wantsObject ? setup(state) : [setup(state)]);
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
  if (pathname === '/rest/v1/rpc/log_live_event') {
    if (!state.online) {
      await route.abort('failed');
      return 'handled';
    }
    const { deduped, row } = state.log(body);
    await json(route, {
      clientEventId: row.client_event_id,
      deduped,
      eventId: row.id,
      eventType: row.event_type,
      minute: row.minute,
    });
    return 'handled';
  }
  if (pathname === '/rest/v1/rpc/undo_live_event') {
    const target = state.undoNewest();
    if (!target) {
      await json(route, { code: 'P0001', message: 'UNDO_WINDOW_EXPIRED' }, 400);
      return 'handled';
    }
    await json(route, {
      clientEventId: target.client_event_id,
      eventId: target.id,
      eventType: target.event_type,
      minute: target.minute,
    });
    return 'handled';
  }
  if (pathname === '/rest/v1/rpc/end_live_recording') {
    state.status = 'IN_REVIEW';
    await json(route, { matchId: MATCH, status: 'IN_REVIEW' });
    return 'handled';
  }
  if (pathname === '/rest/v1/rpc/finalize_sumula') {
    await json(route, { code: '42501', message: 'FORBIDDEN' }, 403);
    return 'handled';
  }
  return null;
}

test('registrador: cronômetro, desfazer, buffer offline e gate de finalização', async ({ page }) => {
  test.setTimeout(90_000);
  const state = makeState();

  await mockAuthenticatedSession(page, 'ATHLETE', { fullName: 'Registrador Teste' });
  await page.route(SUPABASE, async (route) => {
    if ((await routeLive(route, state)) === null) await route.fallback();
  });

  await page.goto(`/app/partidas/${MATCH}/sumula`);
  await expect(page.getByRole('heading', { name: 'Súmula ao vivo' })).toBeVisible();
  await expect(page.getByText('00:00')).toBeVisible();

  await page.getByRole('button', { name: /Iniciar/ }).click();
  await page.getByLabel('Atleta').selectOption({ label: '#9 Nove' });

  // Clique acidental: dois gols.
  await page.getByRole('button', { name: 'Gol', exact: true }).click();
  await page.getByRole('button', { name: 'Gol', exact: true }).click();
  await expect(page.getByTestId('live-score')).toContainText('2');

  // Desfazer imediatamente → volta a 1 gol; o botão então se desativa (janela de 30 s).
  await page.getByRole('button', { name: /Desfazer/ }).click();
  await expect(page.getByTestId('live-score')).toContainText('1');
  await expect(page.getByRole('button', { name: /Desfazer/ })).toBeDisabled();

  // Offline: cartão e substituição vão para a fila IndexedDB.
  await page.context().setOffline(true);
  state.online = false;
  await page.getByRole('button', { name: 'Cartão amarelo' }).click();
  // Substituição é um passo dedicado com papéis explícitos (M7): "Quem entra"
  // fica com o #9 já selecionado; escolhe-se "Quem sai".
  await page.getByRole('button', { name: 'Substituição' }).click();
  await page.getByLabel('Quem sai').selectOption({ label: '#10 Dez' });
  await page.getByRole('button', { name: 'Registrar substituição' }).click();
  await expect(page.getByText(/pendência\(s\) de sincronização/)).toContainText('2');

  // Volta a conexão → a fila drena e o contador zera.
  await page.context().setOffline(false);
  state.online = true;
  await expect(page.getByText('Todos os eventos sincronizados')).toBeVisible({ timeout: 15_000 });

  // Encerrar gravação → revisão; o Registrador não finaliza.
  await page.getByRole('button', { name: /Encerrar gravação/ }).click();
  await expect(page.getByRole('heading', { name: 'Revisão da súmula' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar e Finalizar Súmula' })).toBeDisabled();
  await expect(page.getByText(/Apenas a comissão técnica/)).toBeVisible();
});
