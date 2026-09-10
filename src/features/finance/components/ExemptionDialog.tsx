import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { FinanceService } from '@/features/finance/api/charges.service';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { useOnlineMutation } from '@/shared/hooks/use-online-mutation';
import { mapToAppError } from '@/shared/lib/app-error';

const schema = z.object({
  athleteId: z.string().uuid('Selecione o atleta.'),
  period: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2})?$/, 'Use o formato AAAA-MM ou deixe em branco.'),
  reason: z.string().trim().min(1, 'Informe o motivo.').max(500, 'Use no máximo 500 caracteres.'),
});

type Values = z.infer<typeof schema>;

interface ExemptionDialogProps {
  athletes: { fullName: string; id: string; shirtNumber: number | null }[];
  onClose: () => void;
  onDone: () => void;
  open: boolean;
  service: FinanceService;
}

/**
 * Concede isenção de mensalidade a um atleta (FR-004). Período vazio = isenção
 * indefinida (aplica todo mês até ser removida).
 */
export function ExemptionDialog({
  athletes,
  onClose,
  onDone,
  open,
  service,
}: ExemptionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const form = useForm<Values>({
    defaultValues: { athleteId: '', period: '', reason: '' },
    resolver: zodResolver(schema),
  });
  const run = useOnlineMutation<void, Error, Values>({
    mutationFn: (values) =>
      service.grantExemption({
        athleteId: values.athleteId,
        period: values.period.trim() === '' ? null : values.period.trim(),
        reason: values.reason.trim(),
      }),
    onSuccess: () => {
      form.reset({ athleteId: '', period: '', reason: '' });
      onDone();
      onClose();
    },
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      aria-label="Conceder isenção"
      className="w-[min(28rem,90vw)] rounded-2xl border bg-card p-6 text-foreground backdrop:bg-overlay/60"
      onClose={onClose}
      ref={dialogRef}
    >
      <h2 className="text-lg font-black">Conceder isenção</h2>
      <form className="mt-4 space-y-3" onSubmit={form.handleSubmit((values) => run.mutate(values))}>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Atleta</span>
          <select
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3"
            {...form.register('athleteId')}
          >
            <option value="">Selecione…</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.shirtNumber != null ? `#${athlete.shirtNumber} ` : ''}
                {athlete.fullName}
              </option>
            ))}
          </select>
          {form.formState.errors.athleteId ? (
            <span className="mt-1 block text-destructive">
              {form.formState.errors.athleteId.message}
            </span>
          ) : null}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Período (AAAA-MM, vazio = indefinido)</span>
          <input
            className="min-h-11 w-40 rounded-lg border border-input bg-background px-3"
            placeholder="2026-10"
            {...form.register('period')}
          />
          {form.formState.errors.period ? (
            <span className="mt-1 block text-destructive">
              {form.formState.errors.period.message}
            </span>
          ) : null}
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Motivo</span>
          <textarea
            className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2"
            {...form.register('reason')}
          />
          {form.formState.errors.reason ? (
            <span className="mt-1 block text-destructive">
              {form.formState.errors.reason.message}
            </span>
          ) : null}
        </label>
        {run.isError ? (
          <p className="text-sm text-destructive">{mapToAppError(run.error).message}</p>
        ) : null}
        <OnlineActionGuard>
          <div className="flex justify-end gap-2">
            <button
              className="min-h-11 rounded-lg border border-border px-4 font-semibold"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60"
              disabled={run.isPending}
              type="submit"
            >
              Conceder
            </button>
          </div>
        </OnlineActionGuard>
      </form>
    </dialog>
  );
}
