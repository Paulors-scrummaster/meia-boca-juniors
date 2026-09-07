import {
  BarChart3,
  Bell,
  Briefcase,
  Goal,
  Home,
  Megaphone,
  Settings,
  Trophy,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

import type { Database } from '@/shared/types/database.generated';

type AppRole = Database['public']['Enums']['app_role'];

interface NavigationItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end: boolean;
  visibleFor: 'all' | readonly AppRole[];
}

/**
 * Conjunto normativo (data-model.md §3.2). Fechado: nenhum item novo, nenhum destino
 * existente sem item (V-10, V-11). As condições de `visibleFor` são idênticas às
 * vigentes antes da feature (V-12) — apenas reorganizadas em declaração única.
 */
const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  { end: true, icon: Home, label: 'Início', to: '/app', visibleFor: 'all' },
  { end: false, icon: Users, label: 'Elenco', to: '/app/roster', visibleFor: 'all' },
  { end: false, icon: Goal, label: 'Partidas', to: '/app/matches', visibleFor: 'all' },
  { end: false, icon: BarChart3, label: 'Estatísticas', to: '/app/statistics', visibleFor: 'all' },
  { end: false, icon: Megaphone, label: 'Mural', to: '/app/notices', visibleFor: 'all' },
  {
    end: false,
    icon: Bell,
    label: 'Notificações',
    to: '/app/notification-preferences',
    visibleFor: 'all',
  },
  {
    end: false,
    icon: UserCircle,
    label: 'Área do atleta',
    to: '/app/athlete',
    visibleFor: ['ATHLETE'],
  },
  {
    end: false,
    icon: Trophy,
    label: 'Craque do Jogo',
    to: '/app/athlete/mvp-voting',
    visibleFor: ['ATHLETE'],
  },
  {
    end: false,
    icon: Briefcase,
    label: 'Comissão técnica',
    to: '/app/staff',
    visibleFor: ['COACH', 'PRESIDENT'],
  },
  {
    end: false,
    icon: Settings,
    label: 'Administração',
    to: '/app/admin',
    visibleFor: ['PRESIDENT'],
  },
];

function isVisible(item: NavigationItem, roles: readonly AppRole[]): boolean {
  return item.visibleFor === 'all' || item.visibleFor.some((role) => roles.includes(role));
}

interface NavigationListProps {
  className?: string;
  /** Chamado após navegar: usado pela gaveta mobile para fechar (FR-023). Sem efeito no desktop. */
  onNavigate?: () => void;
  roles: readonly AppRole[];
}

/**
 * Corpo da casca de navegação (C-L1, seção "CORPO"). Reaproveitada pela barra lateral
 * desktop e pela gaveta mobile, para que as duas repliquem exatamente a mesma
 * hierarquia (FR-022).
 */
export function NavigationList({ className = '', onNavigate, roles }: NavigationListProps) {
  const items = NAVIGATION_ITEMS.filter((item) => isVisible(item, roles));

  return (
    <ul className={`flex flex-col gap-1 ${className}`}>
      {items.map(({ end, icon: Icon, label, to }) => (
        <li key={to}>
          <NavLink
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-elevated hover:text-foreground'
              }`
            }
            end={end}
            onClick={onNavigate}
            to={to}
          >
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
