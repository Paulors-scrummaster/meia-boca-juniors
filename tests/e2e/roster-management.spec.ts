import { expect, test, type Route } from '@playwright/test';

const presidentId = '00000000-0000-4000-8000-000000006001';

function jwt() {
  return `header.${Buffer.from(JSON.stringify({ aal: 'aal2', exp: 2_000_000_000, sub: presidentId })).toString('base64url')}.signature`;
}

function user() {
  return {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-08-25T00:00:00.000Z',
    email: 'presidente@mbj.test',
    id: presidentId,
    role: 'authenticated',
    updated_at: '2026-08-25T00:00:00.000Z',
    user_metadata: {},
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

test('cria, edita, inativa, preserva histórico e reutiliza número', async ({ page }) => {
  const invitationOperations: string[] = [];
  const athletes: Array<Record<string, unknown>> = [
    {
      anonymized_at: null,
      created_at: '2026-08-25T00:00:00.000Z',
      full_name: 'Atleta Histórico',
      id: '00000000-0000-4000-8000-000000006101',
      inactivated_at: null,
      photo_path: null,
      primary_position: 'Defensor',
      shirt_name: 'Histórico',
      shirt_number: 5,
      status: 'ACTIVE',
      updated_at: '2026-08-25T00:00:00.000Z',
      user_id: null,
    },
  ];

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
        user: user(),
      });
    if (url.pathname === '/auth/v1/user') return json(route, user());
    if (url.pathname === '/rest/v1/profiles')
      return json(route, {
        account_status: 'ACTIVE',
        id: presidentId,
        must_change_password: false,
      });
    if (url.pathname === '/rest/v1/user_roles') return json(route, [{ role: 'PRESIDENT' }]);
    if (url.pathname === '/rest/v1/athletes') {
      const idFilter = url.searchParams.get('id');
      if (idFilter?.startsWith('eq.'))
        return json(route, athletes.find((item) => item.id === idFilter.slice(3)) ?? null);
      return json(route, athletes);
    }
    if (url.pathname === '/rest/v1/rpc/create_athlete') {
      const input = request.postDataJSON();
      const created = {
        anonymized_at: null,
        created_at: '2026-08-27T00:00:00.000Z',
        full_name: input.full_name_input,
        id: crypto.randomUUID(),
        inactivated_at: null,
        photo_path: input.photo_path_input,
        primary_position: input.primary_position_input,
        shirt_name: input.shirt_name_input,
        shirt_number: input.shirt_number_input,
        status: input.status_input,
        updated_at: '2026-08-27T00:00:00.000Z',
        user_id: null,
      };
      athletes.push(created);
      return json(route, created);
    }
    if (url.pathname === '/rest/v1/rpc/update_athlete') {
      const input = request.postDataJSON();
      const current = athletes.find((item) => item.id === input.athlete_uuid)!;
      Object.assign(current, {
        full_name: input.full_name_input,
        photo_path: input.photo_path_input,
        primary_position: input.primary_position_input,
        shirt_name: input.shirt_name_input,
        shirt_number: input.shirt_number_input,
      });
      return json(route, current);
    }
    if (url.pathname === '/rest/v1/rpc/set_athlete_status') {
      const input = request.postDataJSON();
      const current = athletes.find((item) => item.id === input.athlete_uuid)!;
      Object.assign(current, {
        inactivated_at: '2026-08-27T12:00:00.000Z',
        status: input.target_status,
      });
      return json(route, current);
    }
    if (url.pathname === '/functions/v1/athlete-invitations/manage') {
      const input = request.postDataJSON();
      invitationOperations.push(input.operation);
      return json(route, {
        data: {
          ...(input.operation === 'REVOKE'
            ? {}
            : { deliveryLink: `https://auth.example.test/${input.operation.toLowerCase()}` }),
          invitationId: '00000000-0000-4000-8000-000000006201',
          logicalStatus: input.operation === 'REVOKE' ? 'REVOKED' : 'PENDING',
        },
        traceId: '00000000-0000-4000-8000-000000006299',
      });
    }
    return json(route, { message: `Mock ausente: ${request.method()} ${url.pathname}` }, 500);
  });

  await page.goto('/login');
  await page.getByLabel('E-mail').fill('presidente@mbj.test');
  await page.getByLabel('Senha').fill('senha-local');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.goto('/app/roster');
  await expect(page.getByRole('heading', { name: 'Elenco' })).toBeVisible();

  await page.getByRole('link', { name: 'Cadastrar atleta' }).click();
  await page.getByLabel('Nome completo').fill('Novo Atleta');
  await page.getByLabel('Nome de camisa').fill('Novo');
  await page.getByLabel('Número da camisa').fill('7');
  await page.getByLabel('Posição principal').fill('Atacante');
  await page.getByRole('button', { name: 'Salvar atleta' }).click();
  await expect(page.getByText('Novo Atleta')).toBeVisible();

  await page.getByLabel('E-mail individual').fill('novo-atleta@mbj.example.invalid');
  await page.getByRole('button', { name: 'Gerar convite' }).click();
  await expect(page.getByLabel('Link temporário')).toHaveValue('https://auth.example.test/create');
  await page.getByRole('button', { name: 'Gerar novo link do convite ativo' }).click();
  await expect(page.getByLabel('Link temporário')).toHaveValue('https://auth.example.test/resend');
  await page.getByRole('button', { name: 'Revogar convite ativo' }).click();
  await page.getByRole('button', { name: 'Revogar convite', exact: true }).click();
  await expect(page.getByText('Convite revogado com sucesso.')).toBeVisible();
  expect(invitationOperations).toEqual(['CREATE', 'RESEND', 'REVOKE']);

  await page.getByRole('link', { name: 'Editar perfil' }).click();
  await page.getByLabel('Nome de camisa').fill('Novo 7');
  await page.getByRole('button', { name: 'Salvar atleta' }).click();
  await expect(page.getByText('Novo 7')).toBeVisible();

  await page.getByRole('link', { name: 'Editar perfil' }).click();
  await page.getByLabel('Estado esportivo').selectOption('INACTIVE');
  await page.getByRole('button', { name: 'Salvar atleta' }).click();
  await page.getByRole('button', { name: 'Inativar atleta' }).click();
  await expect(page.getByText('Inativo')).toBeVisible();
  await expect(page.getByText('Histórico esportivo preservado')).toBeVisible();

  await page.goto('/app/admin/roster/new');
  await page.getByLabel('Nome completo').fill('Número Reutilizado');
  await page.getByLabel('Nome de camisa').fill('Reuso');
  await page.getByLabel('Número da camisa').fill('7');
  await page.getByLabel('Posição principal').fill('Meio-campo');
  await page.getByRole('button', { name: 'Salvar atleta' }).click();
  await expect(page.getByText('Número Reutilizado')).toBeVisible();
});

