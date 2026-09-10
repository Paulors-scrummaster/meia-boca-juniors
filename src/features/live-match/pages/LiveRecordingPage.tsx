// Feature 003 · US3 (Súmula Live) · T071
// Container da súmula ao vivo em `/app/partidas/:matchId/sumula`. Ramifica pela
// situação do setup: RECORDING → cronômetro + ações; IN_REVIEW → revisão;
// FINALIZED/CANCELLED → resumo. A tela só existe quando há setup (FR-029).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  createLiveMatchService,
  type LiveMatchService,
} from '@/features/live-match/api/live-match.service';
import { QuickActions, type QuickActionInput } from '@/features/live-match/components/QuickActions';
import { SpectatorFeed } from '@/features/live-match/components/SpectatorFeed';
import { Stopwatch } from '@/features/live-match/components/Stopwatch';
import { UndoButton } from '@/features/live-match/components/UndoButton';
import { SumulaReviewPage } from '@/features/live-match/pages/SumulaReviewPage';
import {
  currentMinute,
  initialMatchClock,
  pauseClock,
  resumeClock,
  startClock,
  stopClock,
  type MatchClockState,
} from '@/features/live-match/lib/match-clock';
import {
  useEndLiveRecording,
  useLiveMatchSetup,
  useLiveOfflineQueue,
  useLiveRoster,
  useLogLiveEvent,
  useUndoLiveEvent,
} from '@/features/live-match/queries/live-match.queries';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { AppError, mapToAppError } from '@/shared/lib/app-error';

interface LiveRecordingPageProps {
  canManage?: boolean;
  currentUserId?: string;
  matchId: string;
  service?: LiveMatchService | undefined;
}

export function LiveRecordingPage({
  canManage = false,
  currentUserId = '',
  matchId,
  service = createLiveMatchService(),
}: LiveRecordingPageProps) {
  const svc = useMemo(() => service, [service]);
  const setup = useLiveMatchSetup(matchId, svc);
  const roster = useLiveRoster(svc);
  const logEvent = useLogLiveEvent(matchId, svc);
  const undoEvent = useUndoLiveEvent(matchId, svc);
  const endRecording = useEndLiveRecording(matchId, svc);
  const { enqueue, pendingCount } = useLiveOfflineQueue(matchId, svc);

  const [clock, setClock] = useState<MatchClockState>(initialMatchClock);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [lastEventAtMs, setLastEventAtMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tick.current = setInterval(() => setNowMs(Date.now()), 500);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, []);

  if (setup.isPending) return <LoadingState label="Carregando súmula" />;
  if (setup.isError)
    return (
      <ErrorState
        message={mapToAppError(setup.error).message}
        onRetry={() => void setup.refetch()}
      />
    );
  if (!setup.data)
    return (
      <EmptyState
        title="Registro ao vivo não habilitado"
        description="A comissão técnica ainda não ligou a súmula digital para esta partida."
      />
    );

  const backLink = (
    <Link
      className="inline-flex min-h-11 items-center font-semibold text-primary"
      to={`/app/matches/${matchId}`}
    >
      ← Voltar à partida
    </Link>
  );

  if (setup.data.status === 'IN_REVIEW') {
    return (
      <div className="space-y-4">
        {backLink}
        <SumulaReviewPage
          canFinalize={canManage}
          matchId={matchId}
          pendingCount={pendingCount}
          service={svc}
        />
      </div>
    );
  }

  if (setup.data.status !== 'RECORDING') {
    return (
      <div className="space-y-4">
        {backLink}
        <EmptyState
          title={setup.data.status === 'FINALIZED' ? 'Súmula finalizada' : 'Registro cancelado'}
          description="Não há mais ações disponíveis nesta súmula."
        />
      </div>
    );
  }

  const isRecorder = currentUserId !== '' && setup.data.recorder_user_id === currentUserId;
  if (!canManage && !isRecorder) {
    return (
      <div className="space-y-4">
        {backLink}
        <EmptyState
          title="Você não é o Registrador desta partida"
          description="Somente o Registrador designado ou a comissão técnica pode registrar eventos."
        />
      </div>
    );
  }

  const minute = currentMinute(clock, nowMs);
  const clockIdle = clock.phase === 'IDLE';

  function bufferOffline(input: QuickActionInput, clientEventId: string) {
    void enqueue({
      athleteId: input.athleteId,
      clientEventId,
      createdAtMs: Date.now(),
      eventType: input.eventType,
      matchId,
      minute: input.minute,
      targetAthleteId: input.targetAthleteId,
      teamSide: input.teamSide,
    });
    setLastEventAtMs(Date.now());
  }

  function handleLog(input: QuickActionInput) {
    setError(null);
    const clientEventId = globalThis.crypto.randomUUID();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      bufferOffline(input, clientEventId);
      return;
    }

    logEvent.mutate(
      { ...input, clientEventId, matchId },
      {
        onError: (logError) => {
          if (logError instanceof AppError && logError.code === 'OFFLINE') {
            bufferOffline(input, clientEventId);
            return;
          }
          setError(mapToAppError(logError).message);
        },
        onSuccess: () => setLastEventAtMs(Date.now()),
      },
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {backLink}

      <header className="rounded-2xl border bg-card p-5">
        <h1 className="text-xl font-black text-foreground">Súmula ao vivo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pendingCount > 0
            ? `${pendingCount} pendência(s) de sincronização`
            : 'Todos os eventos sincronizados'}
        </p>
      </header>

      <Stopwatch
        clock={clock}
        nowMs={nowMs}
        onPause={() => setClock((state) => pauseClock(state, Date.now()))}
        onResume={() => setClock((state) => resumeClock(state, Date.now()))}
        onStart={() => setClock((state) => startClock(state, Date.now()))}
        onStop={() => setClock((state) => stopClock(state, Date.now()))}
      />

      <QuickActions
        athletes={roster.data ?? []}
        disabled={clockIdle}
        minute={minute}
        onLog={handleLog}
      />
      {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}

      <SpectatorFeed matchId={matchId} service={svc} />

      <div className="rounded-2xl border bg-card p-5">
        <button
          className="min-h-11 rounded-lg border border-destructive px-4 font-bold text-destructive disabled:opacity-60"
          disabled={endRecording.isPending}
          onClick={() =>
            endRecording.mutate(undefined, {
              onError: (endError) => setError(mapToAppError(endError).message),
            })
          }
          type="button"
        >
          Encerrar gravação e revisar
        </button>
      </div>

      <UndoButton
        lastEventAtMs={lastEventAtMs}
        nowMs={nowMs}
        onUndo={() =>
          undoEvent.mutate(undefined, {
            onError: (undoError) => setError(mapToAppError(undoError).message),
            onSuccess: () => setLastEventAtMs(null),
          })
        }
        pending={undoEvent.isPending}
      />
    </div>
  );
}
