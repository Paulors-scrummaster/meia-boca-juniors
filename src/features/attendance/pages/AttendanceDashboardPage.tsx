import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  attendanceKeys,
  createAttendanceService,
  type AttendanceService,
  type PresenceStatus,
  type PresenceSummary,
} from '@/features/attendance/api/attendance.service';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { useOnlineMutation } from '@/shared/hooks/use-online-mutation';
import { mapToAppError } from '@/shared/lib/app-error';
import { formatSaoPauloDateTime } from '@/shared/lib/date-time';
import { domainLabels } from '@/shared/lib/domain-labels';

interface AttendanceDashboardPageProps {
  matchId: string;
  service?: AttendanceService;
}

export function AttendanceDashboardPage({
  matchId,
  service = createAttendanceService(),
}: AttendanceDashboardPageProps) {
  const query = useQuery({
    queryFn: () => service.listStaffAttendance(matchId),
    queryKey: attendanceKeys.staff(matchId),
  });

  if (query.isPending) return <LoadingState label="Carregando presenças" />;
  if (query.isError)
    return (
      <ErrorState
        title="Não foi possível carregar as presenças"
        message={mapToAppError(query.error).message}
      />
    );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">
          Comissão técnica
        </p>
        <h1 className="mt-2 text-3xl font-black">Painel de presenças</h1>
        <p className="mt-2 text-muted-foreground">Estados em tempo real e motivos protegidos.</p>
      </header>
      {query.data.length === 0 ? (
        <EmptyState
          title="Nenhum convocado"
          description="Defina a convocação para acompanhar as respostas."
        />
      ) : (
        <ul className="space-y-4">
          {query.data.map((presence) => (
            <li key={presence.presence_id}>
              <AttendanceRow presence={presence} service={service} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AttendanceRow({
  presence,
  service,
}: {
  presence: PresenceSummary;
  service: AttendanceService;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<PresenceStatus>(presence.presence_status);
  const [reason, setReason] = useState(presence.reason ?? '');
  const [explanation, setExplanation] = useState('');
  const [success, setSuccess] = useState<string | null>(null);
  const mutation = useOnlineMutation<PresenceSummary, Error, void>({
    mutationFn: () =>
      service.adminSetPresence({
        athleteId: presence.athlete_id,
        explanation: explanation.trim().replace(/\s+/g, ' '),
        matchId: presence.match_id,
        reason: status === 'DECLINED' ? reason.trim().replace(/\s+/g, ' ') : null,
        status,
      }),
    onSuccess: async () => {
      setSuccess('Presença atualizada.');
      await queryClient.invalidateQueries({ queryKey: attendanceKeys.staff(presence.match_id) });
    },
  });

  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black">{presence.athlete_name}</h2>
          <p className="text-sm text-muted-foreground">
            {presence.applicable_deadline
              ? `Prazo: ${formatSaoPauloDateTime(presence.applicable_deadline)}`
              : 'Sem prazo disponível'}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold">
          {domainLabels.presenceStatus[presence.presence_status]}
        </span>
      </div>
      {presence.reason ? (
        <p className="mt-3 rounded-xl bg-muted p-3 text-sm">
          <strong>Motivo protegido:</strong> {presence.reason}
        </p>
      ) : null}
      <OnlineActionGuard>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="font-semibold">
            Estado de {presence.athlete_name}
            <select
              className="form-input"
              onChange={(event) => setStatus(event.target.value as PresenceStatus)}
              value={status}
            >
              {Object.entries(domainLabels.presenceStatus).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="font-semibold">
            Explicação da alteração de {presence.athlete_name}
            <input
              className="form-input"
              onChange={(event) => setExplanation(event.target.value)}
              value={explanation}
            />
          </label>
          {status === 'DECLINED' ? (
            <label className="font-semibold md:col-span-2">
              Motivo da recusa de {presence.athlete_name}
              <textarea
                className="form-input"
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
            </label>
          ) : null}
        </div>
        <button
          className="mt-4 min-h-12 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
          disabled={
            mutation.isPending ||
            explanation.trim().length < 2 ||
            (status === 'DECLINED' && reason.trim().length === 0)
          }
          onClick={() => mutation.mutate()}
          type="button"
        >
          Salvar presença de {presence.athlete_name}
        </button>
      </OnlineActionGuard>
      {mutation.isError ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {mapToAppError(mutation.error).message}
        </p>
      ) : null}
      <p aria-live="polite" className="mt-2 text-sm font-semibold">
        {success}
      </p>
    </article>
  );
}
