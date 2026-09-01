import { expect, test, type Route } from '@playwright/test';

const userId = '00000000-0000-4000-8000-000000024501';
const matchId = '00000000-0000-4000-8000-000000024502';
const roundId = '00000000-0000-4000-8000-000000024503';

function jwt() {
  return `header.${Buffer.from(
    JSON.stringify({ aal: 'aal2', exp: 2_000_000_000, sub: userId }),
  ).toString('base64url')}.signature`;
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });
}

test('keeps notices and reminders usable through permission denial and provider retry without duplicates', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const notices: Record<string, unknown>[] = [];
  let providerAvailable = false;
  let delivered = false;
  let deliveryAttempts = 0;

  await page.addInitScript(() => {
    class DeniedNotification {
      static permission: NotificationPermission = 'default';
      static async requestPermission(): Promise<NotificationPermission> {
        DeniedNotification.permission = 'denied';
        return 'denied';
      }
    }
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: DeniedNotification,
    });
  });

  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return json(route, null, 204);
    if (url.pathname === '/auth/v1/token')
      return json(route, {
        access_token: jwt(),
        expires_at: 2_000_000_000,
        expires_in: 3600,
        refresh_token: 'refresh',
        token_type: 'bearer',
        user: {
          id: userId,
          email: 'comissao@mbj.test',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2026-08-25T00:00:00.000Z',
          updated_at: '2026-08-25T00:00:00.000Z',
        },
      });
    if (url.pathname === '/auth/v1/user') return json(route, { id: userId });
    if (url.pathname === '/rest/v1/profiles')
      return json(route, { account_status: 'ACTIVE', id: userId, must_change_password: false });
    if (url.pathname === '/rest/v1/user_roles')
      return json(route, [{ role: 'COACH' }, { role: 'ATHLETE' }]);
    if (url.pathname === '/rest/v1/notices' && request.method() === 'GET')
      return json(route, notices);
    if (url.pathname === '/rest/v1/athletes')
      return json(route, [{ full_name: 'Alex Comissão', user_id: userId }]);
    if (url.pathname === '/rest/v1/rpc/publish_notice') {
      const input = request.postDataJSON();
      const published = {
        body: input.body_input,
        id: '00000000-0000-4000-8000-000000024504',
        notificationEventId: '00000000-0000-4000-8000-000000024505',
        publishedAt: '2026-08-29T18:00:00.000Z',
        publishedBy: userId,
        title: input.title_input,
      };
      notices.unshift({
        body: published.body,
        id: published.id,
        published_at: published.publishedAt,
        published_by: published.publishedBy,
        title: published.title,
      });
      return json(route, published);
    }
    if (url.pathname === '/rest/v1/next_match_view')
      return json(route, [
        {
          applicable_deadline: '2026-08-29T21:00:00.000Z',
          id: matchId,
          presence_status: 'PENDING',
        },
      ]);
    if (url.pathname === '/rest/v1/open_mvp_voting_view')
      return json(route, [
        {
          closes_at: '2026-08-30T21:00:00.000Z',
          has_voted: false,
          match_id: matchId,
          voting_round_id: roundId,
        },
      ]);
    if (url.pathname === '/functions/v1/dispatch-notifications') {
      deliveryAttempts += 1;
      if (!providerAvailable)
        return json(route, { error: { code: 'INTEGRATION_UNAVAILABLE' } }, 503);
      const sent = delivered ? 0 : 1;
      delivered = true;
      return json(route, { data: { sent, skipped: 0 }, traceId: 'safe-trace' });
    }
    return json(route, { message: `Mock ausente: ${request.method()} ${url.pathname}` }, 500);
  });

  await page.goto('/login');
  await expect.poll(() => pageErrors).toEqual([]);
  await page.getByLabel('E-mail').fill('comissao@mbj.test');
  await page.getByLabel('Senha').fill('senha-local');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/app\/staff$/);

  await page.goto('/app/notices');
  await page.getByLabel('Título do aviso').fill('Mudança no treino');
  await page
    .getByLabel('Conteúdo do aviso')
    .fill('O treino será realizado no campo principal às 20h.');
  await page.getByRole('button', { name: 'Publicar aviso' }).click();
  await expect(page.getByText('Aviso publicado com sucesso.')).toBeVisible();
  await expect(page.getByRole('article')).toContainText('Mudança no treino');

  await expect(page.getByRole('region', { name: 'Ações pendentes' })).toContainText(
    'Confirme sua presença',
  );
  await expect(page.getByRole('region', { name: 'Ações pendentes' })).toContainText(
    'Vote no Craque do Jogo',
  );

  await page.goto('/app/notification-preferences');
  await page.getByRole('button', { name: 'Ativar notificações' }).click();
  await expect(page.getByText(/Você recusou as notificações/)).toBeVisible();
  await expect(
    page.getByText(/As pendências continuam disponíveis dentro do aplicativo/),
  ).toBeVisible();

  const firstDispatchStatus = await page.evaluate(
    async () => (await fetch('http://127.0.0.1:54321/functions/v1/dispatch-notifications')).status,
  );
  expect(firstDispatchStatus).toBe(503);
  expect(notices).toHaveLength(1);

  providerAvailable = true;
  const retryResults = await page.evaluate(async () => {
    const first = await fetch('http://127.0.0.1:54321/functions/v1/dispatch-notifications');
    const second = await fetch('http://127.0.0.1:54321/functions/v1/dispatch-notifications');
    return [await first.json(), await second.json()];
  });
  expect(retryResults[0].data.sent).toBe(1);
  expect(retryResults[1].data.sent).toBe(0);
  expect(deliveryAttempts).toBe(3);
});
