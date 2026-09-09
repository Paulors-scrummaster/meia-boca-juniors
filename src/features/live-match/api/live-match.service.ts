// Feature 003 · US3 (Súmula Live) · T066
// Wrappers das RPCs da súmula (`contracts/live-match.md`). O `client_event_id` é
// gerado aqui quando o chamador não fornece um — o reenvio offline reusa o mesmo
// id para cair no `on conflict do nothing` do servidor (dedupe, FR-037a).

import type { SupabaseClient } from '@supabase/supabase-js';

import type { LiveEventType, TeamSide } from '@/features/live-match/lib/offline-queue';
import { supabase } from '@/shared/adapters/supabase/client';
import { isConnectivityFailure } from '@/shared/hooks/use-connectivity';
import { AppError } from '@/shared/lib/app-error';
import type { Database, Json } from '@/shared/types/database.generated';

export type LiveMatchSetup = Database['public']['Tables']['live_match_setups']['Row'];
export type LiveMatchEvent = Database['public']['Tables']['live_match_events']['Row'];

export interface LogLiveEventInput {
  athleteId: string;
  clientEventId?: string;
  eventType: LiveEventType;
  matchId: string;
  minute: number;
  targetAthleteId?: string | null;
  teamSide?: TeamSide;
}

export interface LoggedLiveEvent {
  clientEventId: string;
  deduped: boolean;
  eventId: string;
  eventType: string;
  minute: number;
}

export interface UndoneLiveEvent {
  clientEventId: string;
  eventId: string;
  eventType: string;
  minute: number;
}

export interface FinalizeResult {
  consolidationId: string;
  matchId: string;
  mbjScore: number;
  opponentScore: number;
  revision: number;
  trophiesAwarded: { athleteId: string; trophyCode: string }[];
}

export interface LiveMatchService {
  amendEvent(input: {
    athleteId?: string;
    eventId: string;
    minute?: number;
    targetAthleteId?: string | null;
  }): Promise<void>;
  assignRecorder(input: { matchId: string; recorderUserId: string }): Promise<void>;
  cancelRecording(input: { matchId: string; reason?: string | undefined }): Promise<void>;
  enableRecording(input: {
    matchId: string;
    recorderUserId: string;
    startingGoalkeeperAthleteId: string;
  }): Promise<void>;
  endRecording(matchId: string): Promise<void>;
  finalize(input: { matchId: string; pendingOfflineEvents: number }): Promise<FinalizeResult>;
  getSetup(matchId: string): Promise<LiveMatchSetup | null>;
  listEvents(matchId: string): Promise<LiveMatchEvent[]>;
  logEvent(input: LogLiveEventInput): Promise<LoggedLiveEvent>;
  undoEvent(matchId: string): Promise<UndoneLiveEvent>;
}

export const liveMatchKeys = {
  all: ['live-match'] as const,
  feed: (matchId: string) => ['live-match', 'feed', matchId] as const,
  setup: (matchId: string) => ['live-match', 'setup', matchId] as const,
};

const CONFLICT_MESSAGES = new Set([
  'RECORDER_ONLY',
  'LIVE_NOT_ENABLED',
  'SUMULA_NOT_IN_REVIEW',
  'PENDING_OFFLINE_EVENTS',
  'UNDO_WINDOW_EXPIRED',
  'LIVE_NOT_RECORDING',
  'CONFLICT',
]);

export function mapLiveError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (isConnectivityFailure(error)) return new AppError('OFFLINE');
  if (!error || typeof error !== 'object') return new AppError('INTERNAL_ERROR');
  const code = 'code' in error ? String((error as { code: unknown }).code) : '';
  const message = 'message' in error ? String((error as { message: unknown }).message) : '';
  if (message === 'MFA_REQUIRED') return new AppError('MFA_REQUIRED');
  if (message === 'MATCH_LOCKED') return new AppError('MATCH_LOCKED');
  if (CONFLICT_MESSAGES.has(message)) return new AppError('CONFLICT');
  if (message === 'PUBLISHED_LINEUP_REQUIRED' || message === 'ATHLETE_NOT_IN_CONSOLIDATED_LINEUP') {
    return new AppError('VALIDATION_ERROR');
  }
  if (code === '42501') return new AppError('FORBIDDEN');
  if (code === 'P0002') return new AppError('NOT_FOUND');
  if (['22023', '22P02', '23514', '23505'].includes(code)) return new AppError('VALIDATION_ERROR');
  return new AppError('INTERNAL_ERROR');
}

