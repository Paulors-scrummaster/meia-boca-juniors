import { queryOptions } from '@tanstack/react-query';

import {
  createMatchesService,
  type MatchesService,
  type NextMatchRow,
} from '@/features/matches/api/matches.service';
import { offlineNextMatchSchema, type OfflineNextMatch } from '@/shared/types/offline-cache';

function toOfflineNextMatch(row: NextMatchRow | null): OfflineNextMatch | null {
  if (
    !row?.id ||
    !row.opponent_name ||
    !row.match_date ||
    row.status !== 'SCHEDULED' ||
    !row.call_status
  ) {
    return null;
  }

  return offlineNextMatchSchema.parse({
    cachedAt: new Date().toISOString(),
    match: {
      competitionName: row.competition_name,
      id: row.id,
      locationName: row.location_name,
      matchDate: row.match_date,
      opponentName: row.opponent_name,
      status: row.status,
    },
    myCall: {
      applicableDeadline: row.applicable_deadline,
      callStatus: row.call_status,
      presenceStatus: row.presence_status,
    },
    schemaVersion: 1,
  });
}

export const offlineMatchKeys = {
  next: (userId: string) => ['offline', userId, 'next-match'] as const,
};

export function offlineNextMatchOptions(
  userId: string,
  service: MatchesService = createMatchesService(),
) {
  return queryOptions({
    gcTime: 24 * 60 * 60 * 1000,
    meta: { persistOffline: 'next-match' as const },
    queryFn: async () => toOfflineNextMatch(await service.getNextMatch()),
    queryKey: offlineMatchKeys.next(userId),
  });
}
