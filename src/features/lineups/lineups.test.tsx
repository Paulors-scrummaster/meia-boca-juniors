import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createAppQueryClient } from '@/app/providers/QueryProvider';
import {
  lineupDraftSchema,
  type LineupAthlete,
  type PublishedLineupModel,
} from '@/features/lineups/api/lineups.service';
import { FormationSelector } from '@/features/lineups/components/FormationSelector';
import { LineupEditor } from '@/features/lineups/components/LineupEditor';
import { PublishedLineup } from '@/features/lineups/components/PublishedLineup';

const athletes: LineupAthlete[] = [
  {
    full_name: 'Ana Ativa',
    id: '00000000-0000-4000-8000-000000014101',
    primary_position: 'Atacante',
    shirt_name: 'Ana',
    shirt_number: 9,
    status: 'ACTIVE',
  },
  {
    full_name: 'Bia Lesionada',
    id: '00000000-0000-4000-8000-000000014102',
    primary_position: 'Defensora',
    shirt_name: 'Bia',
    shirt_number: 4,
    status: 'INJURED',
  },
];

const published: PublishedLineupModel = {
  formation_code: '4-3-3',
  lineup_id: '00000000-0000-4000-8000-000000014201',
  match_id: '00000000-0000-4000-8000-000000014301',
  published_at: '2026-08-30T18:00:00.000Z',
  revision: 3,
  players: [
    {
      assignment: 'STARTER',
      athlete_id: athletes[0]!.id,
      display_order: 0,
      position_x: 50,
      position_y: 20,
      shirt_name: 'Ana',
      shirt_number: 9,
      tactical_position: 'ATA',
    },
    {
      assignment: 'RESERVE',
      athlete_id: '00000000-0000-4000-8000-000000014103',
      display_order: 0,
      position_x: null,
      position_y: null,
      shirt_name: 'Caio',
      shirt_number: 12,
      tactical_position: null,
    },
  ],
};

function renderLineup(node: React.ReactNode) {
  return render(<QueryClientProvider client={createAppQueryClient()}>{node}</QueryClientProvider>);
}

describe('official lineups', () => {
  it('validates the approved formation mirror and starter coordinates', () => {
    expect(
      lineupDraftSchema.safeParse({
        formationCode: '5-5-0',
        matchId: published.match_id,
        players: [],
      }).success,
    ).toBe(false);
    expect(
      lineupDraftSchema.safeParse({
        formationCode: '4-4-2',
        matchId: published.match_id,
        players: [
          {
            assignment: 'STARTER',
            athleteId: athletes[0]!.id,
            displayOrder: 0,
            positionX: 120,
            positionY: 20,
            tacticalPosition: 'ATA',
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('announces why an athlete is not eligible', async () => {
    const user = userEvent.setup();
    renderLineup(
      <FormationSelector
        athletes={athletes}
        formation="4-4-2"
        onFormationChange={vi.fn()}
        presenceByAthlete={{}}
      />,
    );
    await user.selectOptions(
      screen.getByLabelText('Atleta para consultar elegibilidade'),
      athletes[1]!.id,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não é possível incluir Bia Lesionada: motivo de inelegibilidade — lesão.',
    );
  });

  it('supports keyboard positioning and ordered reserves', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderLineup(
      <LineupEditor
        athletes={athletes.slice(0, 1)}
        onChange={onChange}
        value={{
          formationCode: '4-3-3',
          matchId: published.match_id,
          players: [
            {
              assignment: 'STARTER',
              athleteId: athletes[0]!.id,
              displayOrder: 0,
              positionX: 50,
              positionY: 50,
              tacticalPosition: 'ATA',
            },
          ],
        }}
      />,
    );
    const player = screen.getByRole('button', { name: /Posicionar Ana/ });
    player.focus();
    await user.keyboard('{ArrowRight}{ArrowUp}');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        players: expect.arrayContaining([
          expect.objectContaining({ athleteId: athletes[0]!.id, positionX: 52, positionY: 48 }),
        ]),
      }),
    );
  });

  it('renders only the current version with a semantic alternative to the tactical field', () => {
    renderLineup(<PublishedLineup lineup={published} />);
    expect(screen.getByRole('heading', { name: 'Escalação oficial — versão 3' })).toBeVisible();
    expect(screen.getByLabelText('Campo tático da escalação oficial')).toBeVisible();
    expect(
      screen.getByRole('list', { name: 'Representação textual da escalação' }),
    ).toHaveTextContent('Titular: Ana, camisa 9, posição ATA');
    expect(screen.getByRole('list', { name: 'Reservas em ordem' })).toHaveTextContent(
      'Reserva 1: Caio, camisa 12',
    );
  });
});
