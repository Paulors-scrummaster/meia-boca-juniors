import { useEffect, useRef } from 'react';

import { NavigationList } from '@/app/layouts/navigation/NavigationList';
import { SidebarBrand } from '@/app/layouts/navigation/SidebarBrand';
import { SidebarFooter } from '@/app/layouts/navigation/SidebarFooter';
import { clubConfig } from '@/config/club.config';
import type { AuthService } from '@/features/auth/api/auth.service';
import type { Database } from '@/shared/types/database.generated';

type AppRole = Database['public']['Enums']['app_role'];

interface NavigationDrawerProps {
  authService: AuthService;
  onClose: () => void;
  open: boolean;
  roles: readonly AppRole[];
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Gaveta de navegação mobile (FR-022 a FR-024). `<dialog>` nativo aberto com
 * `showModal()`: inertização do fundo e fechamento por Esc vêm da plataforma, sem
 * biblioteca (research D-02). Reaproveita os mesmos três subcomponentes da barra
 * lateral desktop, replicando exatamente a mesma hierarquia vertical — topo fixo,
 * corpo rolável, rodapé fixo (E-02).
 *
 * `showModal()` torna o fundo inerte, mas **não** implementa wraparound de Tab
 * dentro do próprio diálogo — verificado empiricamente (T061): depois do último
 * elemento focável, o Tab escapa da página em vez de voltar ao primeiro. O
 * fechamento por Esc, o `close` unificado e a inertização do fundo continuam
 * nativos; só o laço de Tab nos limites do painel precisa de tratamento explícito.
 */
export function NavigationDrawer({ authService, onClose, open, roles }: NavigationDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // `close` cobre todo caminho de fechamento — Esc (via o `cancel` nativo), a
    // seleção de um destino, e o clique no véu abaixo — então é o único ponto que
    // precisa notificar o pai para sincronizar `isDrawerOpen` (research D-02).
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      aria-label={`${clubConfig.identity.fullName} — Área do clube`}
      className="navigation-drawer"
      onClick={(event) => {
        // O véu não fecha por padrão: só quando o clique cai no próprio elemento
        // de diálogo (a região do backdrop, fora do painel), não em um descendente.
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        const first = focusable.at(0);
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      ref={dialogRef}
    >
      <div className="flex h-full w-72 max-w-[85vw] flex-col bg-card">
        <div className="shrink-0 border-b p-5">
          <SidebarBrand />
        </div>
        <nav aria-label="Navegação principal" className="min-h-0 flex-1 overflow-y-auto p-3">
          <NavigationList onNavigate={onClose} roles={roles} />
        </nav>
        <div className="shrink-0 border-t p-5">
          <SidebarFooter authService={authService} />
        </div>
      </div>
    </dialog>
  );
}
