import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '@/app/providers/AuthProvider';
import { createAppQueryClient } from '@/app/providers/QueryProvider';
import type { AuthService } from '@/features/auth/api/auth.service';
import { MfaPage } from '@/features/auth/pages/MfaPage';

// A rota real monta <MfaPage /> sem prop, e o default construía um AuthService novo a cada render.
// Reproduzimos isso: cada chamada devolve um objeto diferente, compartilhando os mesmos espiões.
const enrollMfa = vi.fn();
const getMfaFactors = vi.fn();
const unenrollMfa = vi.fn();
const createdServices: AuthService[] = [];

vi.mock('@/shared/adapters/supabase/client', () => ({ supabase: {} }));
vi.mock('@/features/auth/api/auth.service', () => ({
  createAuthService: () => {
    const instance = {
      challengeMfa: vi.fn(),
      enrollMfa,
      getMfaFactors,
      unenrollMfa,
    } as unknown as AuthService;
    createdServices.push(instance);
    return instance;
  },
}));

const userId = '00000000-0000-4000-8000-000000000101';

const authenticated: AuthContextValue = {
  error: null,
  isAal2: false,
  profile: { account_status: 'ACTIVE', id: userId, must_change_password: false },
  refresh: vi.fn().mockResolvedValue(undefined),
  roles: ['PRESIDENT'],
  session: null,
  status: 'authenticated',
  user: {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-08-25T00:00:00.000Z',
    email: 'presidente@mbj.test',
    id: userId,
    user_metadata: {},
  },
};

function renderMfaRoute({ strict = false }: { strict?: boolean } = {}) {
  const tree = (
    <QueryClientProvider client={createAppQueryClient()}>
      <AuthContext.Provider value={authenticated}>
        <MemoryRouter initialEntries={['/mfa']}>
          <MfaPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

describe('preparo do TOTP na rota real', () => {
  beforeEach(() => {
    createdServices.length = 0;
    enrollMfa.mockReset();
    getMfaFactors.mockReset();
    unenrollMfa.mockReset();
    getMfaFactors.mockResolvedValue([]);
    enrollMfa.mockImplementation(() =>
      Promise.resolve({
        factorId: `factor-${enrollMfa.mock.calls.length}`,
        qrCode: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
        secret: 'MBJTESTSECRET',
        uri: 'otpauth://totp/MBJ',
      }),
    );
  });

  it('cria um único fator mesmo com o serviço sendo reconstruído a cada render', async () => {
    const user = userEvent.setup();
    renderMfaRoute();

    expect(await screen.findByAltText('QR Code para configurar o autenticador')).toBeVisible();

    // Digitar força uma sequência de renders; no código defeituoso cada um reconstruía o
    // AuthService, reexecutava o efeito e criava mais um fator no servidor.
    const input = screen.getByLabelText('Código de 6 números');
    await user.type(input, '123456');
    await waitFor(() => expect(input).toHaveValue('123456'));

    expect(enrollMfa).toHaveBeenCalledTimes(1);
    expect(unenrollMfa).not.toHaveBeenCalled();
    expect(createdServices).toHaveLength(1);
  });

  it('conclui o preparo sob StrictMode, que executa o efeito duas vezes', async () => {
    renderMfaRoute({ strict: true });

    // A montagem dupla limpa o primeiro efeito antes de a promessa resolver. Se o resultado for
    // descartado junto, a tela fica presa em "Preparando…" e o formulário nunca aparece.
    expect(await screen.findByAltText('QR Code para configurar o autenticador')).toBeVisible();
    expect(screen.getByLabelText('Código de 6 números')).toBeVisible();
    expect(enrollMfa).toHaveBeenCalledTimes(1);
  });

  it('descarta o fator pendente uma única vez antes de gerar o QR Code', async () => {
    getMfaFactors.mockResolvedValue([
      { factorId: 'factor-pendente', friendlyName: 'MBJ', status: 'unverified' },
    ]);
    renderMfaRoute();

    expect(await screen.findByAltText('QR Code para configurar o autenticador')).toBeVisible();
    expect(unenrollMfa).toHaveBeenCalledTimes(1);
    expect(unenrollMfa).toHaveBeenCalledWith('factor-pendente');
    expect(enrollMfa).toHaveBeenCalledTimes(1);
  });
});
