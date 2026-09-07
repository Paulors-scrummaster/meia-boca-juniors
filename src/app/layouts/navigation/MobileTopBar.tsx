import { Menu } from 'lucide-react';
import { forwardRef } from 'react';

import { clubConfig } from '@/config/club.config';

interface MobileTopBarProps {
  isDrawerOpen: boolean;
  onOpenMenu: () => void;
}

/**
 * Faixa superior mobile (contracts/navigation-shell.md): presente apenas abaixo de
 * 768px — ausente em larguras maiores, onde a barra lateral assume (FR-015a,
 * FR-021b). `aria-expanded` reflete o estado da gaveta.
 *
 * O botão encaminha a ref para que `AuthenticatedLayout` devolva o foco a ele
 * quando a gaveta fechar (V-14).
 */
export const MobileTopBar = forwardRef<HTMLButtonElement, MobileTopBarProps>(function MobileTopBar(
  { isDrawerOpen, onOpenMenu },
  ref,
) {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b bg-card px-4 md:hidden">
      <button
        aria-expanded={isDrawerOpen}
        aria-label="Abrir menu de navegação"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-elevated"
        onClick={onOpenMenu}
        ref={ref}
        type="button"
      >
        <Menu aria-hidden="true" className="h-6 w-6" />
      </button>
      <img
        alt={`Escudo do ${clubConfig.identity.shortName}`}
        className="h-8 w-8"
        src={clubConfig.assets.crest}
      />
      <p className="font-black">{clubConfig.identity.shortName}</p>
    </header>
  );
});
