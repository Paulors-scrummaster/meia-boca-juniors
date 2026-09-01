import { expect, test, type Route } from '@playwright/test';

const coachId = '00000000-0000-4000-8000-000000015001';
const matchId = '00000000-0000-4000-8000-000000015201';
const activeAthleteId = '00000000-0000-4000-8000-000000015301';
const injuredAthleteId = '00000000-0000-4000-8000-000000015302';

function jwt() {
  return `header.${Buffer.from(JSON.stringify({ aal: 'aal2', exp: 2_000_000_000, sub: coachId })).toString('base64url')}.signature`;
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });
}

test('creates, rejects, publishes, republishes and shows the current official lineup', async ({
  page,
}) => {
  let roles = [{ role: 'COACH' }];
  let revision = 1;
  let published: Record<string, unknown>[] = [];

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
          id: coachId,
          email: 'coach@mbj.test',
          role: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2026-08-25T00:00:00.000Z',
          updated_at: '2026-08-25T00:00:00.000Z',
        },
      });
    if (url.pathname === '/auth/v1/user') return json(route, { id: coachId });
    if (url.pathname === '/rest/v1/profiles')
      return json(route, { account_status: 'ACTIVE', id: coachId, must_change_password: false });
    if (url.pathname === '/rest/v1/user_roles') return json(route, roles);
    if (url.pathname === '/rest/v1/allowed_formations')
      return json(route, [
        { code: '4-4-2', display_order: 0, is_active: true },
        { code: '4-3-3', display_order: 1, is_active: true },
      ]);
    if (url.pathname === '/rest/v1/athletes')
      return json(route, [
        {
          id: activeAthleteId,
          full_name: 'Atleta Ativo',
          shirt_name: 'Ativo',
          shirt_number: 9,
          primary_position: 'Atacante',
          status: 'ACTIVE',
        },
        {
          id: injuredAthleteId,
          full_name: 'Atleta Lesionado',
          shirt_name: 'Lesionado',
          shirt_number: 4,
          primary_position: 'Defensor',
          status: 'INJURED',
        },
      ]);
    if (url.pathname === '/rest/v1/match_presences')
      return json(route, [{ athlete_id: activeAthleteId, presence_status: 'CONFIRMED' }]);
    if (url.pathname === '/rest/v1/lineups' && request.method() === 'GET') return json(route, []);
    if (url.pathname === '/rest/v1/lineups' && request.method() === 'POST')
      return json(
        route,
        {
          id: `00000000-0000-4000-8000-00000001540${revision}`,
          match_id: matchId,
          revision,
          formation_code: revision === 1 ? '4-4-2' : '4-3-3',
          status: 'DRAFT',
          created_by: coachId,
          created_at: '2026-08-30T17:00:00.000Z',
          published_by: null,
          published_at: null,
        },
        201,
      );
    if (url.pathname === '/rest/v1/lineup_players')
      return json(route, [], request.method() === 'POST' ? 201 : 200);
    if (url.pathname === '/rest/v1/rpc/publish_lineup') {
      const input = request.postDataJSON();
      published = [
        {
          lineup_id: input.draft_lineup_uuid,
          match_id: matchId,
          revision,
          formation_code: revision === 1 ? '4-4-2' : '4-3-3',
          published_at: '2026-08-30T18:00:00.000Z',
          athlete_id: activeAthleteId,
          assignment: 'STARTER',
          tactical_position: 'ATA',
          position_x: 50,
          position_y: 20,
          display_order: 0,
          shirt_name: 'Ativo',
          shirt_number: 9,
        },
      ];
      const result = {
        lineupId: input.draft_lineup_uuid,
        revision,
        publishedAt: '2026-08-30T18:00:00.000Z',
      };
      revision += 1;
      return json(route, result);
    }
    if (url.pathname === '/rest/v1/published_lineup_view') return json(route, published);
    return json(route, { message: `Mock ausente: ${request.method()} ${url.pathname}` }, 500);
  });

  await page.goto('/login');
  await page.getByLabel('E-mail').fill('coach@mbj.test');
  await page.getByLabel('Senha').fill('senha-local');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.goto(`/app/staff/matches/${matchId}/lineup`);
  await page.getByLabel('Atleta para consultar elegibilidade').selectOption(injuredAthleteId);
  await expect(page.getByRole('alert')).toContainText('lesão');
  await page.getByLabel('Formação').selectOption('4-4-2');
  await page.getByLabel('Adicionar atleta elegível').selectOption(activeAthleteId);
  await page.getByRole('button', { name: 'Adicionar titular' }).click();
  await page.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(page.getByText('Rascunho salvo.')).toBeVisible();
  await page.getByRole('button', { name: 'Publicar escalação oficial' }).click();
  await expect(page.getByText('Escalação oficial publicada.')).toBeVisible();

  await page.getByLabel('Formação').selectOption('4-3-3');
  await page.getByRole('button', { name: 'Salvar como nova versão' }).click();
  await page.getByRole('button', { name: 'Publicar escalação oficial' }).click();
  await expect(page.getByText('Escalação oficial publicada.')).toBeVisible();

  roles = [{ role: 'ATHLETE' }];
  await page.reload();
  await page.goto(`/app/matches/${matchId}/lineup`);
  await expect(page.getByRole('heading', { name: 'Escalação oficial — versão 2' })).toBeVisible();
  await expect(page.getByText('Formação 4-3-3')).toBeVisible();
  await expect(page.getByLabel('Campo tático da escalação oficial')).toContainText('Ativo');
});
