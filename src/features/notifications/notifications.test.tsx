import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAppQueryClient } from '@/app/providers/QueryProvider';
import type { NoticesService } from '@/features/notices/api/notices.service';
import { NoticesPage } from '@/features/notices/pages/NoticesPage';
import type { NotificationsService } from '@/features/notifications/api/notifications.service';
import { PendingActionsBanner } from '@/features/notifications/components/PendingActionsBanner';
import {
  PushPermissionCard,
  type PushPermissionAdapter,
} from '@/features/notifications/components/PushPermissionCard';

function renderFeature(node: React.ReactNode) {
  return render(
    <QueryClientProvider client={createAppQueryClient()}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('notices and notification fallbacks', () => {
  beforeEach(() => window.localStorage.clear());

  it('renders the chronological notice wall and publishes through an online-guarded form', async () => {
    const user = userEvent.setup();
    const notices = [
      {
        authorName: 'Alex Comissão',
        body: 'Treino confirmado para quinta-feira.',
        id: '00000000-0000-4000-8000-000000024002',
        published_at: '2026-08-28T18:00:00.000Z',
        published_by: '00000000-0000-4000-8000-000000024101',
        title: 'Treino confirmado',
      },
      {
        authorName: 'Bruna Presidência',
        body: 'Levar o uniforme azul completo.',
        id: '00000000-0000-4000-8000-000000024001',
        published_at: '2026-08-27T18:00:00.000Z',
        published_by: '00000000-0000-4000-8000-000000024102',
        title: 'Uniforme da rodada',
      },
    ];
    const service: NoticesService = {
      list: vi.fn().mockResolvedValue(notices),
      publish: vi.fn().mockResolvedValue({
        body: 'Chegar com 30 minutos de antecedência.',
        id: '00000000-0000-4000-8000-000000024003',
        notificationEventId: '00000000-0000-4000-8000-000000024201',
        publishedAt: '2026-08-29T18:00:00.000Z',
        publishedBy: '00000000-0000-4000-8000-000000024101',
        title: 'Horário de chegada',
      }),
    };

    renderFeature(<NoticesPage canPublish service={service} />);

    const wall = await screen.findByRole('list', { name: 'Mural de avisos' });
    const items = within(wall).getAllByRole('article');
    expect(items[0]).toHaveTextContent('Treino confirmado');
    expect(items[1]).toHaveTextContent('Uniforme da rodada');
    expect(items[0]).toHaveTextContent('Publicado por Alex Comissão');

    await user.type(screen.getByLabelText('Título do aviso'), 'Horário de chegada');
    await user.type(
      screen.getByLabelText('Conteúdo do aviso'),
      'Chegar com 30 minutos de antecedência.',
    );
    await user.click(screen.getByRole('button', { name: 'Publicar aviso' }));

    await waitFor(() =>
      expect(service.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Chegar com 30 minutos de antecedência.',
          title: 'Horário de chegada',
        }),
      ),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Aviso publicado com sucesso.');
  });

  it('keeps authoritative presence and voting actions visible without push permission', async () => {
    const service: NotificationsService = {
      getPendingActions: vi.fn().mockResolvedValue({
        presence: {
          applicableDeadline: '2026-08-29T21:00:00.000Z',
          matchId: '00000000-0000-4000-8000-000000024301',
        },
        voting: {
          closesAt: '2026-08-30T21:00:00.000Z',
          matchId: '00000000-0000-4000-8000-000000024301',
          votingRoundId: '00000000-0000-4000-8000-000000024302',
        },
      }),
    };

    renderFeature(<PendingActionsBanner service={service} />);

    const banner = await screen.findByRole('region', { name: 'Ações pendentes' });
    expect(within(banner).getByText(/Confirme sua presença/)).toBeVisible();
    expect(within(banner).getByText(/Vote no Craque do Jogo/)).toBeVisible();
    expect(within(banner).getByRole('link', { name: 'Responder convocação' })).toHaveAttribute(
      'href',
      '/app/athlete/matches/00000000-0000-4000-8000-000000024301/attendance',
    );
  });

  it('uses a soft prompt, remembers denial and preserves the in-app fallback with manual retry', async () => {
    const user = userEvent.setup();
    const adapter: PushPermissionAdapter = {
      getPermission: vi.fn().mockReturnValue('default'),
      requestPermission: vi.fn().mockResolvedValue('denied'),
    };

    renderFeature(
      <PushPermissionCard
        adapter={adapter}
        installContext={{ isIos: false, isStandalone: false }}
      />,
    );

    expect(screen.getByText('Receba lembretes importantes')).toBeVisible();
    expect(adapter.requestPermission).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Ativar notificações' }));
    expect(adapter.requestPermission).toHaveBeenCalledOnce();
    expect(await screen.findByText(/Você recusou as notificações/)).toBeVisible();
    expect(
      screen.getByText(/As pendências continuam disponíveis dentro do aplicativo/),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    expect(window.localStorage.getItem('mbj:push-permission-denied')).toBe('true');
  });

  it('shows supported iOS Home Screen guidance instead of an ineffective permission request', () => {
    const adapter: PushPermissionAdapter = {
      getPermission: vi.fn().mockReturnValue('default'),
      requestPermission: vi.fn(),
    };

    renderFeature(
      <PushPermissionCard
        adapter={adapter}
        installContext={{ isIos: true, isStandalone: false }}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Adicione à Tela de Início' })).toBeVisible();
    expect(screen.getByText(/abra o aplicativo pelo novo ícone/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Ativar notificações' })).not.toBeInTheDocument();
  });

  it('offers manual retry after a provider outage without blocking the core experience', async () => {
    const user = userEvent.setup();
    const requestPermission = vi
      .fn<PushPermissionAdapter['requestPermission']>()
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce('granted');

    renderFeature(
      <PushPermissionCard
        adapter={{ getPermission: () => 'default', requestPermission }}
        installContext={{ isIos: false, isStandalone: false }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Ativar notificações' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível ativar as notificações agora.',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Notificações ativadas neste dispositivo.')).toBeVisible();
  });
});
