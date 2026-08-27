import { useQuery } from '@tanstack/react-query';

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
  const query = useQuery(publishedLineupOptions(matchId, service));
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
  return <PublishedLineup lineup={query.data} />;
}
