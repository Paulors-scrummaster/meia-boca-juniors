import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  createMatchesService,
  matchKeys,
  type Match,
  type MatchesService,
} from '@/features/matches/api/matches.service';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { LoadingState } from '@/shared/components/feedback';
import { useOnlineMutation } from '@/shared/hooks/use-online-mutation';
import { mapToAppError } from '@/shared/lib/app-error';
import { saoPauloLocalToUtcIso, toSaoPauloLocalInput } from '@/shared/lib/date-time';

const schema = z
  .object({
    competitionName: z.string().trim().max(120, 'Use no máximo 120 caracteres.'),
    confirmationDeadline: z.string().min(1, 'Informe o prazo de confirmação.'),
    locationName: z.string().trim().max(160, 'Use no máximo 160 caracteres.'),
    matchDate: z.string().min(1, 'Informe a data e hora da partida.'),
    opponentName: z
      .string()
      .trim()
      .min(2, 'Informe o adversário.')
      .max(120, 'Use no máximo 120 caracteres.'),
    seasonId: z.string().uuid('Selecione a temporada.'),
  })
  .superRefine((values, context) => {
    try {
      if (
        new Date(saoPauloLocalToUtcIso(values.confirmationDeadline)) >=
        new Date(saoPauloLocalToUtcIso(values.matchDate))
      ) {
        context.addIssue({
          code: 'custom',
          message: 'O prazo deve ser anterior ao início da partida.',
          path: ['confirmationDeadline'],
        });
      }
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'Revise a data e o horário.',
        path: ['matchDate'],
      });
    }
  });

type MatchFormValues = z.infer<typeof schema>;

interface MatchFormProps {
  match?: Match;
  service?: MatchesService;
}

export function MatchForm({ match, service = createMatchesService() }: MatchFormProps) {
  const queryClient = useQueryClient();
  const seasons = useQuery({ queryFn: () => service.listSeasons(), queryKey: matchKeys.seasons() });
  const [feedback, setFeedback] = useState<string | null>(null);
  const form = useForm<MatchFormValues>({
    defaultValues: {
      competitionName: match?.competition_name ?? '',
      confirmationDeadline: match ? toSaoPauloLocalInput(match.confirmation_deadline) : '',
      locationName: match?.location_name ?? '',
      matchDate: match ? toSaoPauloLocalInput(match.match_date) : '',
      opponentName: match?.opponent_name ?? '',
      seasonId: match?.season_id ?? '',
    },
    resolver: zodResolver(schema),
  });
  const save = useOnlineMutation<Match | { resetCount: number }, Error, MatchFormValues>({
    mutationFn: async (values) => {
      const input = {
        competitionName: values.competitionName.trim() || null,
        confirmationDeadline: saoPauloLocalToUtcIso(values.confirmationDeadline),
        locationName: values.locationName.trim() || null,
        matchDate: saoPauloLocalToUtcIso(values.matchDate),
        opponentName: values.opponentName.trim().replace(/\s+/g, ' '),
      };
      return match
        ? service.rescheduleMatch(match.id, input)
        : service.createMatch({ ...input, seasonId: values.seasonId });
    },
    onSuccess: async (result) => {
      const resetCount = 'resetCount' in result ? result.resetCount : 0;
      setFeedback(
        resetCount > 0
          ? `Partida salva; reconfirmação solicitada para ${resetCount} atleta(s).`
          : 'Partida salva.',
      );
      await queryClient.invalidateQueries({ queryKey: matchKeys.all });
    },
  });
  const cancel = useOnlineMutation({
    mutationFn: () => service.cancelMatch(match!.id),
    onSuccess: async () => {
      setFeedback('Partida cancelada.');
      await queryClient.invalidateQueries({ queryKey: matchKeys.all });
    },
  });
  const reactivate = useOnlineMutation({
    mutationFn: () => service.reactivateMatch(match!.id),
    onSuccess: async () => {
      setFeedback('Partida reativada.');
      await queryClient.invalidateQueries({ queryKey: matchKeys.all });
    },
  });

  if (seasons.isPending) return <LoadingState label="Carregando temporadas" />;
  const submit = form.handleSubmit((values) => save.mutate(values));
  const error = save.error ?? cancel.error ?? reactivate.error;
  return (
    <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      <h1 className="text-3xl font-black">{match ? 'Editar partida' : 'Criar partida'}</h1>
      <p className="mt-2 text-muted-foreground">Horários informados no fuso de São Paulo.</p>
      <OnlineActionGuard>
        <form
          className="mt-6 grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={(event) => void submit(event)}
        >
          <Field error={form.formState.errors.seasonId?.message} label="Temporada">
            <select className="form-input" disabled={Boolean(match)} {...form.register('seasonId')}>
              <option value="">Selecione</option>
              {seasons.data?.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.year}
                </option>
              ))}
            </select>
          </Field>
          <Field error={form.formState.errors.opponentName?.message} label="Adversário">
            <input className="form-input" {...form.register('opponentName')} />
          </Field>
          <Field error={form.formState.errors.matchDate?.message} label="Data e hora da partida">
            <input className="form-input" type="datetime-local" {...form.register('matchDate')} />
          </Field>
          <Field
            error={form.formState.errors.confirmationDeadline?.message}
            label="Prazo de confirmação"
          >
            <input
              className="form-input"
              type="datetime-local"
              {...form.register('confirmationDeadline')}
            />
          </Field>
          <Field error={form.formState.errors.locationName?.message} label="Local">
            <input className="form-input" {...form.register('locationName')} />
          </Field>
          <Field error={form.formState.errors.competitionName?.message} label="Campeonato">
            <input className="form-input" {...form.register('competitionName')} />
          </Field>
          <div className="flex flex-wrap gap-3 sm:col-span-2 sm:justify-end">
            {match?.status === 'SCHEDULED' ? (
              <button
                className="min-h-12 rounded-xl border border-destructive px-5 font-bold text-destructive"
                onClick={() => cancel.mutate()}
                type="button"
              >
                Cancelar partida
              </button>
            ) : null}
            {match?.status === 'CANCELLED' ? (
              <button
                className="min-h-12 rounded-xl border px-5 font-bold text-primary"
                onClick={() => reactivate.mutate()}
                type="button"
              >
                Reativar partida
              </button>
            ) : null}
            <button
              className="min-h-12 rounded-xl bg-primary px-6 font-bold text-primary-foreground disabled:opacity-60"
              disabled={save.isPending}
              type="submit"
            >
              Salvar partida
            </button>
          </div>
        </form>
      </OnlineActionGuard>
      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {mapToAppError(error).message}
        </p>
      ) : null}
      <p aria-live="polite" className="mt-3 text-sm font-semibold">
        {feedback}
      </p>
    </section>
  );
}

function Field({
  children,
  error,
  label,
}: {
  children: React.ReactNode;
  error: string | undefined;
  label: string;
}) {
  return (
    <label className="font-semibold">
      {label}
      {children}
      <span className="mt-1 block min-h-5 text-sm text-destructive" role="alert">
        {error}
      </span>
    </label>
  );
}
