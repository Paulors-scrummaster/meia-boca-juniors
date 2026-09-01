import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { createAppQueryClient } from '@/app/providers/QueryProvider';
import type { MatchesService } from '@/features/matches/api/matches.service';
import type { VotingService } from '@/features/mvp-voting/api/voting.service';
import { MvpVotingPage } from '@/features/mvp-voting/pages/MvpVotingPage';
import type { StatisticsService } from '@/features/statistics/api/statistics.service';
import { ConsolidationForm } from '@/features/statistics/components/ConsolidationForm';
import { consolidationSchema } from '@/features/statistics/lib/statistics-validation';
import { ReopenMatchDialog } from '@/features/statistics/components/ReopenMatchDialog';
import { SeasonRankingsPage } from '@/features/statistics/pages/SeasonRankingsPage';

const matchId = '00000000-0000-4000-8000-000000016001';
const seasonId = '00000000-0000-4000-8000-000000016002';
const roundId = '00000000-0000-4000-8000-000000016003';
const voterId = '00000000-0000-4000-8000-000000016004';
const candidateId = '00000000-0000-4000-8000-000000016005';

function renderWithQuery(node: React.ReactNode) {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={createAppQueryClient()}>{node}</QueryClientProvider>
    </MemoryRouter>,
  );
}

function statisticsService(overrides: Partial<StatisticsService> = {}): StatisticsService {
  return {
    consolidate: vi.fn(),
    getSeasonRankings: vi.fn().mockResolvedValue([]),
    reopen: vi.fn(),
    ...overrides,
  };
}

