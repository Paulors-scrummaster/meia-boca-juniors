import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/shared/adapters/supabase/client';
import { AppError } from '@/shared/lib/app-error';
import type { Database, Json } from '@/shared/types/database.generated';

export type Match = Database['public']['Tables']['matches']['Row'];
export type Season = Database['public']['Tables']['seasons']['Row'];
export type NextMatchRow = Database['public']['Views']['next_match_view']['Row'];

export interface MatchInput {
  competitionName: string | null;
  confirmationDeadline: string;
  locationName: string | null;
  matchDate: string;
  opponentName: string;
  seasonId: string;
}

export interface RescheduleResult {
  matchId: string;
  notificationEventId: string | null;
  resetCount: number;
  scheduleRevision: number;
}

export interface MatchesService {
  cancelMatch(matchId: string): Promise<Match>;
  createMatch(input: MatchInput): Promise<Match>;
  getMatch(matchId: string): Promise<Match>;
  getNextMatch(): Promise<NextMatchRow | null>;
  listMatches(): Promise<Match[]>;
  listSeasons(): Promise<Season[]>;
  reactivateMatch(matchId: string): Promise<Match>;
  rescheduleMatch(matchId: string, input: Omit<MatchInput, 'seasonId'>): Promise<RescheduleResult>;
}

export const matchKeys = {
  all: ['matches'] as const,
  detail: (matchId: string) => ['matches', 'detail', matchId] as const,
  list: () => ['matches', 'list'] as const,
  seasons: () => ['matches', 'seasons'] as const,
};

function mapMatchError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (!error || typeof error !== 'object') return new AppError('INTERNAL_ERROR');
  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';
  if (message === 'MATCH_LOCKED') return new AppError('MATCH_LOCKED');
  if (message === 'MFA_REQUIRED') return new AppError('MFA_REQUIRED');
  if (code === '42501') return new AppError('FORBIDDEN');
  if (code === 'P0002') return new AppError('NOT_FOUND');
  if (code === '23514' || code === '22023') return new AppError('VALIDATION_ERROR');
  return new AppError('INTERNAL_ERROR');
}

function objectResult<T>(data: Json | null, error: unknown): T {
  if (error) throw mapMatchError(error);
  if (!data || Array.isArray(data) || typeof data !== 'object')
    throw new AppError('INTERNAL_ERROR');
  return data as T;
}

export function createMatchesService(client: SupabaseClient<Database> = supabase): MatchesService {
  return {
    async cancelMatch(matchId) {
      const { data, error } = await client.rpc('cancel_match', {
        command_idempotency_key: crypto.randomUUID(),
        match_uuid: matchId,
      });
      return objectResult<Match>(data, error);
    },
    async createMatch(input) {
      const { data, error } = await client.rpc('create_match', {
        command_idempotency_key: crypto.randomUUID(),
        competition_name_input: input.competitionName as unknown as string,
        confirmation_deadline_input: input.confirmationDeadline,
        location_name_input: input.locationName as unknown as string,
        match_date_input: input.matchDate,
        opponent_name_input: input.opponentName,
        season_uuid: input.seasonId,
      });
      return objectResult<Match>(data, error);
    },
    async getMatch(matchId) {
      const { data, error } = await client
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();
      if (error) throw mapMatchError(error);
      if (!data) throw new AppError('NOT_FOUND');
      return data;
    },
    async getNextMatch() {
      const { data, error } = await client.from('next_match_view').select('*').maybeSingle();
      if (error) throw mapMatchError(error);
      return data;
    },
    async listMatches() {
      const { data, error } = await client
        .from('matches')
        .select('*')
        .order('match_date', { ascending: false });
      if (error) throw mapMatchError(error);
      return data ?? [];
    },
    async listSeasons() {
      const { data, error } = await client
        .from('seasons')
        .select('*')
        .order('year', { ascending: false });
      if (error) throw mapMatchError(error);
      return data ?? [];
    },
    async reactivateMatch(matchId) {
      const { data, error } = await client.rpc('reactivate_match', {
        command_idempotency_key: crypto.randomUUID(),
        match_uuid: matchId,
      });
      return objectResult<Match>(data, error);
    },
    async rescheduleMatch(matchId, input) {
      const { data, error } = await client.rpc('reschedule_match', {
        command_idempotency_key: crypto.randomUUID(),
        competition_name_input: input.competitionName as unknown as string,
        confirmation_deadline_input: input.confirmationDeadline,
        location_name_input: input.locationName as unknown as string,
        match_date_input: input.matchDate,
        match_uuid: matchId,
        opponent_name_input: input.opponentName,
      });
      return objectResult<RescheduleResult>(data, error);
    },
  };
}
