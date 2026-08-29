import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AuthContext, type AuthContextValue } from '@/app/providers/AuthProvider';
import { AuthenticatedLayout } from '@/app/layouts/AuthenticatedLayout';
import { createAppQueryClient } from '@/app/providers/QueryProvider';
import type { NotificationsService } from '@/features/notifications/api/notifications.service';

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
    const notificationsService: NotificationsService = {
      getPendingActions: async () => ({ presence: null, voting: null }),
    };
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <AuthContext.Provider value={context}>
          <MemoryRouter>
            <AuthenticatedLayout pendingActionsService={notificationsService} />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Área do atleta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Administração' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Comissão técnica' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mural' })).toHaveAttribute('href', '/app/notices');
    expect(screen.getByRole('link', { name: 'Notificações' })).toHaveAttribute(
      'href',
      '/app/notification-preferences',
    );
  });
});
