import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const refusalSchema = z.object({
  reason: z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .pipe(
      z.string().min(1, 'Informe o motivo da recusa.').max(500, 'Use no máximo 500 caracteres.'),
    ),
});

type RefusalValues = z.infer<typeof refusalSchema>;

interface RefusalReasonModalProps {
  busy?: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void> | void;
  open: boolean;
  presenceId: string;
}

export function RefusalReasonModal({
  busy = false,
  onClose,
  onSubmit,
  open,
  presenceId,
}: RefusalReasonModalProps) {
  const form = useForm<RefusalValues>({
    defaultValues: { reason: '' },
    resolver: zodResolver(refusalSchema),
  });
  if (!open) return null;

  const submit = form.handleSubmit(async ({ reason }) => {
    await onSubmit(reason);
    form.reset();
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" role="presentation">
      <section
        aria-describedby={`refusal-description-${presenceId}`}
        aria-labelledby={`refusal-title-${presenceId}`}
        aria-modal="true"
        className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-2xl"
        role="dialog"
      >
        <h2 className="text-2xl font-black" id={`refusal-title-${presenceId}`}>
          Recusar convocação
        </h2>
        <p className="mt-2 text-muted-foreground" id={`refusal-description-${presenceId}`}>
          O motivo é obrigatório e será visível somente para você e para a comissão técnica.
        </p>
        <form className="mt-5 space-y-4" noValidate onSubmit={(event) => void submit(event)}>
          <label className="block font-semibold" htmlFor={`refusal-reason-${presenceId}`}>
            Motivo da recusa
          </label>
          <textarea
            className="form-input min-h-32"
            id={`refusal-reason-${presenceId}`}
            maxLength={500}
            {...form.register('reason')}
          />
          <p className="min-h-5 text-sm text-destructive" role="alert">
            {form.formState.errors.reason?.message}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="min-h-12 rounded-xl border px-5 font-bold"
              onClick={onClose}
              type="button"
            >
              Voltar
            </button>
            <button
              className="min-h-12 rounded-xl bg-destructive px-5 font-bold text-destructive-foreground disabled:opacity-60"
              disabled={busy}
              type="submit"
            >
              {busy ? 'Enviando…' : 'Confirmar recusa'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
