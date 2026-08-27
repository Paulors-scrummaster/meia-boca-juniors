import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AuthContext, type AuthContextValue } from '@/app/providers/AuthProvider';
import {
  Aal2RouteGuard,
  AuthenticatedRouteGuard,
  PublicRouteGuard,
  RoleRouteGuard,
} from '@/app/router/guards';

const authenticated = {
  error: null,
  isAal2: true,
  profile: {
    account_status: 'ACTIVE',
    id: '00000000-0000-4000-8000-000000000101',
    must_change_password: false,
  },
  refresh: async () => undefined,
  roles: ['ATHLETE'],
  session: null,
  status: 'authenticated',
  user: null,
} satisfies AuthContextValue;

function renderGuard(guard: React.ReactNode, value: AuthContextValue, initialEntry = '/private') {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/" element={<p>pública</p>} />
          <Route path="/app" element={<p>aplicação</p>} />
          <Route path="/app/forbidden" element={<p>proibido</p>} />
          <Route path="/app/mfa-required" element={<p>mfa necessário</p>} />
          <Route path="/private" element={guard} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('route guards', () => {
  it('redireciona visitante de uma rota autenticada', () => {
    renderGuard(<AuthenticatedRouteGuard />, {
      ...authenticated,
      isAal2: false,
      profile: null,
      roles: [],
      status: 'unauthenticated',
    });

    expect(screen.getByText('pública')).toBeInTheDocument();
  });

  it('redireciona usuário autenticado para fora de rota pública exclusiva', () => {
    renderGuard(<PublicRouteGuard />, authenticated);
    expect(screen.getByText('aplicação')).toBeInTheDocument();
  });

  it('exige pelo menos um papel autorizado', () => {
    renderGuard(<RoleRouteGuard allowedRoles={['PRESIDENT']} />, authenticated);
    expect(screen.getByText('proibido')).toBeInTheDocument();
  });

  it('exige AAL2 para a rota administrativa', () => {
    renderGuard(<Aal2RouteGuard />, { ...authenticated, isAal2: false });
    expect(screen.getByText('mfa necessário')).toBeInTheDocument();
  });
});
