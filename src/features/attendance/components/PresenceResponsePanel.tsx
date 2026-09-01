import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useState } from 'react';

import {
  attendanceKeys,
  createAttendanceService,
  type AttendanceService,
  type PresenceSummary,
} from '@/features/attendance/api/attendance.service';
import { RefusalReasonModal } from '@/features/attendance/components/RefusalReasonModal';
import { useRefusalModalStore } from '@/features/attendance/stores/refusal-modal.store';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { useOnlineMutation } from '@/shared/hooks/use-online-mutation';
import { useConnectivity } from '@/shared/hooks/use-connectivity';
import { mapToAppError } from '@/shared/lib/app-error';
import { formatSaoPauloDateTime } from '@/shared/lib/date-time';
import { domainLabels } from '@/shared/lib/domain-labels';

interface PresenceResponsePanelProps {
  matchId: string;
  service?: AttendanceService;
}

export function PresenceResponsePanel({
  matchId,
  service = createAttendanceService(),
}: PresenceResponsePanelProps) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryFn: () => service.getMyPresence(matchId),
    queryKey: attendanceKeys.mine(matchId),
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());
  const connectivity = useConnectivity();
  const refusal = useRefusalModalStore();
  const mutation = useOnlineMutation<
    PresenceSummary,
    Error,
    { reason: string | null; status: 'CONFIRMED' | 'DECLINED' }
  >({
    mutationFn: (input) => service.respondToCall({ matchId, ...input }),
    onSuccess: (result) => {
      queryClient.setQueryData(
        attendanceKeys.mine(matchId),
        (current: PresenceSummary | null | undefined) => ({
          ...(current ?? result),
          ...result,
        }),
      );
      setFeedback('Resposta registrada.');
      refusal.close();
    },
  });

  if (query.isPending) return <LoadingState label="Carregando sua convocação" />;
  if (query.isError)
    return (
      <ErrorState
        title="Não foi possível carregar sua presença"
        message={mapToAppError(query.error).message}
      />
    );
  if (!query.data || query.data.call_status !== 'CALLED') {
    return (
      <EmptyState title="Sem convocação" description="Você não está convocado para esta partida." />
    );
  }

  const presence = query.data;
  const deadlineClosed =
    !presence.applicable_deadline || renderedAt >= new Date(presence.applicable_deadline).getTime();

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">Sua convocação</p>
      <h2 className="mt-2 text-2xl font-black">
        {domainLabels.presenceStatus[presence.presence_status]}
      </h2>
      <p className="mt-2 text-muted-foreground">
        Prazo para responder:{' '}
        <strong>
          {presence.applicable_deadline
            ? formatSaoPauloDateTime(presence.applicable_deadline)
            : 'indisponível'}
        </strong>
      </p>
      {presence.is_exceptional_call ? (
        <p className="mt-2 rounded-xl bg-muted p-3 text-sm font-semibold">
          Convocação excepcional com prazo individual.
        </p>
      ) : null}
      {deadlineClosed ? (
        <p className="mt-3 text-sm font-semibold text-destructive" role="status">
          O prazo para responder foi encerrado.
        </p>
      ) : null}
      <OnlineActionGuard explanation="Reconecte-se à internet para responder à convocação.">
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
            disabled={!connectivity.isOnline || deadlineClosed || mutation.isPending}
            onClick={() => mutation.mutate({ reason: null, status: 'CONFIRMED' })}
            type="button"
          >
            <Check aria-hidden="true" className="h-5 w-5" /> Confirmar presença
          </button>
          <button
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-destructive px-5 font-bold text-destructive disabled:opacity-60"
            disabled={!connectivity.isOnline || deadlineClosed || mutation.isPending}
            onClick={() => refusal.open(presence.presence_id)}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" /> Recusar presença
          </button>
        </div>
      </OnlineActionGuard>
      {mutation.isError ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {mapToAppError(mutation.error).message}
        </p>
      ) : null}
      <p aria-live="polite" className="mt-3 text-sm font-semibold">
        {feedback}
      </p>
      <RefusalReasonModal
        busy={mutation.isPending}
        onClose={refusal.close}
        onSubmit={(reason) =>
          mutation.mutateAsync({ reason, status: 'DECLINED' }).then(() => undefined)
        }
        open={refusal.presenceId === presence.presence_id}
        presenceId={presence.presence_id}
      />
    </section>
  );
}
