import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { createLineupsService, type LineupsService } from '@/features/lineups/api/lineups.service';
import {
  createMatchesService,
  matchKeys,
  type MatchesService,
} from '@/features/matches/api/matches.service';
import {
  ConsolidationForm,
  type ContributionAthlete,
} from '@/features/statistics/components/ConsolidationForm';
import { ReopenMatchDialog } from '@/features/statistics/components/ReopenMatchDialog';
import { ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';

interface StatisticsAdminPageProps {
  lineupsService?: LineupsService;
  matchId: string;
  matchesService?: MatchesService;
}

export function StatisticsAdminPage({
  lineupsService = createLineupsService(),
  matchId,
  matchesService = createMatchesService(),
}: StatisticsAdminPageProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const match = useQuery({
    queryFn: () => matchesService.getMatch(matchId),
    queryKey: matchKeys.detail(matchId),
  });
  const lineup = useQuery({
    enabled: match.data?.current_consolidation_id == null,
    queryFn: () => lineupsService.getPublished(matchId),
    queryKey: ['lineups', 'published', matchId],
  });

  if (match.isPending || (lineup.isPending && !match.data?.current_consolidation_id)) {
    return <LoadingState label="Carregando estatísticas da partida" />;
  }
  if (match.isError || lineup.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar as estatísticas"
        message={mapToAppError(match.error ?? lineup.error).message}
        onRetry={() => {
          void match.refetch();
          void lineup.refetch();
        }}
      />
    );
  }

  const athletes: ContributionAthlete[] = (lineup.data?.players ?? []).map((player) => ({
    id: player.athlete_id,
    shirtName: player.shirt_name,
    shirtNumber: player.shirt_number,
  }));

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">Presidência</p>
        <h1 className="mt-2 text-3xl font-black">Estatísticas oficiais</h1>
        <p className="mt-2 text-muted-foreground">
          Consolide ou corrija o resultado de MBJ × {match.data.opponent_name}.
        </p>
      </header>

      <p aria-live="polite" className="font-semibold" role="status">
        {notice}
      </p>

      {match.data.current_consolidation_id ? (
        <ReopenMatchDialog
          matchId={matchId}
          onReopened={() => {
            setNotice(null);
            void match.refetch().then(() => setNotice('Partida reaberta para correção.'));
          }}
        />
      ) : (
        <ConsolidationForm
          athletes={athletes}
          matchId={matchId}
          onConsolidated={() => {
            setNotice(null);
            void match
              .refetch()
              .then(() => setNotice('Partida consolidada e votação aberta por 24 horas.'));
          }}
        />
      )}
    </div>
  );
}
