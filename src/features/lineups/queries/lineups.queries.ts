import { queryOptions } from '@tanstack/react-query';

import { createLineupsService, type LineupsService } from '@/features/lineups/api/lineups.service';

export const lineupKeys = {
  all: ['lineups'] as const,
  editor: (matchId: string) => ['lineups', 'editor', matchId] as const,
  published: (matchId: string) => ['lineups', 'published', matchId] as const,
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
  matchId: string,
  service: LineupsService = createLineupsService(),
) {
  return queryOptions({
    queryFn: () => service.getPublished(matchId),
    queryKey: lineupKeys.published(matchId),
  });
}
