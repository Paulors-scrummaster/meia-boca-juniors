import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { ChargeType, FinanceService } from '@/features/finance/api/charges.service';
import { duesPeriod, defaultDueDate } from '@/features/finance/lib/currency';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { useOnlineMutation } from '@/shared/hooks/use-online-mutation';
import { mapToAppError } from '@/shared/lib/app-error';

const schema = z.object({
  amount: z.coerce.number().positive('Informe um valor maior que zero.'),
  athleteId: z.string().uuid('Selecione o atleta.'),
  dueDate: z.string().min(1, 'Informe o vencimento.'),
  type: z.enum(['MANUAL_OVERRIDE', 'EVENT_FEE']),
});

type Values = z.infer<typeof schema>;

interface ManualChargeFormProps {
  athletes: { fullName: string; id: string; shirtNumber: number | null }[];
  onDone: () => void;
  service: FinanceService;
}

const TYPE_LABEL: Record<Exclude<ChargeType, 'MONTHLY_AUTOMATIC'>, string> = {
  EVENT_FEE: 'Taxa de evento',
  MANUAL_OVERRIDE: 'Cobrança avulsa',
};

/** Cobrança manual avulsa para um atleta (FR-003). */
export function ManualChargeForm({ athletes, onDone, service }: ManualChargeFormProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const form = useForm<Values>({
    defaultValues: {
      amount: 0,
      athleteId: '',
      dueDate: defaultDueDate(duesPeriod()),
      type: 'MANUAL_OVERRIDE',
    },
    resolver: zodResolver(schema),
  });
  const run = useOnlineMutation<void, Error, Values>({
    mutationFn: (values) =>
      service.createManualCharge({
        amount: values.amount,
        athleteId: values.athleteId,
        dueDate: values.dueDate,
        type: values.type,
      }),
    onSuccess: () => {
      form.reset();
      setFeedback('Cobrança criada.');
      onDone();
    },
  });

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={form.handleSubmit((values) => run.mutate(values))}
    >
      <label className="text-sm">
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

      <label className="text-sm">
        <span className="mb-1 block font-semibold">Tipo</span>
        <select
          className="min-h-11 w-full rounded-lg border border-input bg-background px-3"
          {...form.register('type')}
        >
          {(Object.keys(TYPE_LABEL) as (keyof typeof TYPE_LABEL)[]).map((value) => (
            <option key={value} value={value}>
              {TYPE_LABEL[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-semibold">Valor (R$)</span>
        <input
          className="min-h-11 w-full rounded-lg border border-input bg-background px-3"
          inputMode="decimal"
          {...form.register('amount')}
        />
        {form.formState.errors.amount ? (
          <span className="mt-1 block text-destructive">
            {form.formState.errors.amount.message}
          </span>
        ) : null}
      </label>

      <label className="text-sm">
        <span className="mb-1 block font-semibold">Vencimento</span>
        <input
          className="min-h-11 w-full rounded-lg border border-input bg-background px-3"
          type="date"
          {...form.register('dueDate')}
        />
        {form.formState.errors.dueDate ? (
          <span className="mt-1 block text-destructive">
            {form.formState.errors.dueDate.message}
          </span>
        ) : null}
      </label>

      {run.isError ? (
        <p className="text-sm text-destructive sm:col-span-2">
          {mapToAppError(run.error).message}
        </p>
      ) : null}
      {feedback ? <p className="text-sm text-success sm:col-span-2">{feedback}</p> : null}

      <OnlineActionGuard>
        <button
          className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60 sm:col-span-2"
          disabled={run.isPending}
          type="submit"
        >
          Criar cobrança
        </button>
      </OnlineActionGuard>
    </form>
  );
}
