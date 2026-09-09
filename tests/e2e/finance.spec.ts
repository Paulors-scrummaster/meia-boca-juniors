import { expect, test, type Route } from '@playwright/test';

import { json, mockAuthenticatedSession } from './support/auth-mock';

/**
 * quickstart Cenário 1 — geração mensal, badge não-bloqueante e transições de baixa.
 * Como todas as specs e2e, não conversa com um Supabase real: as chamadas REST/RPC
 * são interceptadas e um estado em memória reflete as transições após cada refetch.
 */

const ATHLETE_A = '20000000-0000-4000-8000-0000000000a1';
const ATHLETE_B = '20000000-0000-4000-8000-0000000000b2';

interface Charge {
  amount: number;
  athlete_id: string;
  due_date: string;
  id: string;
  period: string | null;
  season_id: string;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  type: 'MONTHLY_AUTOMATIC' | 'MANUAL_OVERRIDE' | 'EVENT_FEE';
  settled_at: string | null;
  settled_by: string | null;
}

function makeState() {
  let defaultAmount = 0;
  const charges: Charge[] = [];
  let seq = 0;

  function generate(period: string) {
    let created = 0;
    for (const athleteId of [ATHLETE_A, ATHLETE_B]) {
      const exists = charges.some(
        (c) => c.athlete_id === athleteId && c.type === 'MONTHLY_AUTOMATIC' && c.period === period,
      );
      if (exists) continue;
      seq += 1;
      charges.push({
        amount: defaultAmount,
        athlete_id: athleteId,
        due_date: `${period}-10`,
        id: `30000000-0000-4000-8000-00000000${String(seq).padStart(4, '0')}`,
        period,
        season_id: '30000000-0000-4000-8000-000000000001',
        settled_at: null,
        settled_by: null,
        status: 'PENDING',
        type: 'MONTHLY_AUTOMATIC',
      });
      created += 1;
    }
    return {
      activeAthletes: 2,
      created,
      period,
      skippedExempt: 0,
      skippedExisting: 2 - created,
    };
  }

  function overview() {
    return [ATHLETE_A, ATHLETE_B].map((athleteId, index) => {
      const own = charges.filter((c) => c.athlete_id === athleteId);
      const overdue = own.filter((c) => c.status === 'OVERDUE');
      const pending = own.filter((c) => c.status === 'PENDING');
      return {
        athlete_id: athleteId,
        badge: overdue.length > 0 ? 'OVERDUE' : pending.length > 0 ? 'PENDING' : 'NONE',
        full_name: index === 0 ? 'Atleta Alfa' : 'Atleta Beta',
        overdue_amount: overdue.reduce((sum, c) => sum + c.amount, 0),
        overdue_count: overdue.length,
        paid_active_season_amount: own
          .filter((c) => c.status === 'PAID')
          .reduce((sum, c) => sum + c.amount, 0),
        pending_amount: pending.reduce((sum, c) => sum + c.amount, 0),
        pending_count: pending.length,
        shirt_name: index === 0 ? 'Alfa' : 'Beta',
        shirt_number: index + 7,
      };
    });
  }

  function transition(id: string, next: Charge['status']) {
    const charge = charges.find((c) => c.id === id);
    if (!charge) return;
    charge.status = next;
    charge.settled_at = next === 'PAID' ? '2026-09-11T12:00:00Z' : null;
    charge.settled_by = next === 'PAID' ? 'president' : null;
  }

  return {
    charges,
    generate,
    overview,
    setAmount: (value: number) => {
      defaultAmount = value;
    },
    transition,
  };
}

