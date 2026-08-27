import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AuthContext, type AuthContextValue } from '@/app/providers/AuthProvider';
import { AuthenticatedLayout } from '@/app/layouts/AuthenticatedLayout';

const context = {
  error: null,
  isAal2: true,
  profile: {
    account_status: 'ACTIVE',
    id: '00000000-0000-4000-8000-000000000101',
    must_change_password: false,
  },
  refresh: async () => undefined,
  roles: ['PRESIDENT', 'ATHLETE'],
  session: null,
  status: 'authenticated',
  user: null,
} satisfies AuthContextValue;

describe('AuthenticatedLayout', () => {
  it('monta navegação mobile-first pela união dos papéis efetivos', () => {
    render(
      <AuthContext.Provider value={context}>
        <MemoryRouter>
          <AuthenticatedLayout />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Área do atleta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Administração' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Comissão técnica' })).toBeInTheDocument();
  });
});
