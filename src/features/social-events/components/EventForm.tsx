import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { SocialEventsService } from '@/features/social-events/api/social-events.service';
import { useCreateSocialEvent } from '@/features/social-events/queries/social-events.queries';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { mapToAppError } from '@/shared/lib/app-error';
import { saoPauloLocalToUtcIso } from '@/shared/lib/date-time';

const schema = z.object({
  eventAt: z.string().min(1, 'Informe a data e a hora.'),
  locationName: z.string().trim().min(1, 'Informe o local.').max(160, 'Use no máximo 160 caracteres.'),
  title: z.string().trim().min(2, 'Informe um título.').max(120, 'Use no máximo 120 caracteres.'),
  totalCost: z.coerce.number().min(0, 'O custo não pode ser negativo.'),
});

type Values = z.infer<typeof schema>;

interface EventFormProps {
  onCreated: () => void;
  service?: SocialEventsService;
}

/** Criação de evento social (FR-2.1). PRESIDENT + AAL2. */
export function EventForm({ onCreated, service }: EventFormProps) {
  const create = useCreateSocialEvent(service);
  const [feedback, setFeedback] = useState<string | null>(null);
  const form = useForm<Values>({
    defaultValues: { eventAt: '', locationName: '', title: '', totalCost: 0 },
    resolver: zodResolver(schema),
  });

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={form.handleSubmit((values) => {
        setFeedback(null);
        create.mutate(
          {
            eventAt: saoPauloLocalToUtcIso(values.eventAt),
            locationName: values.locationName.trim(),
            title: values.title.trim(),
            totalCost: values.totalCost,
          },
          {
            onSuccess: () => {
              form.reset();
              setFeedback('Evento criado.');
              onCreated();
            },
          },
        );
      })}
    >
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-semibold">Título</span>
        <input
          className="min-h-11 w-full rounded-lg border border-input bg-background px-3"
          {...form.register('title')}
        />
        {form.formState.errors.title ? (
          <span className="mt-1 block text-destructive">{form.formState.errors.title.message}</span>
        ) : null}
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-semibold">Data e hora</span>
        <input
          className="min-h-11 w-full rounded-lg border border-input bg-background px-3"
          type="datetime-local"
          {...form.register('eventAt')}
        />
        {form.formState.errors.eventAt ? (
          <span className="mt-1 block text-destructive">
            {form.formState.errors.eventAt.message}
          </span>
        ) : null}
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-semibold">Custo total (R$)</span>
        <input
          className="min-h-11 w-full rounded-lg border border-input bg-background px-3"
          inputMode="decimal"
          {...form.register('totalCost')}
        />
        {form.formState.errors.totalCost ? (
          <span className="mt-1 block text-destructive">
            {form.formState.errors.totalCost.message}
          </span>
        ) : null}
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-semibold">Local</span>
        <input
          className="min-h-11 w-full rounded-lg border border-input bg-background px-3"
          {...form.register('locationName')}
        />
        {form.formState.errors.locationName ? (
          <span className="mt-1 block text-destructive">
            {form.formState.errors.locationName.message}
          </span>
        ) : null}
      </label>

      {create.isError ? (
        <p className="text-sm text-destructive sm:col-span-2">
          {mapToAppError(create.error).message}
        </p>
      ) : null}
      {feedback ? <p className="text-sm text-success sm:col-span-2">{feedback}</p> : null}

      <OnlineActionGuard>
        <button
          className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60 sm:col-span-2"
          disabled={create.isPending}
          type="submit"
        >
          Criar evento
        </button>
      </OnlineActionGuard>
    </form>
  );
}