async function routeFinance(route: Route, state: ReturnType<typeof makeState>) {
  const request = route.request();
  const url = new URL(request.url());
  const { pathname } = url;
  const body = request.postData()
    ? (JSON.parse(request.postData() as string) as Record<string, unknown>)
    : {};

  if (pathname === '/rest/v1/athlete_charges') return json(route, state.charges);
  if (pathname === '/rest/v1/finance_overview') return json(route, state.overview());
  if (pathname === '/rest/v1/rpc/set_default_dues_amount') {
    state.setAmount(Number(body.amount));
    return json(route, { defaultAmount: Number(body.amount) });
  }
  if (pathname === '/rest/v1/rpc/run_monthly_dues_generation')
    return json(route, state.generate('2026-09'));
  if (pathname === '/rest/v1/rpc/settle_charge') {
    state.transition(String(body.charge_uuid), 'PAID');
    return json(route, { chargeId: body.charge_uuid, status: 'PAID' });
  }
  if (pathname === '/rest/v1/rpc/reverse_charge_settlement') {
    state.transition(String(body.charge_uuid), 'PENDING');
    return json(route, { chargeId: body.charge_uuid, status: 'PENDING' });
  }
  if (pathname === '/rest/v1/rpc/cancel_charge') {
    state.transition(String(body.charge_uuid), 'CANCELLED');
    return json(route, { chargeId: body.charge_uuid, status: 'CANCELLED' });
  }
  return null;
}

test('diretoria gera mensalidades, dá baixa, estorna e cancela; o badge nunca bloqueia', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const state = makeState();

  await mockAuthenticatedSession(page, 'PRESIDENT', { fullName: 'Presidente Teste' });
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const handled = await routeFinance(route, state);
    if (handled === null) return route.fallback();
  });

  await page.goto('/app/financeiro');
  await expect(page.getByRole('heading', { name: 'Financeiro' })).toBeVisible();

  // Valor padrão + geração.
  await page.getByLabel('Valor padrão (R$)').fill('40');
  await page.getByRole('button', { name: 'Salvar valor' }).click();
  await page.getByRole('button', { name: 'Gerar mensalidades do mês' }).click();
  await expect(page.getByText(/Geração 2026-09: 2 criada/)).toBeVisible();

  // Duas cobranças pendentes, dois badges "Pendente".
  await expect(page.getByText('Pendente', { exact: true })).toHaveCount(2);

  // Dar baixa na primeira cobrança do Atleta Alfa.
  const alfaCard = page.locator('li', { hasText: 'Atleta Alfa' }).first();
  await alfaCard.getByRole('button', { name: 'Dar baixa' }).first().click();
  await page
    .getByRole('dialog', { name: 'Dar baixa na cobrança' })
    .getByRole('button', { name: 'Dar baixa' })
    .click();
  await expect(alfaCard.getByText('Paga')).toBeVisible();
  await expect(alfaCard.getByText('Pendente', { exact: true })).toHaveCount(0);

  // Estornar a baixa → volta a Pendente.
  await alfaCard.getByRole('button', { name: 'Estornar' }).click();
  await page
    .getByRole('dialog', { name: 'Estornar baixa' })
    .getByRole('button', { name: 'Estornar baixa' })
    .click();
  await expect(alfaCard.getByText('Pendente', { exact: true })).toBeVisible();

  // Cancelar a cobrança → Cancelada, sai do badge.
  await alfaCard.getByRole('button', { name: 'Cancelar' }).first().click();
  await page
    .getByRole('dialog', { name: 'Cancelar cobrança' })
    .getByRole('button', { name: 'Cancelar cobrança' })
    .click();
  await expect(alfaCard.getByText('Cancelada')).toBeVisible();
});

test('uma pendência não impede o atleta de abrir Partidas (SC-006)', async ({ page }) => {
  const state = makeState();
  state.setAmount(40);
  state.generate('2026-09');

  await mockAuthenticatedSession(page, 'ATHLETE', { fullName: 'Atleta Teste' });
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/rest/v1/matches') return json(route, []);
    if (url.pathname === '/rest/v1/seasons') return json(route, []);
    const handled = await routeFinance(route, state);
    if (handled === null) return route.fallback();
  });

  await page.goto('/app/athlete/financeiro');
  await expect(page.getByRole('heading', { name: 'Minhas mensalidades' })).toBeVisible();
  await expect(page.getByText('Pendente').first()).toBeVisible();

  await page.goto('/app/matches');
  await expect(page).toHaveURL(/\/app\/matches$/);
});
