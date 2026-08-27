import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '@/app/providers/AuthProvider';
import { createAppQueryClient } from '@/app/providers/QueryProvider';
import { defaultRouteForRoles } from '@/app/router/router';
import type { AuthService } from '@/features/auth/api/auth.service';
import { RoleManager } from '@/features/auth/components/RoleManager';
import { AcceptInvitationPage } from '@/features/auth/pages/AcceptInvitationPage';
import { ChangePasswordPage } from '@/features/auth/pages/ChangePasswordPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { MfaPage } from '@/features/auth/pages/MfaPage';

const userId = '00000000-0000-4000-8000-000000000101';
const invitationId = '00000000-0000-4000-8000-000000000202';

function service(overrides: Partial<AuthService> = {}): AuthService {
  return {
    acceptInvitation: vi.fn(),
    challengeMfa: vi.fn(),
    changePassword: vi.fn(),
    enrollMfa: vi.fn(),
    getMfaFactors: vi.fn().mockResolvedValue([]),
    getRoles: vi.fn().mockResolvedValue([]),
    manageInvitation: vi.fn(),
    resetPassword: vi.fn(),
    setRole: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    ...overrides,
  };
}

const authenticated: AuthContextValue = {
  error: null,
  isAal2: false,
  profile: { account_status: 'ACTIVE', id: userId, must_change_password: false },
  refresh: vi.fn().mockResolvedValue(undefined),
  roles: ['PRESIDENT', 'ATHLETE'],
  session: null,
  status: 'authenticated',
  user: {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-08-25T00:00:00.000Z',
    email: 'atleta@mbj.test',
    id: userId,
    user_metadata: {},
  },
};

function renderWithAuth(element: React.ReactNode, entry = '/') {
  return render(
    <QueryClientProvider client={createAppQueryClient()}>
      <AuthContext.Provider value={authenticated}>
        <MemoryRouter initialEntries={[entry]}>{element}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('fluxos de identidade', () => {
  it('envia login por e-mail e senha e segue para a área autenticada', async () => {
    const user = userEvent.setup();
    const auth = service({ signInWithPassword: vi.fn().mockResolvedValue({}) });
    renderWithAuth(
      <Routes>
        <Route path="/login" element={<LoginPage service={auth} />} />
        <Route path="/app" element={<p>área autenticada</p>} />
      </Routes>,
      '/login',
    );

    await user.type(screen.getByLabelText('E-mail'), 'atleta@mbj.test');
    await user.type(screen.getByLabelText('Senha'), 'senha-segura');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'atleta@mbj.test',
      password: 'senha-segura',
    });
    expect(await screen.findByText('área autenticada')).toBeInTheDocument();
  });

  it('valida e conclui a troca obrigatória da senha temporária', async () => {
    const user = userEvent.setup();
    const auth = service({ changePassword: vi.fn().mockResolvedValue(undefined) });
    renderWithAuth(
      <Routes>
        <Route path="/alterar-senha" element={<ChangePasswordPage service={auth} />} />
        <Route path="/app" element={<p>senha alterada</p>} />
      </Routes>,
      '/alterar-senha',
    );

    await user.type(screen.getByLabelText('Nova senha'), 'nova-senha');
    await user.type(screen.getByLabelText('Confirme a nova senha'), 'diferente');
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(await screen.findByText('As senhas precisam ser iguais.')).toBeInTheDocument();
    expect(auth.changePassword).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/^Confirme a nova senha/));
    await user.type(screen.getByLabelText(/^Confirme a nova senha/), 'nova-senha');
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
    expect(auth.changePassword).toHaveBeenCalledWith('nova-senha');
    expect(await screen.findByText('senha alterada')).toBeInTheDocument();
  });

  it('confirma a identidade autenticada, resgata o convite e define a senha', async () => {
    const user = userEvent.setup();
    const auth = service({
      acceptInvitation: vi.fn().mockResolvedValue({
        athleteId: userId,
        mustChangePassword: false,
        roles: ['ATHLETE'],
      }),
      changePassword: vi.fn().mockResolvedValue(undefined),
    });
    renderWithAuth(
      <Routes>
        <Route path="/convite" element={<AcceptInvitationPage service={auth} />} />
        <Route path="/app" element={<p>convite ativado</p>} />
      </Routes>,
      `/convite?invitationId=${invitationId}`,
    );

    expect(screen.getByText('Identidade de acesso confirmada')).toBeInTheDocument();
    expect(screen.getByText('atleta@mbj.test')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Crie sua senha'), 'senha-convite');
    await user.type(screen.getByLabelText('Confirme sua senha'), 'senha-convite');
    await user.click(screen.getByRole('button', { name: 'Confirmar e ativar conta' }));

    expect(auth.acceptInvitation).toHaveBeenCalledWith(invitationId);
    expect(auth.changePassword).toHaveBeenCalledWith('senha-convite');
    expect(await screen.findByText('convite ativado')).toBeInTheDocument();
  });

  it('mantém a união dos papéis e permite ao Presidente alterar uma atribuição', async () => {
    const user = userEvent.setup();
    const auth = service({
      getRoles: vi.fn().mockResolvedValue(['PRESIDENT', 'ATHLETE']),
      setRole: vi.fn().mockResolvedValue(['PRESIDENT', 'COACH', 'ATHLETE']),
    });
    renderWithAuth(<RoleManager service={auth} userId={userId} />);

    expect(defaultRouteForRoles(['ATHLETE', 'COACH'])).toBe('/app/staff');
    expect(await screen.findByRole('checkbox', { name: 'Presidente' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Atleta' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'Técnico' }));
    expect(auth.setRole).toHaveBeenCalledWith({ assigned: true, role: 'COACH', userId });
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Técnico' })).toBeChecked());
  });

  it('orienta o cadastro TOTP e confirma o desafio AAL2', async () => {
    const user = userEvent.setup();
    const auth = service({
      challengeMfa: vi.fn().mockResolvedValue(undefined),
      enrollMfa: vi.fn().mockResolvedValue({
        factorId: 'factor-1',
        qrCode: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
        secret: 'MBJTESTSECRET',
        uri: 'otpauth://totp/MBJ',
      }),
    });
    renderWithAuth(
      <Routes>
        <Route path="/mfa" element={<MfaPage service={auth} />} />
        <Route path="/app/admin" element={<p>aal2 confirmado</p>} />
      </Routes>,
      '/mfa',
    );

    expect(await screen.findByAltText('QR Code para configurar o autenticador')).toBeVisible();
    await user.type(screen.getByLabelText('Código de 6 números'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verificar código' }));
    expect(auth.challengeMfa).toHaveBeenCalledWith('factor-1', '123456');
    expect(await screen.findByText('aal2 confirmado')).toBeInTheDocument();
  });
});
