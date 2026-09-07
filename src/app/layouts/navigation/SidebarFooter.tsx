import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { useAuth } from '@/app/providers/AuthProvider';
import type { AuthService } from '@/features/auth/api/auth.service';

interface SidebarFooterProps {
  authService: AuthService;
}

/**
 * Rodapé fixo da casca de navegação (FR-017): identificação do usuário e o botão
 * "Sair", com distinção visual própria (token `destructive`) para reduzir o risco de
 * acionamento acidental (FR-018) — não é um erro, é a cor semântica mais próxima de
 * "ação de saída" já aprovada pelo sistema de tokens.
 *
 * A identificação usa `user.email`, já disponível na sessão (mesmo campo exibido em
 * `AcceptInvitationPage`); `profile` não carrega nome de exibição e estender sua
 * consulta alteraria um contrato de serviço fora do escopo desta feature (FR-028).
 */
export function SidebarFooter({ authService }: SidebarFooterProps) {
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <p className="truncate text-sm text-muted-foreground" title={user?.email ?? undefined}>
        {user?.email ?? 'Minha conta'}
      </p>
      <button
        className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-destructive/40 px-4 text-sm font-bold text-destructive hover:bg-destructive/10 disabled:opacity-60"
        disabled={signingOut}
        onClick={() => {
          setSigningOut(true);
          void authService.signOut().finally(() => setSigningOut(false));
        }}
        type="button"
      >
        <LogOut aria-hidden="true" className="h-5 w-5" />
        {signingOut ? 'Saindo…' : 'Sair'}
      </button>
    </div>
  );
}
