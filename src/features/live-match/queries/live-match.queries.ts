// Feature 003 · US3 (Súmula Live) · T067
// Hooks TanStack para a súmula ao vivo. `useLiveSumulaFeed` assina Supabase
// Realtime (Postgres Changes em `live_match_events`, filtro `match_id`) e
// revalida a lista a cada INSERT/UPDATE — a virada de `undone` some da tela
// porque `listEvents` já filtra `undone=false` (R7, FR-031, SC-003).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createLiveMatchService,
  liveMatchKeys,
  type LiveMatchService,
  type LogLiveEventInput,
} from '@/features/live-match/api/live-match.service';
import {
  createOfflineQueue,
  type EnqueueInput,
  type OfflineQueue,
  type PendingLiveEvent,
} from '@/features/live-match/lib/offline-queue';
import { useAuth } from '@/app/providers/AuthProvider';
import { supabase } from '@/shared/adapters/supabase/client';
import { AppError } from '@/shared/lib/app-error';
import { registerOfflineCleanup } from '@/shared/lib/offline-cache';

const defaultService = createLiveMatchService();

export function useLiveMatchSetup(matchId: string, service: LiveMatchService = defaultService) {
  return useQuery({
    enabled: matchId.length > 0,
    queryFn: () => service.getSetup(matchId),
    queryKey: liveMatchKeys.setup(matchId),
  });
}

export function useLiveRoster(service: LiveMatchService = defaultService) {
  return useQuery({ queryFn: () => service.listRoster(), queryKey: liveMatchKeys.roster() });
}

export function useLiveSumulaFeed(matchId: string, service: LiveMatchService = defaultService) {
  const queryClient = useQueryClient();
  const query = useQuery({
    enabled: matchId.length > 0,
    queryFn: () => service.listEvents(matchId),
    queryKey: liveMatchKeys.feed(matchId),
  });

  useEffect(() => {
    if (!matchId) return;
    const channel = supabase
      .channel(`live-sumula:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          filter: `match_id=eq.${matchId}`,
          schema: 'public',
          table: 'live_match_events',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: liveMatchKeys.feed(matchId) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [matchId, queryClient]);

  return query;
}

function useFeedInvalidation(matchId: string) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: liveMatchKeys.feed(matchId) });
    void queryClient.invalidateQueries({ queryKey: liveMatchKeys.setup(matchId) });
  }, [matchId, queryClient]);
}

/**
 * Fila offline desta partida + auto-drain no `online`. `pendingCount` alimenta o
 * gate de finalização (a UI só habilita "Finalizar" com a fila vazia — R8).
 */
export function useLiveOfflineQueue(matchId: string, service: LiveMatchService = defaultService) {
  const invalidate = useFeedInvalidation(matchId);
  const queue: OfflineQueue = useMemo(
    () => createOfflineQueue({ dbName: `mbj-live-sumula:${matchId}` }),
    [matchId],
  );
  const [pendingCount, setPendingCount] = useState(0);

  // T098: o buffer offline da súmula (só UUIDs + enums, sem PII) é limpo no
  // logout / troca de conta, junto do cache de query persistido.
  const userId = useAuth().user?.id ?? '';
  useEffect(() => {
    if (!userId) return;
    return registerOfflineCleanup(userId, () => queue.clear());
  }, [queue, userId]);

  const refreshCount = useCallback(() => {
    void queue.count().then(setPendingCount);
  }, [queue]);

  const send = useCallback(
    async (event: PendingLiveEvent) => {
      await service.logEvent({
        athleteId: event.athleteId,
        clientEventId: event.clientEventId,
        eventType: event.eventType,
        matchId: event.matchId,
        minute: event.minute,
        targetAthleteId: event.targetAthleteId,
        teamSide: event.teamSide,
      });
    },
    [service],
  );

  useEffect(() => {
    refreshCount();
    if (typeof window === 'undefined') return;
    const handler = () => {
      void (async () => {
        const result = await queue.drain(send);
        refreshCount();
        if (result.sent > 0) invalidate();
      })();
    };
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, [invalidate, queue, refreshCount, send]);

  const enqueue = useCallback(
    async (event: EnqueueInput) => {
      await queue.enqueue(event);
      refreshCount();
    },
    [queue, refreshCount],
  );

  const drainNow = useCallback(async () => {
    const result = await queue.drain(send);
    refreshCount();
    if (result.sent > 0) invalidate();
    return result;
  }, [queue, send, refreshCount, invalidate]);

  return { drainNow, enqueue, pendingCount, queue, refreshCount };
}

export function useLogLiveEvent(matchId: string, service: LiveMatchService = defaultService) {
  const invalidate = useFeedInvalidation(matchId);
  return useMutation({
    // A súmula precisa responder ao clique mesmo sem rede — a falha vira enfileiramento
    // offline no chamador (R8), então não deixamos o react-query pausar a mutação.
    mutationFn: (input: LogLiveEventInput) => service.logEvent(input),
    networkMode: 'always',
    onSuccess: invalidate,
  });
}

export function useUndoLiveEvent(matchId: string, service: LiveMatchService = defaultService) {
  const invalidate = useFeedInvalidation(matchId);
  return useMutation({
    mutationFn: () => service.undoEvent(matchId),
    onSuccess: invalidate,
  });
}

export function useAmendLiveEvent(matchId: string, service: LiveMatchService = defaultService) {
  const invalidate = useFeedInvalidation(matchId);
  return useMutation({
    mutationFn: (input: Parameters<LiveMatchService['amendEvent']>[0]) => service.amendEvent(input),
    onSuccess: invalidate,
  });
}

export function useEnableLiveRecording(
  matchId: string,
  service: LiveMatchService = defaultService,
) {
  const invalidate = useFeedInvalidation(matchId);
  return useMutation({
    mutationFn: (input: Parameters<LiveMatchService['enableRecording']>[0]) =>
      service.enableRecording(input),
    onSuccess: invalidate,
  });
}

export function useAssignFieldRecorder(
  matchId: string,
  service: LiveMatchService = defaultService,
) {
  const invalidate = useFeedInvalidation(matchId);
  return useMutation({
    mutationFn: (recorderUserId: string) => service.assignRecorder({ matchId, recorderUserId }),
    onSuccess: invalidate,
  });
}

export function useEndLiveRecording(matchId: string, service: LiveMatchService = defaultService) {
  const invalidate = useFeedInvalidation(matchId);
  return useMutation({
    mutationFn: () => service.endRecording(matchId),
    onSuccess: invalidate,
  });
}

export function useCancelLiveRecording(
  matchId: string,
  service: LiveMatchService = defaultService,
) {
  const invalidate = useFeedInvalidation(matchId);
  return useMutation({
    mutationFn: (reason?: string) => service.cancelRecording({ matchId, reason }),
    onSuccess: invalidate,
  });
}

export function useFinalizeSumula(
  matchId: string,
  pendingCount: number,
  service: LiveMatchService = defaultService,
) {
  const invalidate = useFeedInvalidation(matchId);
  return useMutation({
    mutationFn: () => {
      if (pendingCount > 0) return Promise.reject(new AppError('CONFLICT'));
      return service.finalize({ matchId, pendingOfflineEvents: pendingCount });
    },
    onSuccess: invalidate,
  });
}
