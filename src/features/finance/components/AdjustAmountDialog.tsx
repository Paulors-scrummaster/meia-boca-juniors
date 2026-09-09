import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { FinanceService } from '@/features/finance/api/charges.service';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { useOnlineMutation } from '@/shared/hooks/use-online-mutation';
import { mapToAppError } from '@/shared/lib/app-error';

const schema = z.object({
  amount: z.coerce.number().positive('Informe um valor maior que zero.'),
  reason: z.string().trim().min(1, 'Informe o motivo.').max(500, 'Use no máximo 500 caracteres.'),
});

type Values = z.infer<typeof schema>;

interface AdjustAmountDialogProps {
  chargeId: string;
  currentAmount: number;
  onClose: () => void;
  onDone: () => void;
  open: boolean;
  service: FinanceService;
}

/** Ajuste do valor de uma cobrança específica (FR-1.2). Auditado com motivo. */
export function AdjustAmountDialog({
  chargeId,
  currentAmount,
  onClose,
  onDone,
  open,
  service,
}: AdjustAmountDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const form = useForm<Values>({
    defaultValues: { amount: currentAmount, reason: '' },
    resolver: zodResolver(schema),
  });
  const run = useOnlineMutation<void, Error, Values>({
    mutationFn: (values) =>
      service.adjustAmount({ amount: values.amount, chargeId, reason: values.reason.trim() }),
    onSuccess: () => {
      form.reset({ amount: currentAmount, reason: '' });
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
      aria-label="Ajustar valor da cobrança"
      className="w-[min(28rem,90vw)] rounded-2xl border bg-card p-6 text-foreground backdrop:bg-overlay/60"
      onClose={onClose}
      ref={dialogRef}
    >
      <h2 className="text-lg font-black">Ajustar valor</h2>
      <form
        className="mt-4 space-y-3"
        onSubmit={form.handleSubmit((values) => run.mutate(values))}
      >
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Novo valor (R$)</span>
          <input
            className="min-h-11 w-40 rounded-lg border border-input bg-background px-3"
            inputMode="decimal"
            {...form.register('amount')}
          />
          {form.formState.errors.amount ? (
            <span className="mt-1 block text-sm text-destructive">
              {form.formState.errors.amount.message}
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
            <span className="mt-1 block text-sm text-destructive">
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
              Salvar ajuste
            </button>
          </div>
        </OnlineActionGuard>
      </form>
    </dialog>
  );
}
