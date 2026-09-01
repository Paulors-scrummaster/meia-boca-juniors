import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/app/providers/AuthProvider';
import { createLineupsService, type LineupsService } from '@/features/lineups/api/lineups.service';
import { PublishedLineup } from '@/features/lineups/components/PublishedLineup';
import { publishedLineupOptions } from '@/features/lineups/queries/lineups.queries';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';

export function PublishedLineupPage({
  matchId,
  service = createLineupsService(),
}: {
  matchId: string;
  service?: LineupsService;
}) {
  const { user } = useAuth();
  const query = useQuery(publishedLineupOptions(user?.id ?? '', matchId, service));
  if (query.isPending) return <LoadingState label="Carregando escalação oficial" />;
  if (query.isError)
    return (
      <ErrorState
        title="Não foi possível carregar a escalação"
        message={mapToAppError(query.error).message}
      />
    );
  if (!query.data)
    return (
      <EmptyState
        title="Escalação ainda não publicada"
        description="A comissão técnica ainda não publicou a versão oficial desta partida."
      />
    );
  return (
    <PublishedLineup
      lineup={{
        formation_code: query.data.lineup.formationCode,
        lineup_id: `offline:${query.data.matchId}:${query.data.lineup.revision}`,
        match_id: query.data.matchId,
        players: [
          ...query.data.lineup.starters.map((player, displayOrder) => ({
            assignment: 'STARTER' as const,
            athlete_id: player.athleteId,
            display_order: displayOrder,
            position_x: player.positionX,
            position_y: player.positionY,
            shirt_name: player.shirtName,
            shirt_number: player.shirtNumber,
            tactical_position: player.tacticalPosition,
          })),
          ...query.data.lineup.reserves.map((player) => ({
            assignment: 'RESERVE' as const,
            athlete_id: player.athleteId,
            display_order: player.displayOrder,
            position_x: null,
            position_y: null,
            shirt_name: player.shirtName,
            shirt_number: player.shirtNumber,
            tactical_position: null,
          })),
        ],
        published_at: query.data.lineup.publishedAt,
        revision: query.data.lineup.revision,
      }}
    />
  );
}
