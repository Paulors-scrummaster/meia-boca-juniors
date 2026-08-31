import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import { clubConfig } from '@/config/club.config';
import { createAuthService, type AuthService } from '@/features/auth/api/auth.service';
import type { NotificationsService } from '@/features/notifications/api/notifications.service';
import { PendingActionsBanner } from '@/features/notifications/components/PendingActionsBanner';
import { OfflineIndicator } from '@/features/offline/components/OfflineIndicator';
import { supabase } from '@/shared/adapters/supabase/client';
import { useConnectivity } from '@/shared/hooks/use-connectivity';

interface NavigationItem {
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
  const [signingOut, setSigningOut] = useState(false);
  const items: NavigationItem[] = [
    { label: 'Início', to: '/app' },
    { label: 'Elenco', to: '/app/roster' },
    { label: 'Partidas', to: '/app/matches' },
    { label: 'Estatísticas', to: '/app/statistics' },
    { label: 'Mural', to: '/app/notices' },
    { label: 'Notificações', to: '/app/notification-preferences' },
  ];

  if (roles.includes('ATHLETE')) {
    items.push({ label: 'Área do atleta', to: '/app/athlete' });
    items.push({ label: 'Craque do Jogo', to: '/app/athlete/mvp-voting' });
  }
  if (roles.some((role) => role === 'COACH' || role === 'PRESIDENT')) {
    items.push({ label: 'Comissão técnica', to: '/app/staff' });
  }
  if (roles.includes('PRESIDENT')) {
    items.push({ label: 'Administração', to: '/app/admin' });
  }

  return (
    <div className="min-h-dvh bg-background text-foreground md:grid md:grid-cols-[15rem_1fr]">
      <a
        className="sr-only z-50 rounded-md bg-primary p-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        href="#conteudo-principal"
      >
        Ir para o conteúdo
      </a>
      <header className="border-b bg-card px-4 py-4 md:col-start-1 md:row-span-2 md:row-start-1 md:border-b-0 md:border-r md:px-5">
        <div className="flex items-center gap-3">
          <img
            alt={`Escudo do ${clubConfig.identity.shortName}`}
            className="h-11 w-11"
            src={clubConfig.assets.logo}
          />
          <div>
            <p className="font-black">{clubConfig.identity.shortName}</p>
            <p className="text-xs text-muted-foreground">Área do clube</p>
          </div>
        </div>
        <button
          className="mt-4 min-h-11 rounded-lg border px-4 text-sm font-bold text-primary disabled:opacity-60"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void authService.signOut().finally(() => setSigningOut(false));
          }}
          type="button"
        >
          {signingOut ? 'Saindo…' : 'Sair'}
        </button>
      </header>

      <main
        className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:col-start-2 md:row-span-2 md:row-start-1 md:px-8 md:pb-8"
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
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 flex min-h-20 items-stretch gap-1 overflow-x-auto border-t bg-card px-2 pb-[env(safe-area-inset-bottom)] md:static md:col-start-1 md:row-start-2 md:flex-col md:justify-start md:overflow-x-visible md:border-r md:border-t-0 md:px-3 md:pb-6"
      >
        {items.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `flex min-h-12 min-w-24 shrink-0 items-center justify-center rounded-lg px-3 text-center text-xs font-bold md:min-w-0 md:flex-none md:justify-start md:text-sm ${
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
      </nav>
    </div>
  );
}
