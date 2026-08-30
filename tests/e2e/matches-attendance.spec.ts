import { expect, test, type Route } from '@playwright/test';

const presidentId = '00000000-0000-4000-8000-000000011001';
const matchId = '00000000-0000-4000-8000-000000011201';

function jwt() {
  return `header.${Buffer.from(JSON.stringify({ aal: 'aal2', exp: 2_000_000_000, sub: presidentId })).toString('base64url')}.signature`;
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });
}

test('covers match lifecycle, call-ups, privacy, attendance, cancellation and rescheduling', async ({
  page,
}) => {
  let roles = [{ role: 'PRESIDENT' }];
  const match = {
    competition_name: 'Liga de Teste',
    confirmation_deadline: '2027-08-29T18:00:00.000Z',
    id: matchId,
    location_name: 'Campo Fictício',
    match_date: '2027-08-30T18:00:00.000Z',
    opponent_name: 'Adversário E2E',
    schedule_revision: 1,
    season_id: '00000000-0000-4000-8000-000000011101',
    status: 'SCHEDULED',
  };
  const attendance = [
    {
      applicable_deadline: match.confirmation_deadline,
      athlete_id: '00000000-0000-4000-8000-000000011301',
      athlete_name: 'Atleta Convocado',
      call_revision: 1,
      call_status: 'CALLED',
      individual_deadline: null,
      is_exceptional_call: false,
      match_id: matchId,
      presence_id: '00000000-0000-4000-8000-000000011401',
      presence_status: 'PENDING',
      reason: 'Motivo protegido',
      responded_at: null,
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
        user: {
          app_metadata: {},
          aud: 'authenticated',
          created_at: '2026-08-25T00:00:00.000Z',
          email: 'president@mbj.test',
          id: presidentId,
          role: 'authenticated',
          updated_at: '2026-08-25T00:00:00.000Z',
          user_metadata: {},
        },
      });
    if (url.pathname === '/auth/v1/user') return json(route, { id: presidentId });
    if (url.pathname === '/rest/v1/profiles')
      return json(route, {
        account_status: 'ACTIVE',
        id: presidentId,
        must_change_password: false,
      });
    if (url.pathname === '/rest/v1/user_roles') return json(route, roles);
    if (url.pathname === '/rest/v1/seasons')
      return json(route, [
        {
          created_at: '2026-01-01T00:00:00.000Z',
          id: match.season_id,
          is_active: true,
          year: 2026,
        },
      ]);
    if (url.pathname === '/rest/v1/athletes')
      return json(route, [
        {
          anonymized_at: null,
          created_at: '2026-01-01T00:00:00.000Z',
          full_name: 'Atleta Convocado',
          id: attendance[0].athlete_id,
          inactivated_at: null,
          photo_path: null,
          primary_position: 'Atacante',
          shirt_name: 'Convocado',
          shirt_number: 9,
          status: 'ACTIVE',
          updated_at: '2026-01-01T00:00:00.000Z',
          user_id: presidentId,
        },
      ]);
    if (url.pathname === '/rest/v1/matches') return json(route, [match]);
    if (url.pathname === '/rest/v1/staff_attendance_view') return json(route, attendance);
    if (url.pathname === '/rest/v1/next_match_view')
      return json(route, {
        applicable_deadline: attendance[0].applicable_deadline,
        call_status: attendance[0].call_status,
        competition_name: match.competition_name,
        confirmation_deadline: match.confirmation_deadline,
        id: matchId,
        individual_deadline: attendance[0].individual_deadline,
        is_exceptional_call: attendance[0].is_exceptional_call,
        location_name: match.location_name,
        match_date: match.match_date,
        opponent_name: match.opponent_name,
        presence_id: attendance[0].presence_id,
        presence_status: attendance[0].presence_status,
        schedule_revision: match.schedule_revision,
        season_id: match.season_id,
        status: match.status,
      });
    if (url.pathname === '/rest/v1/rpc/create_match') return json(route, match);
    if (url.pathname === '/rest/v1/rpc/set_match_callups') return json(route, { matchId });
    if (url.pathname === '/rest/v1/rpc/create_exceptional_call') {
      attendance[0] = {
        ...attendance[0],
        call_revision: attendance[0].call_revision + 1,
        individual_deadline: request.postDataJSON().individual_deadline_input,
        is_exceptional_call: true,
        presence_status: 'PENDING',
      };
      return json(route, attendance[0]);
    }
    if (url.pathname === '/rest/v1/rpc/respond_to_call') {
      const input = request.postDataJSON();
      attendance[0] = {
        ...attendance[0],
        presence_status: input.target_status,
        reason: input.target_status === 'DECLINED' ? input.refusal_reason : null,
      };
      return json(route, attendance[0]);
    }
    if (url.pathname === '/rest/v1/rpc/admin_set_presence') {
      attendance[0] = { ...attendance[0], presence_status: request.postDataJSON().target_status };
      return json(route, attendance[0]);
    }
    if (url.pathname === '/rest/v1/rpc/cancel_match') {
      match.status = 'CANCELLED';
      return json(route, match);
    }
    if (url.pathname === '/rest/v1/rpc/reactivate_match') {
      match.status = 'SCHEDULED';
      return json(route, match);
    }
    if (url.pathname === '/rest/v1/rpc/reschedule_match') {
      match.schedule_revision += 1;
      attendance[0] = { ...attendance[0], presence_status: 'PENDING', reason: null };
      return json(route, { matchId, resetCount: 1, scheduleRevision: match.schedule_revision });
    }
    return json(route, { message: `Mock ausente: ${request.method()} ${url.pathname}` }, 500);
  });

  await page.goto('/login');
  await page.getByLabel('E-mail').fill('president@mbj.test');
  await page.getByLabel('Senha').fill('senha-local');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.goto('/app/staff/matches/new');
  await page.getByLabel('Temporada').selectOption(match.season_id);
  await page.getByLabel('Adversário').fill('Adversário E2E');
  await page.getByLabel('Data e hora da partida').fill('2027-08-30T15:00');
  await page.getByLabel('Prazo de confirmação').fill('2027-08-29T15:00');
  await page.getByRole('button', { name: 'Salvar partida' }).click();
  await expect(page.getByText('Partida salva.')).toBeVisible();

  await page.goto(`/app/staff/matches/${matchId}/attendance`);
  await expect(page.getByRole('heading', { name: 'Painel de presenças' })).toBeVisible();
  await expect(page.getByText('Motivo protegido')).toBeVisible();
  await page.getByLabel('Estado de Atleta Convocado').selectOption('CONFIRMED');
  await page
    .getByLabel('Explicação da alteração de Atleta Convocado')
    .fill('Confirmado por telefone');
  await page.getByRole('button', { name: 'Salvar presença de Atleta Convocado' }).click();
  await expect(page.getByText('Presença atualizada.')).toBeVisible();

  await page.goto(`/app/staff/matches/${matchId}/edit`);
  await expect(page.getByRole('heading', { name: 'Convocação' })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar convocação' }).click();
  await expect(page.getByText('Convocação atualizada.')).toBeVisible();
  await page.getByLabel('Atleta da convocação excepcional').selectOption(attendance[0].athlete_id);
  await page.getByLabel('Prazo individual').fill('2027-08-30T14:00');
  await page.getByRole('button', { name: 'Criar convocação excepcional' }).click();
  await expect(page.getByText('Convocação excepcional criada.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar partida' }).click();
  await expect(page.getByText('Partida cancelada.')).toBeVisible();
  await page.getByRole('button', { name: 'Reativar partida' }).click();
  await expect(page.getByText('Partida reativada.')).toBeVisible();
  await page.getByLabel('Data e hora da partida').fill('2027-09-06T15:00');
  await page.getByLabel('Prazo de confirmação').fill('2027-09-05T15:00');
  await page.getByRole('button', { name: 'Salvar partida' }).click();
  await expect(page.getByText(/reconfirmação solicitada/i)).toBeVisible();

  roles = [{ role: 'ATHLETE' }];
  await page.reload();
  await page.goto(`/app/athlete/matches/${matchId}/attendance`);
  await expect(page.getByRole('heading', { name: 'Pendente' })).toBeVisible();
  await expect(page.getByText('Motivo protegido')).not.toBeVisible();
  await page.getByRole('button', { name: 'Recusar presença' }).click();
  await page.getByLabel('Motivo da recusa').fill('Compromisso do atleta');
  await page.getByRole('button', { name: 'Confirmar recusa' }).click();
  await expect(page.getByText('Resposta registrada.')).toBeVisible();
});
