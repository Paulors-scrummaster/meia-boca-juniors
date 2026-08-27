import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '@/app/providers/AuthProvider';
import { clubConfig } from '@/config/club.config';

interface NavigationItem {
  label: string;
  to: string;
}

export function AuthenticatedLayout() {
  const { roles } = useAuth();
  const items: NavigationItem[] = [
    { label: 'Início', to: '/app' },
    { label: 'Elenco', to: '/app/roster' },
    { label: 'Partidas', to: '/app/matches' },
  ];

  if (roles.includes('ATHLETE')) {
    items.push({ label: 'Área do atleta', to: '/app/athlete' });
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
      <header className="border-b bg-card px-4 py-4 md:row-span-2 md:border-b-0 md:border-r md:px-5">
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
      </header>

      <main
        className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 md:px-8 md:pb-8"
        id="conteudo-principal"
      >
        <Outlet />
      </main>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 flex min-h-20 items-stretch justify-around border-t bg-card px-2 pb-[env(safe-area-inset-bottom)] md:static md:col-start-1 md:row-start-2 md:flex-col md:justify-start md:border-r md:border-t-0 md:px-3 md:pb-6"
      >
        {items.map((item) => (
          <NavLink
            className={({ isActive }) =>
              `flex min-h-12 flex-1 items-center justify-center rounded-lg px-3 text-center text-xs font-bold md:flex-none md:justify-start md:text-sm ${
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
