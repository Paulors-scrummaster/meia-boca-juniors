import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  attendanceKeys,
  createAttendanceService,
  type AttendanceService,
} from '@/features/attendance/api/attendance.service';
import { createRosterService, type RosterService } from '@/features/roster/api/roster.service';
import { rosterKeys } from '@/features/roster/queries/roster.queries';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { ErrorState, LoadingState } from '@/shared/components/feedback';
import { useOnlineMutation } from '@/shared/hooks/use-online-mutation';
import { mapToAppError } from '@/shared/lib/app-error';
import { saoPauloLocalToUtcIso } from '@/shared/lib/date-time';

interface CallUpManagerProps {
  attendanceService?: AttendanceService;
  matchId: string;
  rosterService?: RosterService;
}

export function CallUpManager({
  attendanceService = createAttendanceService(),
  matchId,
  rosterService = createRosterService(),
}: CallUpManagerProps) {
  const queryClient = useQueryClient();
  const roster = useQuery({
    queryFn: () => rosterService.listAthletes(),
    queryKey: rosterKeys.list(),
  });
  const attendance = useQuery({
    queryFn: () => attendanceService.listStaffAttendance(matchId),
    queryKey: attendanceKeys.staff(matchId),
  });
  const [selectedOverride, setSelectedOverride] = useState<string[] | null>(null);
  const [exceptionalAthlete, setExceptionalAthlete] = useState('');
  const [exceptionalDeadline, setExceptionalDeadline] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const selected =
    selectedOverride ??
    attendance.data
      ?.filter((item) => item.call_status === 'CALLED')
      .map((item) => item.athlete_id) ??
    [];
  const save = useOnlineMutation({
    mutationFn: () => attendanceService.setMatchCallups(matchId, selected),
    onSuccess: async () => {
      setFeedback('Convocação atualizada.');
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.staff(matchId) });
    },
  });
  const exceptional = useOnlineMutation({
    mutationFn: () =>
      attendanceService.createExceptionalCall({
        athleteId: exceptionalAthlete,
        deadline: saoPauloLocalToUtcIso(exceptionalDeadline),
        matchId,
      }),
    onSuccess: async () => {
      setFeedback('Convocação excepcional criada.');
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.staff(matchId) });
    },
  });
  if (roster.isPending || attendance.isPending)
    return <LoadingState label="Carregando convocação" />;
  if (roster.isError || attendance.isError)
    return (
      <ErrorState
        title="Não foi possível carregar a convocação"
        message={mapToAppError(roster.error ?? attendance.error).message}
      />
    );
  const eligible = roster.data.filter(
    (athlete) => athlete.status !== 'INACTIVE' && athlete.user_id,
  );
  return (
    <section className="rounded-3xl border bg-card p-6 shadow-sm">
      <h2 className="text-2xl font-black">Convocação</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Lesionados e suspensos podem ser convocados, mas não escalados.
      </p>
      <OnlineActionGuard>
        <fieldset className="mt-5 grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 font-bold">Atletas convocados</legend>
          {eligible.map((athlete) => (
            <label
              className="flex min-h-12 items-center gap-3 rounded-xl border px-4"
              key={athlete.id}
            >
              <input
                checked={selected.includes(athlete.id)}
                onChange={(event) =>
                  setSelectedOverride(
                    event.target.checked
                      ? [...selected, athlete.id]
                      : selected.filter((id) => id !== athlete.id),
                  )
                }
                type="checkbox"
              />{' '}
              <span>{athlete.full_name}</span>
            </label>
          ))}
        </fieldset>
        <button
          className="mt-4 min-h-12 rounded-xl bg-primary px-5 font-bold text-primary-foreground"
          onClick={() => save.mutate()}
          type="button"
        >
          Salvar convocação
        </button>
        <div className="mt-7 grid gap-3 border-t pt-5 sm:grid-cols-2">
          <label className="font-semibold">
            Atleta da convocação excepcional
            <select
              className="form-input"
              onChange={(event) => setExceptionalAthlete(event.target.value)}
              value={exceptionalAthlete}
            >
              <option value="">Selecione</option>
              {eligible.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="font-semibold">
            Prazo individual
            <input
              className="form-input"
              onChange={(event) => setExceptionalDeadline(event.target.value)}
              type="datetime-local"
              value={exceptionalDeadline}
            />
          </label>
          <button
            className="min-h-12 rounded-xl border px-5 font-bold text-primary sm:col-span-2"
            disabled={!exceptionalAthlete || !exceptionalDeadline}
            onClick={() => exceptional.mutate()}
            type="button"
          >
            Criar convocação excepcional
          </button>
        </div>
      </OnlineActionGuard>
      {save.isError || exceptional.isError ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {mapToAppError(save.error ?? exceptional.error).message}
        </p>
      ) : null}
      <p aria-live="polite" className="mt-3 text-sm font-semibold">
        {feedback}
      </p>
    </section>
  );
}
