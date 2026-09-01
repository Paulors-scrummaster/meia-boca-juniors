import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/shared/adapters/supabase/client';
import { mapToAppError } from '@/shared/lib/app-error';
import type { Database } from '@/shared/types/database.generated';

export interface PendingActions {
  presence: {
    applicableDeadline: string | null;
    matchId: string;
  } | null;
  voting: {
    closesAt: string;
    matchId: string;
    votingRoundId: string;
  } | null;
}

export interface NotificationsService {
  getPendingActions(): Promise<PendingActions>;
}

export const notificationKeys = {
  all: ['notifications'] as const,
  pendingActions: () => ['notifications', 'pending-actions'] as const,
};

export function createNotificationsService(
  client: SupabaseClient<Database> = supabase,
): NotificationsService {
  return {
    async getPendingActions() {
      const [matchResult, votingResult] = await Promise.all([
        client
          .from('next_match_view')
          .select('id, presence_status, applicable_deadline')
          .eq('presence_status', 'PENDING')
          .maybeSingle(),
        client
          .from('open_mvp_voting_view')
          .select('voting_round_id, match_id, closes_at, has_voted')
          .eq('has_voted', false)
          .order('closes_at')
          .limit(1)
          .maybeSingle(),
      ]);
      if (matchResult.error) throw mapToAppError(matchResult.error);
      if (votingResult.error) throw mapToAppError(votingResult.error);

      const match = matchResult.data;
      const voting = votingResult.data;
      return {
        presence: match?.id
          ? { applicableDeadline: match.applicable_deadline, matchId: match.id }
          : null,
        voting:
          voting?.voting_round_id && voting.match_id && voting.closes_at
            ? {
                closesAt: voting.closes_at,
                matchId: voting.match_id,
                votingRoundId: voting.voting_round_id,
              }
            : null,
      };
    },
  };
}
