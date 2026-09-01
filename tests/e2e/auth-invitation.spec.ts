import { expect, test, type Route } from '@playwright/test';

const userId = '00000000-0000-4000-8000-000000000101';
const invitationId = '00000000-0000-4000-8000-000000000202';

function jwt(aal: 'aal1' | 'aal2') {
  const encoded = Buffer.from(JSON.stringify({ aal, exp: 2_000_000_000, sub: userId })).toString(
    'base64url',
  );
  return `header.${encoded}.local-signature`;
}

function authUser() {
  return {
    app_metadata: { provider: 'email', providers: ['email'] },
    aud: 'authenticated',
    confirmed_at: '2026-08-25T00:00:00.000Z',
    created_at: '2026-08-25T00:00:00.000Z',
    email: 'atleta@mbj.test',
    factors: [
      {
        created_at: '2026-08-25T00:00:00.000Z',
        factor_type: 'totp',
        friendly_name: 'MBJ',
        id: 'factor-1',
        status: 'verified',
        updated_at: '2026-08-25T00:00:00.000Z',
      },
    ],
    id: userId,
    role: 'authenticated',
    updated_at: '2026-08-25T00:00:00.000Z',
    user_metadata: {},
  };
}

function authSession(aal: 'aal1' | 'aal2') {
  return {
    access_token: jwt(aal),
    expires_at: 2_000_000_000,
    expires_in: 3600,
    refresh_token: `refresh-${aal}`,
    token_type: 'bearer',
    user: authUser(),
  };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    status,
  });
}

test('ativa convite individual e libera a união de papéis somente após MFA', async ({ page }) => {
  let activated = false;
  let aal: 'aal1' | 'aal2' = 'aal1';
  let roles = ['ATHLETE'];

  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'OPTIONS') return json(route, null, 204);
    if (url.pathname === '/auth/v1/token') return json(route, authSession(aal));
    if (url.pathname === '/auth/v1/user' && request.method() === 'GET') {
      return json(route, authUser());
    }
    if (url.pathname === '/auth/v1/user' && request.method() === 'PUT') {
      return json(route, { user: authUser() });
    }
    if (url.pathname === '/rest/v1/profiles') {
      return json(
        route,
        activated ? { account_status: 'ACTIVE', id: userId, must_change_password: false } : null,
      );
    }
    if (url.pathname === '/rest/v1/user_roles') {
      return json(route, activated ? roles.map((role) => ({ role })) : []);
    }
    if (url.pathname === '/functions/v1/athlete-invitations/accept') {
      activated = true;
      return json(route, {
        data: { athleteId: userId, mustChangePassword: false, roles: ['ATHLETE'] },
        traceId: invitationId,
      });
    }
    if (url.pathname === '/rest/v1/rpc/complete_forced_password_change') return json(route, {});
    if (url.pathname === '/auth/v1/factors' && request.method() === 'GET') {
      return json(route, {
        all: [{ factor_type: 'totp', friendly_name: 'MBJ', id: 'factor-1', status: 'verified' }],
        phone: [],
        totp: [{ factor_type: 'totp', friendly_name: 'MBJ', id: 'factor-1', status: 'verified' }],
      });
    }
    if (url.pathname.endsWith('/challenge')) {
      return json(route, { expires_at: 2_000_000_000, id: 'challenge-1' });
    }
    if (url.pathname.endsWith('/verify')) {
      aal = 'aal2';
      return json(route, authSession('aal2'));
    }
    if (url.pathname === '/rest/v1/rpc/set_user_role') {
      return json(
        route,
        {
          error: {
            code: 'FORBIDDEN',
            fieldErrors: {},
            message: 'Você não tem permissão para realizar esta ação.',
          },
          traceId: invitationId,
        },
        403,
      );
    }

    return json(route, { message: `Mock ausente para ${request.method()} ${url.pathname}` }, 500);
  });

  await page.goto(`/convite?invitationId=${invitationId}`);
  await page.getByRole('link', { name: 'Entrar para continuar' }).click();
  await page.getByLabel('E-mail').fill('atleta@mbj.test');
  await page.getByLabel('Senha').fill('senha-temporaria');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('Identidade de acesso confirmada')).toBeVisible();

  await page.getByLabel('Crie sua senha').fill('senha-definitiva');
  await page.getByLabel('Confirme sua senha').fill('senha-definitiva');
  await page.getByRole('button', { name: 'Confirmar e ativar conta' }).click();
  await expect(page.getByRole('heading', { name: 'Área do atleta' })).toBeVisible();

  roles = ['ATHLETE', 'COACH', 'PRESIDENT'];
  await page.reload();
  await expect(page.getByRole('link', { name: 'Administração' })).toBeVisible();
  await page.getByRole('link', { name: 'Administração' }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  await expect(page.getByRole('heading', { name: 'Verificação em duas etapas' })).toBeVisible();
  await page.getByLabel('Código de 6 números').fill('123456');
  await page.getByRole('button', { name: 'Verificar código' }).click();
  await expect(page.getByRole('heading', { name: 'Gerenciar acessos' })).toBeVisible();
  const navigationBox = await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .boundingBox();
  const mainBox = await page.getByRole('main').boundingBox();
  expect(navigationBox).not.toBeNull();
  expect(mainBox).not.toBeNull();
  if (page.viewportSize()!.width >= 768) {
    expect(mainBox!.x).toBeGreaterThan(navigationBox!.x + navigationBox!.width - 1);
    expect(mainBox!.width).toBeGreaterThan(600);
  } else {
    expect(mainBox!.width).toBeGreaterThan(300);
  }
  await expect(page.getByRole('link', { name: 'Área do atleta' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Comissão técnica' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Administração' })).toBeVisible();

  const forbidden = await page.evaluate(async () => {
    const response = await fetch('http://127.0.0.1:54321/rest/v1/rpc/set_user_role', {
      body: JSON.stringify({ should_assign: true, target_role: 'PRESIDENT' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
    return { body: await response.json(), status: response.status };
  });
  expect(forbidden.status).toBe(403);
  expect(forbidden.body.error.code).toBe('FORBIDDEN');
});
