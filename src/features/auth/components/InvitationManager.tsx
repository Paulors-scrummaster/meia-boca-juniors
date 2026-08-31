import { Copy, Link2, RefreshCw, UserX } from 'lucide-react';
import { useState } from 'react';

import { createAuthService, type AuthService } from '@/features/auth/api/auth.service';
import { supabase } from '@/shared/adapters/supabase/client';
import { ConfirmationDialog } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';

interface InvitationManagerProps {
  athleteId: string;
  service?: AuthService;
}

type Operation = 'CREATE' | 'RESEND' | 'REVOKE';

export function InvitationManager({
  athleteId,
  service = createAuthService(supabase),
}: InvitationManagerProps) {
  const [email, setEmail] = useState('');
  const [deliveryLink, setDeliveryLink] = useState('');
  const [status, setStatus] = useState<'PENDING' | 'REVOKED' | null>(null);
  const [pendingOperation, setPendingOperation] = useState<Operation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  async function execute(operation: Operation) {
    setPendingOperation(operation);
    setError(null);
    setCopied(false);
    setStatus(null);
    try {
      const result = await service.manageInvitation({
        athleteId,
        ...(operation === 'CREATE' ? { email: email.trim() } : {}),
        idempotencyKey: crypto.randomUUID(),
        operation,
      });
      setStatus(result.logicalStatus);
      setDeliveryLink(result.deliveryLink ?? '');
    } catch (cause) {
      setError(mapToAppError(cause).message);
    } finally {
      setPendingOperation(null);
    }
  }

  return (
    <section aria-labelledby="invitation-manager-title" className="rounded-3xl border bg-card p-6">
      <div className="flex items-center gap-3">
        <Link2 aria-hidden="true" className="h-7 w-7 text-primary" />
        <div>
          <h2 className="text-xl font-black" id="invitation-manager-title">
            Convite individual
          </h2>
          <p className="text-sm text-muted-foreground">
            Gere um link temporário e encaminhe-o somente ao integrante correto.
          </p>
        </div>
      </div>

      <form
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void execute('CREATE');
        }}
      >
        <label className="block font-semibold" htmlFor="invitation-email">
          E-mail individual
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            autoComplete="off"
            className="form-input flex-1"
            id="invitation-email"
            maxLength={320}
            onChange={(event) => setEmail(event.target.value)}
            required
            spellCheck={false}
            type="email"
            value={email}
          />
          <button
            className="min-h-12 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
            disabled={pendingOperation !== null || email.trim().length === 0}
            type="submit"
          >
            {pendingOperation === 'CREATE' ? 'Gerando…' : 'Gerar convite'}
          </button>
        </div>
      </form>

      {deliveryLink ? (
        <div className="mt-5 rounded-2xl bg-muted p-4">
          <label className="font-semibold" htmlFor="invitation-delivery-link">
            Link temporário
          </label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              className="form-input flex-1"
              id="invitation-delivery-link"
              readOnly
              spellCheck={false}
              value={deliveryLink}
            />
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border bg-card px-5 font-bold"
              onClick={() => {
                void navigator.clipboard
                  .writeText(deliveryLink)
                  .then(() => setCopied(true))
                  .catch(() => setError('Não foi possível copiar o link. Copie-o manualmente.'));
              }}
              type="button"
            >
              <Copy aria-hidden="true" className="h-5 w-5" /> Copiar link
            </button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            O link fica apenas nesta tela e não é persistido no dispositivo.
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border bg-card px-5 font-bold disabled:opacity-60"
          disabled={pendingOperation !== null}
          onClick={() => void execute('RESEND')}
          type="button"
        >
          <RefreshCw aria-hidden="true" className="h-5 w-5" />
          {pendingOperation === 'RESEND' ? 'Reenviando…' : 'Gerar novo link do convite ativo'}
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-destructive px-5 font-bold text-destructive disabled:opacity-60"
          disabled={pendingOperation !== null}
          onClick={() => setConfirmingRevoke(true)}
          type="button"
        >
          <UserX aria-hidden="true" className="h-5 w-5" /> Revogar convite ativo
        </button>
      </div>

      <p aria-live="polite" className="mt-4 min-h-6 text-sm">
        {copied ? 'Link copiado. Envie-o somente ao integrante correto.' : null}
        {status === 'PENDING' && !copied && !error ? 'Convite pendente gerado com sucesso.' : null}
        {status === 'REVOKED' ? 'Convite revogado com sucesso.' : null}
        {error ? error : null}
      </p>

      <ConfirmationDialog
        confirmLabel="Revogar convite"
        description="O link ativo deixará de funcionar e a identidade pendente será desabilitada."
        onCancel={() => setConfirmingRevoke(false)}
        onConfirm={() => {
          setConfirmingRevoke(false);
          void execute('REVOKE');
        }}
        open={confirmingRevoke}
        title="Revogar convite ativo?"
      />
    </section>
  );
}