test('gerencia papéis a partir da ficha do atleta, sem exigir o identificador técnico', async ({
  page,
}) => {
  const linkedAthleteId = '00000000-0000-4000-8000-000000006301';
  const linkedUserId = '00000000-0000-4000-8000-000000006302';
  const unlinkedAthleteId = '00000000-0000-4000-8000-000000006303';
  let roles = ['ATHLETE'];

  const athletes: Array<Record<string, unknown>> = [
    {
      anonymized_at: null,
      created_at: '2026-08-25T00:00:00.000Z',
      full_name: 'Atleta Com Conta',
      id: linkedAthleteId,
      inactivated_at: null,
      photo_path: null,
      primary_position: 'Atacante',
      shirt_name: 'ComConta',
      shirt_number: 11,
      status: 'ACTIVE',
      updated_at: '2026-08-25T00:00:00.000Z',
      user_id: linkedUserId,
    },
    {
      anonymized_at: null,
      created_at: '2026-08-25T00:00:00.000Z',
      full_name: 'Atleta Sem Conta',
      id: unlinkedAthleteId,
      inactivated_at: null,
      photo_path: null,
      primary_position: 'Zagueiro',
      shirt_name: 'SemConta',
      shirt_number: 4,
      status: 'ACTIVE',
      updated_at: '2026-08-25T00:00:00.000Z',
      user_id: null,
    },
  ];

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
        user: user(),
      });
    if (url.pathname === '/auth/v1/user') return json(route, user());
    if (url.pathname === '/rest/v1/profiles')
      return json(route, {
        account_status: 'ACTIVE',
        id: presidentId,
        must_change_password: false,
      });
    if (url.pathname === '/rest/v1/user_roles') return json(route, [{ role: 'PRESIDENT' }]);
    if (url.pathname === '/rest/v1/athletes') {
      const idFilter = url.searchParams.get('id');
      if (idFilter?.startsWith('eq.'))
        return json(route, athletes.find((item) => item.id === idFilter.slice(3)) ?? null);
      return json(route, athletes);
    }
    if (url.pathname === '/rest/v1/rpc/get_user_roles') {
      const input = request.postDataJSON();
      expect(input.target_user_id).toBe(linkedUserId);
      return json(route, { roles });
    }
    if (url.pathname === '/rest/v1/rpc/set_user_role') {
      const input = request.postDataJSON();
      roles = input.should_assign
        ? [...roles, input.target_role]
        : roles.filter((role) => role !== input.target_role);
      return json(route, { roles });
    }
    return json(route, { message: `Mock ausente: ${request.method()} ${url.pathname}` }, 500);
  });

  await page.goto('/login');
  await page.getByLabel('E-mail').fill('presidente@mbj.test');
  await page.getByLabel('Senha').fill('senha-local');
  await page.getByRole('button', { name: 'Entrar' }).click();

  // Atleta sem conta vinculada: nada de "Gerenciar papéis" — não há usuário para
  // gerenciar ainda.
  await page.goto(`/app/roster/${unlinkedAthleteId}`);
  await expect(page.getByRole('link', { name: 'Gerenciar papéis' })).toHaveCount(0);

  // Atleta com conta: o link leva direto para a administração de papéis, com o
  // identificador já resolvido pela própria aplicação (FR-014-like UX fix).
  await page.goto(`/app/roster/${linkedAthleteId}`);
  await page.getByRole('link', { name: 'Gerenciar papéis' }).click();
  await expect(page).toHaveURL(`/app/admin?userId=${linkedUserId}`);
  await expect(page.getByRole('heading', { name: 'Papéis de acesso' })).toBeVisible();
  // Nenhum campo de identificador foi preenchido manualmente para chegar aqui.
  await expect(page.getByLabel('Identificador do usuário')).toHaveValue(linkedUserId);

  await page.getByRole('checkbox', { name: 'Técnico' }).click();
  await expect(page.getByText('Papéis atualizados com sucesso.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Técnico' })).toBeChecked();
});
