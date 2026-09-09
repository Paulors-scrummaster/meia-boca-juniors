// Feature 003 · US4 (UX & Gamificação) · T091
// Formulário da comissão para os seis atributos do cartão (RHF + Zod). Cada campo
// é `1..99` ou vazio (= null). O `overall` é derivado no banco; o retorno do
// comando é exibido como prévia. COACH/PRESIDENT — a rota é quem protege.

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import type { GamificationService } from '@/features/gamification/api/gamification.service';
import {
  useAthleteCard,
  useSetAthleteAttributes,
} from '@/features/gamification/queries/gamification.queries';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';

const ATTRIBUTES = [
  { key: 'pace', label: 'Ritmo (RIT)' },
  { key: 'shooting', label: 'Finalização (FIN)' },
  { key: 'passing', label: 'Passe (PAS)' },
  { key: 'dribbling', label: 'Condução (CON)' },
  { key: 'defending', label: 'Defesa (DEF)' },
  { key: 'physical', label: 'Físico (FÍS)' },
] as const;

const attributeField = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || (/^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 99),
    'Use um número de 1 a 99, ou deixe em branco.',
  );

const schema = z.object({
  defending: attributeField,
  dribbling: attributeField,
  pace: attributeField,
  passing: attributeField,
  physical: attributeField,
  shooting: attributeField,
});

type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  defending: '',
  dribbling: '',
  pace: '',
  passing: '',
  physical: '',
  shooting: '',
};

const toNumberOrNull = (value: string): number | null => (value === '' ? null : Number(value));

interface AttributeEditorProps {
  athleteId: string;
  service?: GamificationService | undefined;
}

export function AttributeEditor({ athleteId, service }: AttributeEditorProps) {
  const card = useAthleteCard(athleteId, service);
  const save = useSetAthleteAttributes(athleteId, service);
  const [feedback, setFeedback] = useState<string | null>(null);
  const form = useForm<Values>({ defaultValues: EMPTY, resolver: zodResolver(schema) });
  const { reset } = form;

  useEffect(() => {
    if (!card.data) return;
    reset({
      defending: card.data.defending?.toString() ?? '',
      dribbling: card.data.dribbling?.toString() ?? '',
      pace: card.data.pace?.toString() ?? '',
      passing: card.data.passing?.toString() ?? '',
      physical: card.data.physical?.toString() ?? '',
      shooting: card.data.shooting?.toString() ?? '',
    });
  }, [card.data, reset]);

  if (card.isPending) return <LoadingState label="Carregando atributos" />;
  if (card.isError)
    return (
      <ErrorState message={mapToAppError(card.error).message} onRetry={() => void card.refetch()} />
    );

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={form.handleSubmit((values) => {
        setFeedback(null);
        save.mutate(
          {
            defending: toNumberOrNull(values.defending),
            dribbling: toNumberOrNull(values.dribbling),
            pace: toNumberOrNull(values.pace),
            passing: toNumberOrNull(values.passing),
            physical: toNumberOrNull(values.physical),
            shooting: toNumberOrNull(values.shooting),
          },
          {
            onSuccess: (result) => {
              setFeedback(
                result.overall === null
                  ? 'Atributos salvos. Cartão ainda incompleto — falta pelo menos um valor.'
                  : `Atributos salvos. Overall ${result.overall}.`,
              );
            },
          },
        );
      })}
    >
      {ATTRIBUTES.map(({ key, label }) => (
        <label className="text-sm" key={key}>
          <span className="mb-1 block font-semibold">{label}</span>
          <input
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3"
            inputMode="numeric"
            {...form.register(key)}
          />
          {form.formState.errors[key] ? (
            <span className="mt-1 block text-destructive">{form.formState.errors[key]?.message}</span>
          ) : null}
        </label>
      ))}

      {save.isError ? (
        <p className="text-sm text-destructive sm:col-span-2">
          {mapToAppError(save.error).message}
        </p>
      ) : null}
      {feedback ? <p className="text-sm text-success sm:col-span-2">{feedback}</p> : null}

      <OnlineActionGuard>
        <button
          className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60 sm:col-span-2"
          disabled={save.isPending}
          type="submit"
        >
          Salvar atributos
        </button>
      </OnlineActionGuard>
    </form>
  );
}
