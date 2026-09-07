import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { MobileTopBar } from '@/app/layouts/navigation/MobileTopBar';
import { NavigationDrawer } from '@/app/layouts/navigation/NavigationDrawer';
import { NavigationList } from '@/app/layouts/navigation/NavigationList';
import { SidebarBrand } from '@/app/layouts/navigation/SidebarBrand';
import { SidebarFooter } from '@/app/layouts/navigation/SidebarFooter';
import { useAuth } from '@/app/providers/AuthProvider';
import { createAuthService, type AuthService } from '@/features/auth/api/auth.service';
import type { NotificationsService } from '@/features/notifications/api/notifications.service';
import { PendingActionsBanner } from '@/features/notifications/components/PendingActionsBanner';
import { OfflineIndicator } from '@/features/offline/components/OfflineIndicator';
import { supabase } from '@/shared/adapters/supabase/client';
import { useConnectivity } from '@/shared/hooks/use-connectivity';

/** Corte responsivo binário do contrato (contracts/navigation-shell.md, A-06). */
const DESKTOP_BREAKPOINT_QUERY = '(min-width: 768px)';

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
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Estado local de UI (NavigationShellState, data-model.md §4): não é estado
  // remoto nem compartilhado entre componentes distantes, então não vai para
  // TanStack Query nem para Zustand.
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_BREAKPOINT_QUERY);
    // Redimensionar para desktop com a gaveta aberta a fecha, evitando gaveta e
    // barra lateral simultâneas e liberando a rolagem do corpo (E-08, T057).
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawerOpen(false);
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground md:flex">
      <a
        // Todo estilo visível fica atrás de `focus:`, inclusive o que parece incondicional
        // (padding, cor de fundo, cantos): com `sr-only` (largura/altura 1px, box-sizing
        // border-box), um `p-3` incondicional força a caixa a crescer para caber o padding e
        // reaparece um alvo de 24x24 fora da tela mesmo sem foco, quebrando a técnica de
        // ocultação e falhando a auditoria de alvo de toque (SC-009).
        className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:rounded-md focus:bg-primary focus:p-3 focus:text-primary-foreground"
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

      {/*
        Faixa superior e gaveta mobile (FR-021 a FR-024): ausentes em larguras
        ≥768px, onde a barra lateral acima assume. A gaveta fica sempre montada,
        mas permanece fechada nessa largura (nunca há botão alcançável para abri-la
        e o efeito de redimensionamento acima a fecha se a largura crescer com ela
        aberta) — equivalente, na prática, a "nunca montada como modal" (E-08).
      */}
      <MobileTopBar
        isDrawerOpen={isDrawerOpen}
        onOpenMenu={() => setDrawerOpen(true)}
        ref={menuButtonRef}
      />
      <NavigationDrawer
        authService={authService}
        onClose={() => {
          closeDrawer();
          // V-14: o foco retorna ao botão que abriu a gaveta, por qualquer via de
          // fechamento — Esc, véu ou seleção de destino.
          menuButtonRef.current?.focus();
        }}
        open={isDrawerOpen}
        roles={roles}
      />

      <main
        className="mx-auto w-full max-w-6xl px-4 py-6 md:flex-1 md:px-8 md:pb-8 focus:outline-none"
        id="conteudo-principal"
        // Sem tabIndex, o link "Pular para o conteúdo" rola até aqui mas não move o foco
        // de teclado de verdade — <main> não é focável por padrão. -1 o torna alvo
        // válido de foco programático sem entrar na ordem de Tab normal da página.
        tabIndex={-1}
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
    </div>
  );
}
