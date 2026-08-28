import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  createStatisticsService,
  statisticsKeys,
  type StatisticsService,
} from '@/features/statistics/api/statistics.service';
import { votingKeys } from '@/features/mvp-voting/api/voting.service';
import { ConfirmationDialog } from '@/shared/components/feedback';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { mapToAppError } from '@/shared/lib/app-error';

const reopenSchema = z.object({
  explanation: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .pipe(
      z
        .string()
        .min(1, 'Informe a explicação da correção.')
        .max(500, 'Use no máximo 500 caracteres.'),
    ),
});

type ReopenValues = z.infer<typeof reopenSchema>;

interface ReopenMatchDialogProps {
  matchId: string;
  onReopened?: () => void;
  service?: StatisticsService;
}

export function ReopenMatchDialog({
  matchId,
  onReopened,
  service = createStatisticsService(),
}: ReopenMatchDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ReopenValues | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const form = useForm<ReopenValues>({
    defaultValues: { explanation: '' },
    resolver: zodResolver(reopenSchema),
  });
  const review = form.handleSubmit((values) => setPending(values));

  async function reopen() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await service.reopen({ explanation: pending.explanation, matchId });
      setPending(null);
      setOpen(false);
      form.reset();
      setSuccess('Partida reaberta para correção.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: statisticsKeys.all }),
        queryClient.invalidateQueries({ queryKey: votingKeys.all }),
      ]);
      onReopened?.();
    } catch (cause) {
      setPending(null);
      setError(mapToAppError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-destructive/30 bg-card p-6">
      <h2 className="text-xl font-black">Correção de estatísticas</h2>
      <p className="mt-2 text-muted-foreground">
        A reabertura invalida a consolidação, a rodada, os votos e os prêmios atuais sem apagar o
        histórico. Depois da correção, reconsolide para abrir uma nova rodada.
      </p>
      <OnlineActionGuard explanation="Reconecte-se para reabrir a partida.">
        <button
          className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl border border-destructive px-5 font-bold text-destructive"
          onClick={() => {
            setError(null);
            setSuccess(null);
            setOpen(true);
          }}
          type="button"
        >
          <RotateCcw aria-hidden="true" className="h-5 w-5" /> Reabrir para correção
        </button>
      </OnlineActionGuard>
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className="mt-3 font-semibold">
        {success}
      </p>

      {open ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-foreground/50 p-4">
          <section
            aria-describedby="reopen-statistics-description"
            aria-labelledby="reopen-statistics-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl"
            role="dialog"
          >
            <h2 className="text-2xl font-black" id="reopen-statistics-title">
              Explicar correção
            </h2>
            <p className="mt-2 text-muted-foreground" id="reopen-statistics-description">
              Registre por que o resultado precisa ser corrigido. A explicação será auditada.
            </p>
            <form className="mt-5 space-y-4" noValidate onSubmit={(event) => void review(event)}>
              <label className="block font-semibold" htmlFor="reopen-statistics-explanation">
                Explicação obrigatória da correção
              </label>
              <textarea
                autoFocus
                className="form-input min-h-32"
                id="reopen-statistics-explanation"
                maxLength={500}
                {...form.register('explanation')}
              />
              <p className="min-h-5 text-sm text-destructive" role="alert">
                {form.formState.errors.explanation?.message}
              </p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  className="min-h-12 rounded-xl border px-5 font-bold"
                  onClick={() => {
                    setOpen(false);
                    form.reset();
                  }}
                  type="button"
                >
                  Cancelar
                </button>
                <OnlineActionGuard explanation="Reconecte-se para revisar a reabertura.">
                  <button
                    className="min-h-12 rounded-xl bg-destructive px-5 font-bold text-destructive-foreground disabled:opacity-60"
                    disabled={busy}
                    type="submit"
                  >
                    Revisar reabertura
                  </button>
                </OnlineActionGuard>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      <ConfirmationDialog
        confirmLabel="Invalidar e reabrir"
        description="A consolidação atual, sua rodada de votação, votos e prêmios deixarão de contar. Todo o histórico será preservado para auditoria."
        onCancel={() => setPending(null)}
        onConfirm={() => void reopen()}
        open={pending !== null}
        title="Invalidar consolidação atual?"
      />
    </section>
  );
}
