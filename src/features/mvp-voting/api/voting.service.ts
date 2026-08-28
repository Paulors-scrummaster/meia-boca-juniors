import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/shared/adapters/supabase/client';
import { AppError } from '@/shared/lib/app-error';
import type { Database } from '@/shared/types/database.generated';
import {
  mapStatisticsError,
  requireStatisticsObject,
} from '@/features/statistics/api/statistics.service';

export type VotingCandidate = Database['public']['Views']['open_mvp_voting_view']['Row'];

export interface CastVoteResult {
  createdAt: string;
  voteId: string;
  votingRoundId: string;
}

export interface CloseVotingResult {
  status: 'CLOSED';
  topVoteCount?: number;
  votingRoundId: string;
  winnerCount: number;
}

export interface VotingService {
  castVote(input: {
    candidateAthleteId: string;
    idempotencyKey?: string;
    votingRoundId: string;
  }): Promise<CastVoteResult>;
  close(votingRoundId: string): Promise<CloseVotingResult>;
  getOpenRound(): Promise<VotingCandidate[]>;
}

export const votingKeys = {
  all: ['mvp-voting'] as const,
  openRound: ['mvp-voting', 'open-round'] as const,
};

export function createVotingService(client: SupabaseClient<Database> = supabase): VotingService {
  return {
    async castVote(input) {
      const { data, error } = await client.rpc('cast_mvp_vote', {
        candidate_athlete_uuid: input.candidateAthleteId,
        command_idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
        voting_round_uuid: input.votingRoundId,
      });
      return requireStatisticsObject<CastVoteResult>(data, error);
    },
    async close(votingRoundId) {
      const { data, error } = await client.rpc('close_mvp_voting', {
        voting_round_uuid: votingRoundId,
      });
      return requireStatisticsObject<CloseVotingResult>(data, error);
    },
    async getOpenRound() {
      const { data, error } = await client
        .from('open_mvp_voting_view')
        .select('*')
        .order('assignment')
        .order('shirt_number');
      if (error) throw mapStatisticsError(error);
      if (!data) throw new AppError('INTERNAL_ERROR');
      return data;
    },
  };
}
