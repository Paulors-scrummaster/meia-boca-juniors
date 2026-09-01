import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  createMatchesService,
  matchKeys,
  type MatchesService,
} from '@/features/matches/api/matches.service';
import {
  createStatisticsService,
  statisticsKeys,
  type StatisticsService,
} from '@/features/statistics/api/statistics.service';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';
import { formatSaoPauloDateTime } from '@/shared/lib/date-time';

interface SeasonRankingsPageProps {
  matchesService?: MatchesService;
  service?: StatisticsService;
}

export function SeasonRankingsPage({
  matchesService = createMatchesService(),
  service = createStatisticsService(),
}: SeasonRankingsPageProps) {
  const [selectedSeasonId, setSelectedSeasonId] = useState('');
  const seasons = useQuery({
    queryFn: () => matchesService.listSeasons(),
    queryKey: matchKeys.seasons(),
  });
  const matches = useQuery({
    queryFn: () => matchesService.listMatches(),
    queryKey: matchKeys.list(),
  });
  const currentSeason =
    seasons.data?.find((season) => season.id === selectedSeasonId) ??
    seasons.data?.find((season) => season.is_active) ??
    seasons.data?.[0];
  const rankings = useQuery({
    enabled: Boolean(currentSeason?.id),
    queryFn: () => service.getSeasonRankings(currentSeason!.id),
    queryKey: currentSeason
      ? statisticsKeys.rankings(currentSeason.id)
      : [...statisticsKeys.all, 'rankings', 'none'],
  });

  if (seasons.isPending || matches.isPending)
    return <LoadingState label="Carregando rankings e histórico" />;
  if (seasons.isError || matches.isError) {
    return (
      <ErrorState
        title="Não foi possível carregar as estatísticas"
        message={mapToAppError(seasons.error ?? matches.error).message}
      />
    );
  }
  if (!currentSeason) {
    return (
      <EmptyState
        title="Nenhuma temporada cadastrada"
        description="Os rankings aparecerão após a criação de uma temporada."
      />
    );
  }

  const seasonMatches = matches.data.filter((match) => match.season_id === currentSeason.id);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">
            História oficial
          </p>
          <h1 className="mt-2 text-3xl font-black">Rankings da temporada {currentSeason.year}</h1>
          <p className="mt-2 text-muted-foreground">
            Somente consolidações válidas entram nos totais; revisões corrigidas permanecem no
            histórico oficial.
          </p>
        </div>
        <label className="font-semibold" htmlFor="statistics-season">
          Temporada
          <select
            className="form-input min-w-40"
            id="statistics-season"
            onChange={(event) => setSelectedSeasonId(event.target.value)}
            value={currentSeason.id}
          >
            {seasons.data.map((season) => (
              <option key={season.id} value={season.id}>
                {season.year}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section aria-labelledby="ranking-table-title" className="rounded-3xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <Trophy aria-hidden="true" className="h-7 w-7 text-primary" />
          <h2 className="text-xl font-black" id="ranking-table-title">
            Desempenho dos atletas
          </h2>
        </div>
        {rankings.isPending ? <LoadingState label="Carregando ranking" /> : null}
        {rankings.isError ? (
          <ErrorState
            title="Não foi possível carregar o ranking"
            message={mapToAppError(rankings.error).message}
            onRetry={() => void rankings.refetch()}
          />
        ) : null}
        {rankings.data?.length === 0 ? (
          <EmptyState
            title="Ainda não há estatísticas oficiais"
            description="Partidas não consolidadas não entram no ranking."
          />
        ) : null}
        {rankings.data && rankings.data.length > 0 ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[38rem] text-left">
              <caption className="sr-only">
                Gols, assistências, presenças e prêmios por atleta
              </caption>
              <thead>
                <tr className="border-b text-sm text-muted-foreground">
                  <th className="px-3 py-3" scope="col">
                    Atleta
                  </th>
                  <th className="px-3 py-3" scope="col">
                    Gols
                  </th>
                  <th className="px-3 py-3" scope="col">
                    Assistências
                  </th>
                  <th className="px-3 py-3" scope="col">
                    Presenças
                  </th>
                  <th className="px-3 py-3" scope="col">
                    Craque
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankings.data.map((ranking) => (
                  <tr className="border-b last:border-0" key={ranking.athlete_id}>
                    <th className="px-3 py-4 font-black" scope="row">
                      {ranking.shirt_name} · #{ranking.shirt_number}
                    </th>
                    <td className="px-3 py-4">{ranking.goals ?? 0}</td>
                    <td className="px-3 py-4">{ranking.assists ?? 0}</td>
                    <td className="px-3 py-4">{ranking.presences ?? 0}</td>
                    <td className="px-3 py-4">{ranking.mvp_awards ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="statistics-match-history" className="space-y-4">
        <h2 className="text-2xl font-black" id="statistics-match-history">
          Histórico de partidas
        </h2>
        {seasonMatches.length === 0 ? (
          <EmptyState title="Nenhuma partida nesta temporada" />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {seasonMatches.map((match) => (
              <li className="rounded-2xl border bg-card p-5" key={match.id}>
                <h3 className="font-black">MBJ × {match.opponent_name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatSaoPauloDateTime(match.match_date)}
                </p>
                <p className="mt-2 text-sm">
                  {match.current_consolidation_id
                    ? 'Resultado oficial consolidado'
                    : 'Sem consolidação oficial válida'}
                </p>
                <Link
                  className="mt-3 inline-flex min-h-11 items-center font-bold text-primary"
                  to={`/app/matches/${match.id}`}
                >
                  Consultar partida
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
