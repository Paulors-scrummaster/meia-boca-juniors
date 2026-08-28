import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormRegisterReturn,
} from 'react-hook-form';

import {
  createStatisticsService,
  statisticsKeys,
  type ConsolidateMatchInput,
  type StatisticsService,
} from '@/features/statistics/api/statistics.service';
import { votingKeys } from '@/features/mvp-voting/api/voting.service';
import {
  consolidationSchema,
  type ConsolidationValues,
} from '@/features/statistics/lib/statistics-validation';
import { ConfirmationDialog } from '@/shared/components/feedback';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { mapToAppError } from '@/shared/lib/app-error';

export interface ContributionAthlete {
  id: string;
  shirtName: string;
  shirtNumber: number;
}

interface ConsolidationFormProps {
  athletes: ContributionAthlete[];
  matchId: string;
  onConsolidated?: () => void;
  service?: StatisticsService;
}

export function ConsolidationForm({
  athletes,
  matchId,
  onConsolidated,
  service = createStatisticsService(),
}: ConsolidationFormProps) {
  const [pending, setPending] = useState<ConsolidationValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<ConsolidationValues>({
    defaultValues: { goals: [], mbjScore: 0, opponentScore: 0 },
    resolver: zodResolver(consolidationSchema),
  });
  const contributions = useFieldArray({ control: form.control, name: 'goals' });
  const watchedGoals = useWatch({ control: form.control, name: 'goals' });

  const review = form.handleSubmit((values) => {
    setError(null);
    setSuccess(null);
    setPending(values);
  });

  async function consolidate() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const input: ConsolidateMatchInput = {
        goals: pending.goals.map((goal, index) => ({ ...goal, sequence: index + 1 })),
        matchId,
        mbjScore: pending.mbjScore,
        opponentScore: pending.opponentScore,
      };
      await service.consolidate(input);
      setPending(null);
      setSuccess('Partida consolidada e votação aberta por 24 horas.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: statisticsKeys.all }),
        queryClient.invalidateQueries({ queryKey: votingKeys.all }),
      ]);
      onConsolidated?.();
    } catch (cause) {
      setPending(null);
      setError(mapToAppError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-lg sm:p-8">
      <h2 className="text-2xl font-black">Consolidar resultado oficial</h2>
      <p className="mt-2 text-muted-foreground">
        O placar e as contribuições serão vinculados à escalação oficial vigente neste instante.
      </p>

      <form className="mt-6 space-y-6" noValidate onSubmit={(event) => void review(event)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ScoreField
            error={form.formState.errors.mbjScore?.message}
            id="statistics-mbj-score"
            label="Placar do MBJ"
            register={form.register('mbjScore', { valueAsNumber: true })}
          />
          <ScoreField
            error={form.formState.errors.opponentScore?.message}
            id="statistics-opponent-score"
            label="Placar do adversário"
            register={form.register('opponentScore', { valueAsNumber: true })}
          />
        </div>

        <fieldset className="space-y-4">
          <legend className="text-lg font-black">Gols e assistências do MBJ</legend>
          {contributions.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma contribuição adicionada.</p>
          ) : null}
          {contributions.fields.map((field, index) => {
            const ownGoal = watchedGoals[index]?.isOpponentOwnGoal ?? false;
            return (
              <article className="rounded-2xl border bg-background p-4" key={field.id}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black">Gol {index + 1}</h3>
                  <button
                    aria-label={`Remover contribuição ${index + 1}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 font-semibold text-destructive"
                    onClick={() => contributions.remove(index)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" /> Remover
                  </button>
                </div>
                <label className="mt-4 flex min-h-11 items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    {...form.register(`goals.${index}.isOpponentOwnGoal`, {
                      onChange: (event) => {
                        if (event.target.checked) {
                          form.setValue(`goals.${index}.scorerAthleteId`, null);
                          form.setValue(`goals.${index}.assistantAthleteId`, null);
                        }
                      },
                    })}
                  />
                  Gol contra do adversário {index + 1}
                </label>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <AthleteSelect
                    athletes={athletes}
                    control={form.control}
                    disabled={ownGoal}
                    error={form.formState.errors.goals?.[index]?.scorerAthleteId?.message}
                    label={`Autor do gol ${index + 1}`}
                    name={`goals.${index}.scorerAthleteId`}
                  />
                  <AthleteSelect
                    athletes={athletes}
                    control={form.control}
                    disabled={ownGoal}
                    error={form.formState.errors.goals?.[index]?.assistantAthleteId?.message}
                    label={`Assistência do gol ${index + 1}`}
                    name={`goals.${index}.assistantAthleteId`}
                  />
                </div>
              </article>
            );
          })}
          <p className="text-sm text-destructive" role="alert">
            {form.formState.errors.goals?.root?.message ?? form.formState.errors.goals?.message}
          </p>
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-bold text-primary"
            onClick={() =>
              contributions.append({
                assistantAthleteId: null,
                isOpponentOwnGoal: false,
                scorerAthleteId: null,
                sequence: contributions.fields.length + 1,
              })
            }
            type="button"
          >
            <Plus aria-hidden="true" className="h-5 w-5" /> Adicionar contribuição
          </button>
        </fieldset>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <p aria-live="polite" className="text-sm font-semibold">
          {success}
        </p>
        <OnlineActionGuard explanation="Reconecte-se para consolidar o resultado oficial.">
          <button
            className="min-h-12 rounded-xl bg-primary px-6 font-bold text-primary-foreground disabled:opacity-60"
            disabled={busy}
            type="submit"
          >
            {busy ? 'Consolidando…' : 'Revisar consolidação'}
          </button>
        </OnlineActionGuard>
      </form>

      <ConfirmationDialog
        confirmLabel="Consolidar e abrir votação"
        description={`Confirme o placar MBJ ${pending?.mbjScore ?? 0} × ${pending?.opponentScore ?? 0}. A revisão atual da escalação ficará vinculada e uma votação de 24 horas será aberta.`}
        onCancel={() => setPending(null)}
        onConfirm={() => void consolidate()}
        open={pending !== null}
        title="Confirmar consolidação oficial"
      />
    </section>
  );
}

function ScoreField({
  error,
  id,
  label,
  register,
}: {
  error: string | undefined;
  id: string;
  label: string;
  register: UseFormRegisterReturn;
}) {
  return (
    <div>
      <label className="font-semibold" htmlFor={id}>
        {label}
      </label>
      <input
        className="form-input"
        id={id}
        inputMode="numeric"
        min={0}
        type="number"
        {...register}
      />
      <p className="mt-1 min-h-5 text-sm text-destructive" role="alert">
        {error}
      </p>
    </div>
  );
}

function AthleteSelect({
  athletes,
  control,
  disabled,
  error,
  label,
  name,
}: {
  athletes: ContributionAthlete[];
  control: Control<ConsolidationValues>;
  disabled: boolean;
  error: string | undefined;
  label: `Assistência do gol ${number}` | `Autor do gol ${number}`;
  name: `goals.${number}.assistantAthleteId` | `goals.${number}.scorerAthleteId`;
}) {
  return (
    <div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <label className="block font-semibold">
            {label}
            <select
              className="form-input"
              disabled={disabled}
              onChange={(event) => field.onChange(event.target.value || null)}
              value={(field.value as string | null) ?? ''}
            >
              <option value="">Sem atleta</option>
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  #{athlete.shirtNumber} · {athlete.shirtName}
                </option>
              ))}
            </select>
          </label>
        )}
      />
      <p className="mt-1 min-h-5 text-sm text-destructive" role="alert">
        {error}
      </p>
    </div>
  );
}
