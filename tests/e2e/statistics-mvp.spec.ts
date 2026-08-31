import { expect, test, type Route } from '@playwright/test';

const presidentId = '00000000-0000-4000-8000-000000017001';
const athleteAUserId = '00000000-0000-4000-8000-000000017002';
const athleteBUserId = '00000000-0000-4000-8000-000000017003';
const athleteAId = '00000000-0000-4000-8000-000000017011';
const athleteBId = '00000000-0000-4000-8000-000000017012';
const matchId = '00000000-0000-4000-8000-000000017020';
const seasonId = '00000000-0000-4000-8000-000000017021';
const capturedLineupId = '00000000-0000-4000-8000-000000017030';
const newerLineupId = '00000000-0000-4000-8000-000000017031';
const futureVotingClosesAt = '2099-08-31T18:00:00.000Z';

function jwt(userId: string) {
  return `header.${Buffer.from(JSON.stringify({ aal: 'aal2', exp: 2_000_000_000, sub: userId })).toString('base64url')}.signature`;
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status });
}

test('consolida, empata, reabre, reconsolida, permite novo voto e preserva histórico', async ({
  page,
}) => {
  test.setTimeout(60_000);

  let activeUserId = presidentId;
  let role: 'ATHLETE' | 'PRESIDENT' = 'PRESIDENT';
  let currentRevision = 0;
  let currentRound = '';
  let currentConsolidation: string | null = null;
  let roundClosed = false;
  const votes = new Map<string, Set<string>>();

  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'OPTIONS') return json(route, null, 204);
    if (url.pathname === '/auth/v1/token')
      return json(route, {
        access_token: jwt(activeUserId),
        expires_at: 2_000_000_000,
        expires_in: 3600,
        refresh_token: 'refresh',
        token_type: 'bearer',
        user: {
          id: activeUserId,
          email: `${role.toLowerCase()}@mbj.test`,
          role: 'authenticated',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2026-08-25T00:00:00.000Z',
          updated_at: '2026-08-25T00:00:00.000Z',
        },
      });
    if (url.pathname === '/auth/v1/user') return json(route, { id: activeUserId });
    if (url.pathname === '/rest/v1/profiles')
      return json(route, {
        account_status: 'ACTIVE',
        id: activeUserId,
        must_change_password: false,
      });
    if (url.pathname === '/rest/v1/user_roles') return json(route, [{ role }]);
    if (url.pathname === '/rest/v1/published_lineup_view')
      return json(route, [
        {
          assignment: 'STARTER',
          athlete_id: athleteAId,
          display_order: 0,
          formation_code: '4-4-2',
          lineup_id: currentRevision === 0 ? capturedLineupId : newerLineupId,
          match_id: matchId,
          position_x: 40,
          position_y: 30,
          published_at: '2026-08-30T18:00:00.000Z',
          revision: currentRevision === 0 ? 1 : 2,
          shirt_name: 'Ana',
          shirt_number: 8,
          tactical_position: 'MEI',
        },
        {
          assignment: 'STARTER',
          athlete_id: athleteBId,
          display_order: 1,
          formation_code: '4-4-2',
          lineup_id: currentRevision === 0 ? capturedLineupId : newerLineupId,
          match_id: matchId,
          position_x: 60,
          position_y: 20,
          published_at: '2026-08-30T18:00:00.000Z',
          revision: currentRevision === 0 ? 1 : 2,
          shirt_name: 'Bia',
          shirt_number: 9,
          tactical_position: 'ATA',
        },
      ]);
    if (url.pathname === '/rest/v1/matches')
      return json(route, [
        {
          competition_name: 'Amistoso',
          confirmation_deadline: '2026-08-29T18:00:00.000Z',
          created_at: '2026-08-20T18:00:00.000Z',
          created_by: presidentId,
          current_consolidation_id: currentConsolidation,
          id: matchId,
          location_name: 'Arena MBJ',
          match_date: '2026-08-30T18:00:00.000Z',
          opponent_name: 'Rivais FC',
          schedule_revision: 1,
          season_id: seasonId,
          status: currentConsolidation ? 'COMPLETED' : 'SCHEDULED',
          updated_at: '2026-08-30T20:00:00.000Z',
          updated_by: presidentId,
        },
      ]);
    if (url.pathname === '/rest/v1/seasons')
      return json(route, [
        { created_at: '2026-01-01T00:00:00.000Z', id: seasonId, is_active: true, year: 2026 },
      ]);
    if (url.pathname === '/rest/v1/season_rankings_view')
      return json(route, [
        {
          assists: 0,
          athlete_id: athleteAId,
          goals: currentRevision === 2 ? 1 : 0,
          mvp_awards: 0,
          presences: 1,
          season_id: seasonId,
          shirt_name: 'Ana',
          shirt_number: 8,
          year: 2026,
        },
      ]);
    if (url.pathname === '/rest/v1/rpc/consolidate_match') {
      currentRevision += 1;
      currentConsolidation = `00000000-0000-4000-8000-00000001704${currentRevision}`;
      currentRound = `00000000-0000-4000-8000-00000001705${currentRevision}`;
      roundClosed = false;
      return json(route, {
        closesAt: futureVotingClosesAt,
        consolidationId: currentConsolidation,
        lineupId: currentRevision === 1 ? capturedLineupId : newerLineupId,
        matchId,
        notificationEventId: `00000000-0000-4000-8000-00000001706${currentRevision}`,
        opensAt: '2026-08-30T18:00:00.000Z',
        revision: currentRevision,
        votingRoundId: currentRound,
      });
    }
    if (url.pathname === '/rest/v1/rpc/reopen_match_statistics') {
      const invalidatedConsolidation = currentConsolidation;
      const invalidatedRound = currentRound;
      currentConsolidation = null;
      currentRound = '';
      roundClosed = false;
      return json(route, {
        invalidatedConsolidationId: invalidatedConsolidation,
        invalidatedVotingRoundId: invalidatedRound,
        matchId,
        reopenedAt: '2026-08-31T19:00:00.000Z',
      });
    }
    if (url.pathname === '/rest/v1/open_mvp_voting_view') {
      if (!currentRound || roundClosed) return json(route, []);
      const voterAthleteId = activeUserId === athleteAUserId ? athleteAId : athleteBId;
      const candidateAthleteId = voterAthleteId === athleteAId ? athleteBId : athleteAId;
      const candidateName = candidateAthleteId === athleteAId ? 'Ana' : 'Bia';
      const hasVoted = votes.get(currentRound)?.has(voterAthleteId) ?? false;
      return json(route, [
        {
          assignment: 'STARTER',
          candidate_athlete_id: candidateAthleteId,
          closes_at: futureVotingClosesAt,
          has_voted: hasVoted,
          lineup_id: currentRevision === 1 ? capturedLineupId : newerLineupId,
          match_id: matchId,
          opens_at: '2026-08-30T18:00:00.000Z',
          shirt_name: candidateName,
          shirt_number: candidateAthleteId === athleteAId ? 8 : 9,
          voter_athlete_id: voterAthleteId,
          voting_round_id: currentRound,
        },
      ]);
    }
    if (url.pathname === '/rest/v1/rpc/cast_mvp_vote') {
      const input = request.postDataJSON();
      const voterAthleteId = activeUserId === athleteAUserId ? athleteAId : athleteBId;
      const roundVotes = votes.get(input.voting_round_uuid) ?? new Set<string>();
      roundVotes.add(voterAthleteId);
      votes.set(input.voting_round_uuid, roundVotes);
      if (currentRevision === 1 && roundVotes.size === 2) roundClosed = true;
      return json(route, {
        createdAt: '2026-08-30T19:00:00.000Z',
        voteId: `00000000-0000-4000-8000-00000001707${roundVotes.size}`,
        votingRoundId: input.voting_round_uuid,
      });
    }
    if (url.pathname === '/rest/v1/mvp_voting_rounds')
      return json(
        route,
        roundClosed
          ? [
              {
                closed_at: '2026-08-31T18:00:01.000Z',
                closes_at: futureVotingClosesAt,
                consolidation_id: currentConsolidation,
                created_by: presidentId,
                id: currentRound,
                invalidated_at: null,
                opens_at: '2026-08-30T18:00:00.000Z',
                status: 'CLOSED',
              },
            ]
          : [],
      );
    if (url.pathname === '/rest/v1/match_consolidations')
      return json(
        route,
        currentConsolidation ? [{ id: currentConsolidation, status: 'VALID' }] : [],
      );
    if (url.pathname === '/rest/v1/mvp_awards')
      return json(route, [
        {
          athlete_id: athleteAId,
          awarded_at: '2026-08-31T18:00:01.000Z',
          invalidated_at: null,
          vote_count: 1,
          voting_round_id: currentRound,
        },
        {
          athlete_id: athleteBId,
          awarded_at: '2026-08-31T18:00:01.000Z',
          invalidated_at: null,
          vote_count: 1,
          voting_round_id: currentRound,
        },
      ]);
    if (url.pathname === '/rest/v1/athletes')
      return json(route, [
        { id: athleteAId, shirt_name: 'Ana', shirt_number: 8 },
        { id: athleteBId, shirt_name: 'Bia', shirt_number: 9 },
      ]);
    return json(route, { message: `Mock ausente: ${request.method()} ${url.pathname}` }, 500);
  });

  await page.goto('/login');
  await page.getByLabel('E-mail').fill('presidente@mbj.test');
  await page.getByLabel('Senha').fill('senha-local');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.goto(`/app/admin/matches/${matchId}/statistics`);
  await page.getByLabel('Placar do MBJ').fill('2');
  await page.getByRole('button', { name: 'Adicionar contribuição' }).click();
  await page.getByRole('button', { name: 'Adicionar contribuição' }).click();
  await page.getByLabel('Autor do gol 1').selectOption(athleteAId);
  await page.getByLabel('Autor do gol 2').selectOption(athleteBId);
  await page.getByRole('button', { name: 'Revisar consolidação' }).click();
  await page.getByRole('button', { name: 'Consolidar e abrir votação' }).click();
  await expect(page.getByText('Partida consolidada e votação aberta por 24 horas.')).toBeVisible();

  role = 'ATHLETE';
  activeUserId = athleteAUserId;
  await page.reload();
  await page.goto('/app/athlete/mvp-voting');
  await page.getByRole('button', { name: 'Votar em Bia' }).click();
  await expect(page.getByText('Voto registrado com sucesso.')).toBeVisible();

  activeUserId = athleteBUserId;
  await page.reload();
  await page.goto('/app/athlete/mvp-voting');
  await page.getByRole('button', { name: 'Votar em Ana' }).click();
  await expect(page.getByRole('heading', { name: 'Resultado do Craque do Jogo' })).toBeVisible();
  await expect(page.getByText('Ana e Bia')).toBeVisible();

  role = 'PRESIDENT';
  activeUserId = presidentId;
  await page.reload();
  await page.goto(`/app/admin/matches/${matchId}/statistics`);
  await page.getByRole('button', { name: 'Reabrir para correção' }).click();
  await page
    .getByLabel('Explicação obrigatória da correção')
    .fill('Corrigir o placar e os autores dos gols lançados anteriormente.');
  await page.getByRole('button', { name: 'Revisar reabertura' }).click();
  await page.getByRole('button', { name: 'Invalidar e reabrir' }).click();
  await expect(page.getByText('Partida reaberta para correção.')).toBeVisible();

  await page.getByLabel('Placar do MBJ').fill('1');
  await page.getByRole('button', { name: 'Adicionar contribuição' }).click();
  await page.getByLabel('Autor do gol 1').selectOption(athleteAId);
  await page.getByRole('button', { name: 'Revisar consolidação' }).click();
  await page.getByRole('button', { name: 'Consolidar e abrir votação' }).click();

  role = 'ATHLETE';
  activeUserId = athleteAUserId;
  await page.reload();
  await page.goto('/app/athlete/mvp-voting');
  await page.getByRole('button', { name: 'Votar em Bia' }).click();
  await expect(page.getByText('Voto registrado com sucesso.')).toBeVisible();
  expect(votes.get('00000000-0000-4000-8000-000000017051')?.has(athleteAId)).toBe(true);
  expect(votes.get('00000000-0000-4000-8000-000000017052')?.has(athleteAId)).toBe(true);

  await page.goto('/app/statistics');
  await expect(page.getByRole('heading', { name: 'Rankings da temporada 2026' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Ana.*1.*0.*1.*0/ })).toBeVisible();
});
