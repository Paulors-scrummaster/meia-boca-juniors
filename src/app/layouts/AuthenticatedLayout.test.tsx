import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AuthContext, type AuthContextValue } from '@/app/providers/AuthProvider';
import { AuthenticatedLayout } from '@/app/layouts/AuthenticatedLayout';
import { createAppQueryClient } from '@/app/providers/QueryProvider';
import type { NotificationsService } from '@/features/notifications/api/notifications.service';

// PRESIDENT + ATHLETE cobre, em conjunto, os 10 itens do conjunto normativo
// (data-model.md §3.2): os 6 comuns, os 2 exclusivos de ATHLETE, o de COACH/PRESIDENT
// e o exclusivo de PRESIDENT.
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
  user: {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-08-25T00:00:00.000Z',
    email: 'presidente@mbj.test',
    id: '00000000-0000-4000-8000-000000000101',
    user_metadata: {},
  },
} satisfies AuthContextValue;

function renderLayout() {
  const notificationsService: NotificationsService = {
    getPendingActions: async () => ({ presence: null, voting: null }),
  };
  return render(
    <QueryClientProvider client={createAppQueryClient()}>
      <AuthContext.Provider value={context}>
        <MemoryRouter>
          <AuthenticatedLayout pendingActionsService={notificationsService} />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

/**
 * jsdom não computa CSS real: as classes responsivas (`hidden`, `md:flex`) e o
 * estado fechado do `<dialog>` da gaveta não escondem nada para as consultas do
 * Testing Library, que operam sobre o DOM, não sobre uma árvore de acessibilidade
 * calculada. A barra lateral desktop (`<aside>`, landmark `complementary`) é o
 * único ponto de referência estável para escopar asserções especificamente sobre
 * ela — sem isso, `getByRole`/`getByAltText` sem escopo encontram também o
 * conteúdo da faixa superior mobile e da gaveta, que agora coexistem no mesmo
 * componente.
 */
function getSidebar() {
  return within(screen.getByRole('complementary'));
}

describe('AuthenticatedLayout', () => {
  it('expõe a região de navegação com o rótulo estável', () => {
    renderLayout();
    expect(
      getSidebar().getByRole('navigation', { name: 'Navegação principal' }),
    ).toBeInTheDocument();
  });

  it('lista os 10 itens do conjunto normativo pela união dos papéis efetivos', () => {
    renderLayout();
    const nav = getSidebar().getByRole('navigation', { name: 'Navegação principal' });
    const labels = [
      'Início',
      'Elenco',
      'Partidas',
      'Estatísticas',
      'Mural',
      'Notificações',
      'Área do atleta',
      'Craque do Jogo',
      'Comissão técnica',
      'Administração',
    ];
    for (const label of labels) {
      expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(within(nav).getAllByRole('link')).toHaveLength(labels.length);
  });

  it('preserva os destinos dos itens existentes', () => {
    renderLayout();
    const nav = getSidebar().getByRole('navigation', { name: 'Navegação principal' });
    expect(within(nav).getByRole('link', { name: 'Mural' })).toHaveAttribute(
      'href',
      '/app/notices',
    );
    expect(within(nav).getByRole('link', { name: 'Notificações' })).toHaveAttribute(
      'href',
      '/app/notification-preferences',
    );
  });

  it('fixa a identificação do usuário e o botão "Sair" fora da região de navegação (FR-017)', () => {
    renderLayout();
    const sidebar = getSidebar();
    const nav = sidebar.getByRole('navigation', { name: 'Navegação principal' });
    const signOutButton = sidebar.getByRole('button', { name: /Sair/ });

    expect(signOutButton).toHaveAttribute('type', 'button');
    expect(within(nav).queryByRole('button', { name: /Sair/ })).not.toBeInTheDocument();
    expect(sidebar.getByText('presidente@mbj.test')).toBeInTheDocument();
  });

  it('posiciona identidade, navegação e rodapé em ordem — topo, corpo, rodapé (FR-015 a FR-017)', () => {
    renderLayout();
    const sidebar = getSidebar();
    const brand = sidebar.getByAltText('Escudo do MBJ');
    const nav = sidebar.getByRole('navigation', { name: 'Navegação principal' });
    const signOutButton = sidebar.getByRole('button', { name: /Sair/ });

    // DOCUMENT_POSITION_FOLLOWING (4): o segundo argumento vem depois do primeiro no documento.
    expect(brand.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      nav.compareDocumentPosition(signOutButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('mantém o botão "Sair" visualmente distinto dos links de navegação (FR-018)', () => {
    renderLayout();
    const signOutButton = getSidebar().getByRole('button', { name: /Sair/ });
    expect(signOutButton.className).toContain('destructive');
  });

  it('expõe o botão de menu mobile com aria-expanded refletindo a gaveta fechada', () => {
    renderLayout();
    expect(screen.getByRole('button', { name: 'Abrir menu de navegação' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
