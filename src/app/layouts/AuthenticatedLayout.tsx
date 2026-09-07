import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { SidebarBrand } from '@/app/layouts/navigation/SidebarBrand';
import { NavigationList } from '@/app/layouts/navigation/NavigationList';
import { SidebarFooter } from '@/app/layouts/navigation/SidebarFooter';
import { useAuth } from '@/app/providers/AuthProvider';
import { createAuthService, type AuthService } from '@/features/auth/api/auth.service';
import type { NotificationsService } from '@/features/notifications/api/notifications.service';
import { PendingActionsBanner } from '@/features/notifications/components/PendingActionsBanner';
import { OfflineIndicator } from '@/features/offline/components/OfflineIndicator';
import { supabase } from '@/shared/adapters/supabase/client';
import { useConnectivity } from '@/shared/hooks/use-connectivity';

interface MobileNavigationItem {
  label: string;
  to: string;
}

interface AuthenticatedLayoutProps {
  authService?: AuthService;
  pendingActionsService?: NotificationsService;
}

export function AuthenticatedLayout({
  authService = createAuthService(supabase),
  pendingActionsService,
}: AuthenticatedLayoutProps = {}) {
  const { roles } = useAuth();
  const { isOnline } = useConnectivity();
  // Sair na barra mobile: a versão anterior tinha o botão no cabeçalho, visível em
  // qualquer largura. `SidebarFooter` (T045) só existe dentro do `<aside>` desktop
  // (`hidden` abaixo de 768px) — sem este botão, o usuário mobile perderia a
  // capacidade de sair. Duplicação temporária: some junto com toda esta barra em
  // T061, quando a gaveta assume a navegação mobile.
  const [mobileSigningOut, setMobileSigningOut] = useState(false);

  // Barra de abas do rodapé mobile: mantida temporariamente com sua lista e estilo
  // originais. FR-021a a substitui pela gaveta lateral, mas essa troca é escopo de
  // US3 (T052-T061), não desta reestruturação da barra lateral desktop (US2). As
  // duas listas de itens coexistem só até T061 remover esta.
  const mobileItems: MobileNavigationItem[] = [
    { label: 'Início', to: '/app' },
    { label: 'Elenco', to: '/app/roster' },
    { label: 'Partidas', to: '/app/matches' },
    { label: 'Estatísticas', to: '/app/statistics' },
    { label: 'Mural', to: '/app/notices' },
    { label: 'Notificações', to: '/app/notification-preferences' },
  ];
  if (roles.includes('ATHLETE')) {
    mobileItems.push({ label: 'Área do atleta', to: '/app/athlete' });
    mobileItems.push({ label: 'Craque do Jogo', to: '/app/athlete/mvp-voting' });
  }
  if (roles.some((role) => role === 'COACH' || role === 'PRESIDENT')) {
    mobileItems.push({ label: 'Comissão técnica', to: '/app/staff' });
  }
  if (roles.includes('PRESIDENT')) {
    mobileItems.push({ label: 'Administração', to: '/app/admin' });
  }

  return (
    <div className="min-h-dvh bg-background text-foreground md:flex">
      <a
        className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        href="#conteudo-principal"
      >
        Ir para o conteúdo
      </a>

      {/*
        Barra lateral desktop (FR-015 a FR-020): três regiões em coluna contínua —
        topo fixo, corpo rolável, rodapé fixo. Ausente abaixo de 768px (FR-015a);
        nenhuma faixa de cabeçalho é renderizada nessa largura.
      */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-60 md:shrink-0 md:flex-col md:border-r md:bg-card">
        <div className="shrink-0 border-b p-5">
          <SidebarBrand />
        </div>
        <nav aria-label="Navegação principal" className="min-h-0 flex-1 overflow-y-auto p-3">
          <NavigationList roles={roles} />
        </nav>
        <div className="shrink-0 border-t p-5">
          <SidebarFooter authService={authService} />
        </div>
      </aside>

      <main
        className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:flex-1 md:px-8 md:pb-8"
        id="conteudo-principal"
      >
        <OfflineIndicator />
        <fieldset
          aria-describedby={!isOnline ? 'authenticated-offline-write-block' : undefined}
          className="m-0 min-w-0 border-0 p-0"
          disabled={!isOnline}
        >
          <legend className="sr-only">Conteúdo autenticado</legend>
          {pendingActionsService ? (
            <PendingActionsBanner service={pendingActionsService} />
          ) : (
            <PendingActionsBanner />
          )}
          <Outlet />
        </fieldset>
        {!isOnline ? (
          <p
            className="mt-4 text-sm font-medium text-muted-foreground"
            id="authenticated-offline-write-block"
            role="status"
          >
            Controles de escrita estão desabilitados até a reconexão.
          </p>
        ) : null}
      </main>

      <nav
        aria-label="Navegação mobile"
        className="fixed inset-x-0 bottom-0 z-40 flex min-h-20 items-stretch gap-1 overflow-x-auto border-t bg-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {mobileItems.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `flex min-h-12 min-w-24 shrink-0 items-center justify-center rounded-lg px-3 text-center text-xs font-bold ${
                isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`
            }
            end={item.to === '/app'}
            key={item.to}
            to={item.to}
          >
            {item.label}
          </NavLink>
        ))}
        <button
          className="flex min-h-12 min-w-24 shrink-0 items-center justify-center gap-1 rounded-lg px-3 text-center text-xs font-bold text-destructive disabled:opacity-60"
          disabled={mobileSigningOut}
          onClick={() => {
            setMobileSigningOut(true);
            void authService.signOut().finally(() => setMobileSigningOut(false));
          }}
          type="button"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
          {mobileSigningOut ? 'Saindo…' : 'Sair'}
        </button>
      </nav>
    </div>
  );
}
