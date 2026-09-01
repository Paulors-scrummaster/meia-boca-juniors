import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OfflineIndicator } from '@/features/offline/components/OfflineIndicator';
import { AuthContext, type AuthContextValue } from '@/app/providers/AuthProvider';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { setConnectivityForTests } from '@/shared/hooks/use-connectivity';

describe('offline experience', () => {
  it('anuncia Modo Offline e a última atualização com semântica acessível', () => {
    setConnectivityForTests(false);
    render(<OfflineIndicator cachedAt="2026-08-29T18:00:00.000Z" hasCachedContent />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Modo Offline');
    expect(status).toHaveTextContent(/Última atualização:/);
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('explica de forma acessível quando não há conteúdo armazenado', () => {
    setConnectivityForTests(false);
    render(<OfflineIndicator cachedAt={null} hasCachedContent={false} />);

    expect(screen.getByRole('status')).toHaveTextContent('Modo Offline');
    expect(screen.getByText(/Nenhum conteúdo offline está armazenado/)).toBeVisible();
  });

  it('permanece discreto quando online', () => {
    setConnectivityForTests(true);
    const { container } = render(
      <OfflineIndicator cachedAt="2026-08-29T18:00:00.000Z" hasCachedContent />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('não notifica o indicador de cache durante a renderização de outro componente', async () => {
    setConnectivityForTests(false);
    const queryClient = new QueryClient();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const userId = '11111111-1111-4111-8111-111111111111';
    const auth = {
      error: null,
      isAal2: false,
      profile: null,
      refresh: async () => undefined,
      roles: [],
      session: null,
      status: 'authenticated',
      user: { id: userId } as User,
    } satisfies AuthContextValue;

    function CacheWriter({ write }: { write: boolean }) {
      const client = useQueryClient();
      if (write) {
        client.setQueryData(['offline', userId, 'next-match'], {
          cachedAt: '2026-08-30T18:00:00.000Z',
        });
      }
      return null;
    }

    const view = render(
      <AuthContext.Provider value={auth}>
        <QueryClientProvider client={queryClient}>
          <OfflineIndicator />
          <CacheWriter write={false} />
        </QueryClientProvider>
      </AuthContext.Provider>,
    );

    view.rerender(
      <AuthContext.Provider value={auth}>
        <QueryClientProvider client={queryClient}>
          <OfflineIndicator />
          <CacheWriter write />
        </QueryClientProvider>
      </AuthContext.Provider>,
    );
    await Promise.resolve();

    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('Cannot update a component');
    consoleError.mockRestore();
  });

  it('desabilita proativamente controles de escrita e não executa a ação', async () => {
    setConnectivityForTests(false);
    const action = vi.fn();
    render(
      <OnlineActionGuard explanation="Reconecte-se para confirmar esta ação.">
        <button onClick={action}>Confirmar presença</button>
      </OnlineActionGuard>,
    );

    const button = screen.getByRole('button', { name: 'Confirmar presença' });
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Reconecte-se para confirmar esta ação.');
    await userEvent.click(button);
    expect(action).not.toHaveBeenCalled();
  });
});
