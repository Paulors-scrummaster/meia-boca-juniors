import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { createAppQueryClient } from '@/app/providers/QueryProvider';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import {
  reportRequestFailure,
  reportRequestFailureDeferred,
  reportRequestSuccess,
  reportRequestSuccessDeferred,
  resetConnectivityForTests,
  useConnectivity,
} from '@/shared/hooks/use-connectivity';
import { useOnlineMutation } from '@/shared/hooks/use-online-mutation';

function setBrowserOnline(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

describe('connectivity foundation', () => {
  it('combina o sinal do navegador com falhas reais de requisição', async () => {
    setBrowserOnline(true);
    resetConnectivityForTests();
    const { result } = renderHook(() => useConnectivity());

    act(() => reportRequestFailure(new TypeError('Failed to fetch')));
    expect(result.current.isOnline).toBe(false);
    expect(result.current.reason).toBe('request');

    act(() => reportRequestSuccess());
    expect(result.current.isOnline).toBe(true);

    act(() => setBrowserOnline(false));
    expect(result.current.reason).toBe('browser');
  });

  it('adia notificações originadas pelo cache para fora da renderização atual', async () => {
    setBrowserOnline(true);
    resetConnectivityForTests();
    const { result } = renderHook(() => useConnectivity());

    reportRequestFailureDeferred(new TypeError('Failed to fetch'));
    expect(result.current.isOnline).toBe(true);
    await act(async () => Promise.resolve());
    expect(result.current.reason).toBe('request');

    reportRequestSuccessDeferred();
    expect(result.current.isOnline).toBe(false);
    await act(async () => Promise.resolve());
    expect(result.current.isOnline).toBe(true);
  });

  it('não executa nem enfileira mutações enquanto offline', async () => {
    setBrowserOnline(false);
    resetConnectivityForTests();
    const mutationFn = vi.fn().mockResolvedValue('ok');
    const queryClient = createAppQueryClient();

    function Wrapper({ children }: PropsWithChildren) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }

    const { result } = renderHook(() => useOnlineMutation({ mutationFn }), { wrapper: Wrapper });

    await expect(result.current.mutateAsync()).rejects.toMatchObject({ code: 'OFFLINE' });
    expect(mutationFn).not.toHaveBeenCalled();
    expect(result.current.isPaused).toBe(false);
  });

  it('desabilita controles de escrita e explica a reconexão', async () => {
    setBrowserOnline(false);
    resetConnectivityForTests();
    render(
      <OnlineActionGuard>
        <button type="button">Confirmar presença</button>
      </OnlineActionGuard>,
    );

    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
    expect(screen.getByText(/reconecte-se/i)).toBeInTheDocument();
  });
});
