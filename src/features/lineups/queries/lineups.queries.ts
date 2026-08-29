import { queryOptions } from '@tanstack/react-query';

import { createLineupsService, type LineupsService } from '@/features/lineups/api/lineups.service';
import {
  offlinePublishedLineupSchema,
  type OfflinePublishedLineup,
} from '@/shared/types/offline-cache';

export const lineupKeys = {
  all: ['lineups'] as const,
  editor: (matchId: string) => ['lineups', 'editor', matchId] as const,
  published: (matchId: string) => ['lineups', 'published', matchId] as const,
  offlinePublished: (userId: string, matchId: string) =>
    ['offline', userId, 'published-lineup', matchId] as const,
};

export function lineupEditorOptions(
  matchId: string,
  service: LineupsService = createLineupsService(),
) {
  return queryOptions({
    queryFn: () => service.getEditorContext(matchId),
    queryKey: lineupKeys.editor(matchId),
  });
}

export function publishedLineupOptions(
  userId: string,
  matchId: string,
  service: LineupsService = createLineupsService(),
) {
  return queryOptions({
    gcTime: 24 * 60 * 60 * 1000,
    meta: { persistOffline: 'published-lineup' as const },
    queryFn: async (): Promise<OfflinePublishedLineup | null> => {
      const published = await service.getPublished(matchId);
      if (!published) return null;
      return offlinePublishedLineupSchema.parse({
        cachedAt: new Date().toISOString(),
        lineup: {
          formationCode: published.formation_code,
          publishedAt: published.published_at,
          reserves: published.players
            .filter((player) => player.assignment === 'RESERVE')
            .map((player) => ({
              athleteId: player.athlete_id,
              displayOrder: player.display_order,
              shirtName: player.shirt_name,
              shirtNumber: player.shirt_number,
            })),
          revision: published.revision,
          starters: published.players
            .filter(
              (player) =>
                player.assignment === 'STARTER' &&
                player.position_x !== null &&
                player.position_y !== null &&
                player.tactical_position !== null,
            )
            .map((player) => ({
              athleteId: player.athlete_id,
              positionX: player.position_x as number,
              positionY: player.position_y as number,
              shirtName: player.shirt_name,
              shirtNumber: player.shirt_number,
              tacticalPosition: player.tactical_position as string,
            })),
        },
        matchId,
        schemaVersion: 1,
      });
    },
    queryKey: lineupKeys.offlinePublished(userId, matchId),
  });
}
