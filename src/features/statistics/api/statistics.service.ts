import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/shared/adapters/supabase/client';
import { AppError } from '@/shared/lib/app-error';
import type { Database, Json } from '@/shared/types/database.generated';

export type SeasonRanking = Database['public']['Views']['season_rankings_view']['Row'];

export interface GoalContributionInput {
  assistantAthleteId: string | null;
  isOpponentOwnGoal: boolean;
  scorerAthleteId: string | null;
  sequence: number;
}

export interface ConsolidateMatchInput {
  goals: GoalContributionInput[];
  idempotencyKey?: string;
  matchId: string;
  mbjScore: number;
  opponentScore: number;
}

export interface ConsolidationResult {
  closesAt: string;
  consolidationId: string;
  lineupId: string;
  matchId: string;
  notificationEventId: string;
  opensAt: string;
  revision: number;
  votingRoundId: string;
}

export interface ReopenResult {
  invalidatedConsolidationId: string;
  invalidatedVotingRoundId: string;
  matchId: string;
  reopenedAt: string;
}

export interface StatisticsService {
  consolidate(input: ConsolidateMatchInput): Promise<ConsolidationResult>;
  getSeasonRankings(seasonId: string): Promise<SeasonRanking[]>;
  reopen(input: {
    explanation: string;
    idempotencyKey?: string;
    matchId: string;
  }): Promise<ReopenResult>;
}

export const statisticsKeys = {
  all: ['statistics'] as const,
  rankings: (seasonId: string) => ['statistics', 'rankings', seasonId] as const,
};

export function mapStatisticsError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (!error || typeof error !== 'object') return new AppError('INTERNAL_ERROR');
  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';
  if (message === 'MFA_REQUIRED') return new AppError('MFA_REQUIRED');
  if (message === 'MATCH_LOCKED') return new AppError('MATCH_LOCKED');
  if (message === 'DEADLINE_CLOSED') return new AppError('DEADLINE_CLOSED');
  if (code === '42501') return new AppError('FORBIDDEN');
  if (code === 'P0002') return new AppError('NOT_FOUND');
  if (code === '23505') return new AppError('CONFLICT');
  if (['22023', '22P02', '23514'].includes(code)) return new AppError('VALIDATION_ERROR');
  return new AppError('INTERNAL_ERROR');
}

export function requireStatisticsObject<T>(data: Json | null, error: unknown): T {
  if (error) throw mapStatisticsError(error);
  if (!data || Array.isArray(data) || typeof data !== 'object')
    throw new AppError('INTERNAL_ERROR');
  return data as T;
}

export function createStatisticsService(
  client: SupabaseClient<Database> = supabase,
): StatisticsService {
  return {
    async consolidate(input) {
      const { data, error } = await client.rpc('consolidate_match', {
        command_idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
        goals_input: input.goals as unknown as Json,
        match_uuid: input.matchId,
        mbj_score_input: input.mbjScore,
        opponent_score_input: input.opponentScore,
      });
      return requireStatisticsObject<ConsolidationResult>(data, error);
    },
    async getSeasonRankings(seasonId) {
      const { data, error } = await client
        .from('season_rankings_view')
        .select('*')
        .eq('season_id', seasonId)
        .order('goals', { ascending: false })
        .order('assists', { ascending: false })
        .order('shirt_number');
      if (error) throw mapStatisticsError(error);
      return data ?? [];
    },
    async reopen(input) {
      const { data, error } = await client.rpc('reopen_match_statistics', {
        command_idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
        correction_explanation: input.explanation,
        match_uuid: input.matchId,
      });
      return requireStatisticsObject<ReopenResult>(data, error);
    },
  };
}
