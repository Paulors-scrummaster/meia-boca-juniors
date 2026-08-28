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

export interface VotingWinner {
  athleteId: string;
  shirtName: string;
  shirtNumber: number;
  voteCount: number;
}

export interface VotingResult {
  closedAt: string;
  matchId: string;
  votingRoundId: string;
  winners: VotingWinner[];
}

export interface VotingService {
  castVote(input: {
    candidateAthleteId: string;
    idempotencyKey?: string;
    votingRoundId: string;
  }): Promise<CastVoteResult>;
  close(votingRoundId: string): Promise<CloseVotingResult>;
  getLatestResult(): Promise<VotingResult | null>;
  getOpenRound(): Promise<VotingCandidate[]>;
}

export const votingKeys = {
  all: ['mvp-voting'] as const,
  latestResult: ['mvp-voting', 'latest-result'] as const,
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
    async getLatestResult() {
      const rounds = await client
        .from('mvp_voting_rounds')
        .select('*')
        .eq('status', 'CLOSED')
        .order('closed_at', { ascending: false })
        .limit(1);
      if (rounds.error) throw mapStatisticsError(rounds.error);
      const round = rounds.data?.[0];
      if (!round?.closed_at) return null;

      const consolidations = await client
        .from('match_consolidations')
        .select('id,match_id,status')
        .eq('id', round.consolidation_id)
        .eq('status', 'VALID')
        .limit(1);
      if (consolidations.error) throw mapStatisticsError(consolidations.error);
      const consolidation = consolidations.data?.[0];
      if (!consolidation) return null;

      const awards = await client
        .from('mvp_awards')
        .select('*')
        .eq('voting_round_id', round.id)
        .is('invalidated_at', null)
        .order('vote_count', { ascending: false });
      if (awards.error) throw mapStatisticsError(awards.error);
      const athleteIds = (awards.data ?? []).map((award) => award.athlete_id);
      if (athleteIds.length === 0) {
        return {
          closedAt: round.closed_at,
          matchId: consolidation.match_id,
          votingRoundId: round.id,
          winners: [],
        };
      }

      const athletes = await client
        .from('athletes')
        .select('id,shirt_name,shirt_number')
        .in('id', athleteIds);
      if (athletes.error) throw mapStatisticsError(athletes.error);
      const athleteById = new Map((athletes.data ?? []).map((athlete) => [athlete.id, athlete]));
      return {
        closedAt: round.closed_at,
        matchId: consolidation.match_id,
        votingRoundId: round.id,
        winners: (awards.data ?? []).flatMap((award) => {
          const athlete = athleteById.get(award.athlete_id);
          return athlete
            ? [
                {
                  athleteId: athlete.id,
                  shirtName: athlete.shirt_name,
                  shirtNumber: athlete.shirt_number,
                  voteCount: award.vote_count,
                },
              ]
            : [];
        }),
      };
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