const newId = () => globalThis.crypto.randomUUID();

export function createLiveMatchService(
  client: SupabaseClient<Database> = supabase,
): LiveMatchService {
  async function rpc(fn: Parameters<typeof client.rpc>[0], args: Record<string, unknown>) {
    const { data, error } = await client.rpc(fn, args as never);
    if (error) throw mapLiveError(error);
    return data as Json;
  }

  return {
    async amendEvent(input) {
      const patch: Record<string, unknown> = {};
      if (input.minute !== undefined) patch.minute = input.minute;
      if (input.athleteId !== undefined) patch.athlete_id = input.athleteId;
      if (input.targetAthleteId !== undefined) patch.target_athlete_id = input.targetAthleteId;
      await rpc('amend_live_event', {
        event_id: input.eventId,
        idempotency_key: newId(),
        patch,
      });
    },
    async assignRecorder(input) {
      await rpc('assign_field_recorder', {
        idempotency_key: newId(),
        match_id: input.matchId,
        recorder_user_id: input.recorderUserId,
      });
    },
    async cancelRecording(input) {
      await rpc('cancel_live_recording', {
        idempotency_key: newId(),
        match_id: input.matchId,
        reason: input.reason ?? '',
      });
    },
    async enableRecording(input) {
      await rpc('enable_live_recording', {
        idempotency_key: newId(),
        match_id: input.matchId,
        recorder_user_id: input.recorderUserId,
        starting_goalkeeper_athlete_id: input.startingGoalkeeperAthleteId,
      });
    },
    async endRecording(matchId) {
      await rpc('end_live_recording', { idempotency_key: newId(), match_id: matchId });
    },
    async finalize(input) {
      const data = (await rpc('finalize_sumula', {
        idempotency_key: newId(),
        match_id: input.matchId,
        reviewed_payload: { pendingOfflineEvents: input.pendingOfflineEvents },
      })) as {
        consolidationId: string;
        mbjScore: number;
        opponentScore: number;
        revision: number;
        trophiesAwarded?: { athleteId: string; trophyCode: string }[];
      };
      return {
        consolidationId: data.consolidationId,
        matchId: input.matchId,
        mbjScore: data.mbjScore,
        opponentScore: data.opponentScore,
        revision: data.revision,
        trophiesAwarded: data.trophiesAwarded ?? [],
      };
    },
    async getSetup(matchId) {
      const { data, error } = await client
        .from('live_match_setups')
        .select('*')
        .eq('match_id', matchId)
        .maybeSingle();
      if (error) throw mapLiveError(error);
      return data;
    },
    async listEvents(matchId) {
      const { data, error } = await client
        .from('live_match_events')
        .select('*')
        .eq('match_id', matchId)
        .eq('undone', false)
        .order('minute', { ascending: true })
        .order('recorded_at', { ascending: true });
      if (error) throw mapLiveError(error);
      return data ?? [];
    },
    async logEvent(input) {
      const clientEventId = input.clientEventId ?? newId();
      const data = (await rpc('log_live_event', {
        athlete_id: input.athleteId,
        client_event_id: clientEventId,
        event_type: input.eventType,
        idempotency_key: newId(),
        match_id: input.matchId,
        minute: input.minute,
        target_athlete_id: input.targetAthleteId ?? null,
        team_side: input.teamSide ?? 'MBJ',
      })) as { clientEventId: string; deduped: boolean; eventId: string; eventType: string; minute: number };
      return {
        clientEventId: data.clientEventId,
        deduped: data.deduped,
        eventId: data.eventId,
        eventType: data.eventType,
        minute: data.minute,
      };
    },
    async undoEvent(matchId) {
      const data = (await rpc('undo_live_event', {
        idempotency_key: newId(),
        match_id: matchId,
      })) as { clientEventId: string; eventId: string; eventType: string; minute: number };
      return {
        clientEventId: data.clientEventId,
        eventId: data.eventId,
        eventType: data.eventType,
        minute: data.minute,
      };
    },
  };
}