describe('estatísticas e votação do Craque do Jogo', () => {
  it('valida placar, quantidade de contribuições, gol contra e assistência', () => {
    expect(
      consolidationSchema.safeParse({
        goals: [],
        mbjScore: 1,
        opponentScore: 0,
      }).success,
    ).toBe(false);

    expect(
      consolidationSchema.safeParse({
        goals: [
          {
            assistantAthleteId: candidateId,
            isOpponentOwnGoal: true,
            scorerAthleteId: null,
            sequence: 1,
          },
        ],
        mbjScore: 1,
        opponentScore: 0,
      }).success,
    ).toBe(false);

    expect(
      consolidationSchema.safeParse({
        goals: [
          {
            assistantAthleteId: candidateId,
            isOpponentOwnGoal: false,
            scorerAthleteId: candidateId,
            sequence: 1,
          },
        ],
        mbjScore: 1,
        opponentScore: 0,
      }).success,
    ).toBe(false);

    expect(
      consolidationSchema.safeParse({
        goals: [
          {
            assistantAthleteId: null,
            isOpponentOwnGoal: false,
            scorerAthleteId: candidateId,
            sequence: 1,
          },
        ],
        mbjScore: 1,
        opponentScore: 0,
      }).success,
    ).toBe(true);
  });

  it('exige confirmação explícita antes de consolidar e abrir a votação', async () => {
    const user = userEvent.setup();
    const consolidate = vi.fn().mockResolvedValue({
      closesAt: '2026-08-31T18:00:00.000Z',
      consolidationId: '00000000-0000-4000-8000-000000016006',
      lineupId: '00000000-0000-4000-8000-000000016007',
      matchId,
      notificationEventId: '00000000-0000-4000-8000-000000016008',
      opensAt: '2026-08-30T18:00:00.000Z',
      revision: 1,
      votingRoundId: roundId,
    });

    renderWithQuery(
      <ConsolidationForm
        athletes={[{ id: candidateId, shirtName: 'Bia', shirtNumber: 9 }]}
        matchId={matchId}
        service={statisticsService({ consolidate })}
      />,
    );

    await user.clear(screen.getByLabelText('Placar do MBJ'));
    await user.type(screen.getByLabelText('Placar do MBJ'), '1');
    await user.click(screen.getByRole('button', { name: 'Adicionar contribuição' }));
    await user.selectOptions(screen.getByLabelText('Autor do gol 1'), candidateId);
    await user.click(screen.getByRole('button', { name: 'Revisar consolidação' }));

    expect(consolidate).not.toHaveBeenCalled();
    expect(
      screen.getByRole('alertdialog', { name: 'Confirmar consolidação oficial' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Consolidar e abrir votação' }));

    await waitFor(() => expect(consolidate).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Partida consolidada e votação aberta por 24 horas.')).toBeVisible();
  });

  it('exibe rankings e históricos preservados por temporada', async () => {
    const service = statisticsService({
      getSeasonRankings: vi.fn().mockResolvedValue([
        {
          assists: 3,
          athlete_id: candidateId,
          goals: 5,
          mvp_awards: 2,
          presences: 7,
          season_id: seasonId,
          shirt_name: 'Bia',
          shirt_number: 9,
          year: 2026,
        },
      ]),
    });
    const matchesService = {
      listMatches: vi.fn().mockResolvedValue([
        {
          competition_name: 'Amistoso',
          confirmation_deadline: '2026-08-29T18:00:00.000Z',
          created_at: '2026-08-20T18:00:00.000Z',
          created_by: voterId,
          current_consolidation_id: '00000000-0000-4000-8000-000000016010',
          id: matchId,
          location_name: 'Arena MBJ',
          match_date: '2026-08-30T18:00:00.000Z',
          opponent_name: 'Rivais FC',
          schedule_revision: 1,
          season_id: seasonId,
          status: 'COMPLETED',
          updated_at: '2026-08-30T20:00:00.000Z',
          updated_by: voterId,
        },
      ]),
      listSeasons: vi
        .fn()
        .mockResolvedValue([
          { created_at: '2026-01-01T00:00:00.000Z', id: seasonId, is_active: true, year: 2026 },
        ]),
    } as unknown as MatchesService;

    renderWithQuery(<SeasonRankingsPage matchesService={matchesService} service={service} />);

    expect(
      await screen.findByRole('heading', { name: 'Rankings da temporada 2026' }),
    ).toBeVisible();
    expect(await screen.findByRole('row', { name: /Bia.*5.*3.*7.*2/ })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Histórico de partidas' })).toBeVisible();
    expect(screen.getByText('MBJ × Rivais FC')).toBeVisible();
  });

  it('mostra candidatos sem o próprio atleta, countdown e bloqueio após um voto', async () => {
    const castVote = vi.fn();
    const service = {
      castVote,
      close: vi.fn(),
      getLatestResult: vi.fn().mockResolvedValue(null),
      getOpenRound: vi.fn().mockResolvedValue([
        {
          assignment: 'STARTER',
          candidate_athlete_id: candidateId,
          closes_at: '2026-08-31T18:00:00.000Z',
          has_voted: true,
          lineup_id: '00000000-0000-4000-8000-000000016007',
          match_id: matchId,
          opens_at: '2026-08-30T18:00:00.000Z',
          shirt_name: 'Bia',
          shirt_number: 9,
          voter_athlete_id: voterId,
          voting_round_id: roundId,
        },
      ]),
    } as unknown as VotingService;

    renderWithQuery(
      <MvpVotingPage
        now={() => new Date('2026-08-30T18:30:00.000Z').getTime()}
        service={service}
      />,
    );

    expect(await screen.findByText('23h 30min restantes')).toBeVisible();
    expect(screen.getByText('Bia')).toBeVisible();
    expect(screen.queryByText('Meu próprio nome')).not.toBeInTheDocument();
    expect(screen.getByText('Seu voto nesta rodada já foi registrado.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Votar em Bia' })).toBeDisabled();
    expect(castVote).not.toHaveBeenCalled();
  });

  it('exige explicação e confirmação para reabrir a partida', async () => {
    const user = userEvent.setup();
    const reopen = vi.fn().mockResolvedValue({
      invalidatedConsolidationId: '00000000-0000-4000-8000-000000016006',
      invalidatedVotingRoundId: roundId,
      matchId,
      reopenedAt: '2026-08-31T18:00:00.000Z',
    });
    renderWithQuery(
      <ReopenMatchDialog
        matchId={matchId}
        onReopened={vi.fn()}
        service={statisticsService({ reopen })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Reabrir para correção' }));
    await user.click(screen.getByRole('button', { name: 'Revisar reabertura' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Informe a explicação da correção.');

    await user.type(
      screen.getByLabelText('Explicação obrigatória da correção'),
      'Corrigir o segundo gol lançado para o atleta errado.',
    );
    await user.click(screen.getByRole('button', { name: 'Revisar reabertura' }));
    expect(
      screen.getByRole('alertdialog', { name: 'Invalidar consolidação atual?' }),
    ).toBeVisible();
    expect(reopen).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Invalidar e reabrir' }));

    await waitFor(() => expect(reopen).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Partida reaberta para correção.')).toBeVisible();
  });
});
