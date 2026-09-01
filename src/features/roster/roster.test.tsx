import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { createAppQueryClient } from '@/app/providers/QueryProvider';
import type { Athlete, RosterService } from '@/features/roster/api/roster.service';
import { AthleteForm } from '@/features/roster/components/AthleteForm';
import { athleteInitials } from '@/features/roster/lib/athlete-initials';
import {
  calculateSquareCrop,
  optimizeAvatar,
  validateAvatarFile,
  type AvatarImageAdapter,
} from '@/features/roster/lib/optimize-avatar';
import { RosterPage } from '@/features/roster/pages/RosterPage';

const athlete: Athlete = {
  anonymized_at: null,
  avatar_url: null,
  created_at: '2026-08-25T00:00:00.000Z',
  full_name: 'André da Silva',
  id: '00000000-0000-4000-8000-000000005101',
  inactivated_at: null,
  photo_path: null,
  primary_position: 'Atacante',
  shirt_name: 'André',
  shirt_number: 10,
  status: 'ACTIVE',
  updated_at: '2026-08-25T00:00:00.000Z',
  user_id: null,
};

function rosterService(overrides: Partial<RosterService> = {}): RosterService {
  return {
    anonymizeAthlete: vi.fn(),
    createAthlete: vi.fn(),
    getAthlete: vi.fn().mockResolvedValue(athlete),
    listAthletes: vi.fn().mockResolvedValue([athlete]),
    removeAvatar: vi.fn(),
    setAthleteStatus: vi.fn(),
    updateAthlete: vi.fn(),
    uploadAvatar: vi.fn(),
    ...overrides,
  };
}

function renderWithQuery(node: React.ReactNode) {
  return render(
    <QueryClientProvider client={createAppQueryClient()}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('roster', () => {
  it('gera iniciais determinísticas usando primeiro e último nomes normalizados', () => {
    expect(athleteInitials('  André   da Silva ')).toBe('AS');
    expect(athleteInitials('Pelé')).toBe('P');
    expect(athleteInitials('')).toBe('MB');
  });

  it('valida o tipo da imagem e calcula recorte quadrado central com limite de 1024px', () => {
    expect(() => validateAvatarFile(new File(['x'], 'foto.gif', { type: 'image/gif' }))).toThrow(
      'Envie uma imagem JPEG, PNG ou WebP.',
    );
    expect(calculateSquareCrop(1600, 900, 1024)).toEqual({
      height: 900,
      outputSize: 900,
      width: 900,
      x: 350,
      y: 0,
    });
  });

  it('recorta, converte para WebP e reduz a saída até no máximo 1 MB', async () => {
    const renderSquare = vi
      .fn()
      .mockResolvedValueOnce(new Blob([new Uint8Array(1_100_000)], { type: 'image/webp' }))
      .mockResolvedValueOnce(new Blob([new Uint8Array(900_000)], { type: 'image/webp' }));
    const adapter: AvatarImageAdapter = {
      decode: vi.fn().mockResolvedValue({
        close: vi.fn(),
        height: 1200,
        source: {} as CanvasImageSource,
        width: 1800,
      }),
      renderSquare,
    };

    const output = await optimizeAvatar(
      new File(['image'], 'foto.png', { type: 'image/png' }),
      adapter,
    );

    expect(output.type).toBe('image/webp');
    expect(output.size).toBeLessThanOrEqual(1_048_576);
    expect(renderSquare).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      { height: 1200, outputSize: 1024, width: 1200, x: 300, y: 0 },
      0.82,
    );
    expect(renderSquare).toHaveBeenCalledTimes(2);
  });

  it('otimiza imagens quadradas menores que 256 px sem rejeitá-las', async () => {
    const renderSquare = vi
      .fn()
      .mockResolvedValue(new Blob([new Uint8Array(5_000)], { type: 'image/webp' }));
    const adapter: AvatarImageAdapter = {
      decode: vi.fn().mockResolvedValue({
        close: vi.fn(),
        height: 192,
        source: {} as CanvasImageSource,
        width: 192,
      }),
      renderSquare,
    };

    const output = await optimizeAvatar(
      new File(['image'], 'avatar.png', { type: 'image/png' }),
      adapter,
    );

    expect(output.type).toBe('image/webp');
    expect(output.size).toBe(5_000);
    expect(renderSquare).toHaveBeenCalledWith(
      expect.anything(),
      { height: 192, outputSize: 192, width: 192, x: 0, y: 0 },
      0.82,
    );
  });

  it('filtra a lista por texto e estado com apresentação acessível', async () => {
    const user = userEvent.setup();
    const service = rosterService({
      listAthletes: vi.fn().mockResolvedValue([
        athlete,
        {
          ...athlete,
          full_name: 'Carlos Histórico',
          id: '00000000-0000-4000-8000-000000005102',
          shirt_name: 'Carlos',
          shirt_number: 8,
          status: 'INACTIVE',
          inactivated_at: '2026-08-26T00:00:00.000Z',
        },
      ]),
    });
    renderWithQuery(<RosterPage service={service} canManage />);

    expect(await screen.findByRole('heading', { name: 'Elenco' })).toBeInTheDocument();
    expect(screen.getByText('André da Silva')).toBeInTheDocument();
    expect(screen.getByText('Carlos Histórico')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Filtrar por estado'), 'INACTIVE');
    expect(screen.queryByText('André da Silva')).not.toBeInTheDocument();
    expect(screen.getByText('Carlos Histórico')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar atleta'), 'ninguém');
    expect(screen.getByText('Nenhum atleta encontrado')).toBeInTheDocument();
  });

  it('valida o formulário e envia dados normalizados para criação', async () => {
    const user = userEvent.setup();
    const createAthlete = vi.fn().mockResolvedValue(athlete);
    const onSaved = vi.fn();
    renderWithQuery(<AthleteForm service={rosterService({ createAthlete })} onSaved={onSaved} />);

    await user.click(screen.getByRole('button', { name: 'Salvar atleta' }));
    expect(await screen.findByText('Informe o nome completo.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Nome completo'), '  André   da Silva  ');
    await user.type(screen.getByLabelText('Nome de camisa'), ' André ');
    await user.type(screen.getByLabelText('Número da camisa'), '10');
    await user.type(screen.getByLabelText('Posição principal'), ' Atacante ');
    await user.click(screen.getByRole('button', { name: 'Salvar atleta' }));

    await waitFor(() =>
      expect(createAthlete).toHaveBeenCalledWith({
        fullName: 'André da Silva',
        photoPath: null,
        primaryPosition: 'Atacante',
        shirtName: 'André',
        shirtNumber: 10,
        status: 'ACTIVE',
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(athlete);
  });

  it('exige confirmação explícita antes de inativar um atleta', async () => {
    const user = userEvent.setup();
    const setAthleteStatus = vi.fn().mockResolvedValue({
      ...athlete,
      inactivated_at: '2026-08-27T00:00:00.000Z',
      status: 'INACTIVE',
    });
    renderWithQuery(
      <AthleteForm athlete={athlete} service={rosterService({ setAthleteStatus })} />,
    );

    await user.selectOptions(screen.getByLabelText('Estado esportivo'), 'INACTIVE');
    await user.click(screen.getByRole('button', { name: 'Salvar atleta' }));
    expect(screen.getByRole('alertdialog', { name: 'Inativar atleta?' })).toBeInTheDocument();
    expect(setAthleteStatus).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Inativar atleta' }));
    await waitFor(() => expect(setAthleteStatus).toHaveBeenCalledWith(athlete.id, 'INACTIVE'));
  });
});
