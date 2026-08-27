import { useQuery } from '@tanstack/react-query';
import { CalendarPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

import {
  createMatchesService,
  matchKeys,
  type Match,
  type MatchesService,
} from '@/features/matches/api/matches.service';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';
import { formatSaoPauloDateTime } from '@/shared/lib/date-time';
import { domainLabels } from '@/shared/lib/domain-labels';

interface MatchesPageProps {
  canManage?: boolean;
  service?: MatchesService;
}

export function MatchesPage({
  canManage = false,
  service = createMatchesService(),
}: MatchesPageProps) {
  const query = useQuery({ queryFn: () => service.listMatches(), queryKey: matchKeys.list() });
  const [renderedAt] = useState(() => Date.now());
  if (query.isPending) return <LoadingState label="Carregando partidas" />;
  if (query.isError)
    return (
      <ErrorState
        title="Não foi possível carregar as partidas"
        message={mapToAppError(query.error).message}
      />
    );

  const upcoming = query.data.filter(
    (match) => match.status === 'SCHEDULED' && new Date(match.match_date).getTime() >= renderedAt,
  );
  const history = query.data.filter((match) => !upcoming.includes(match));

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">
            Calendário MBJ
          </p>
          <h1 className="mt-2 text-3xl font-black">Partidas</h1>
          <p className="mt-2 text-muted-foreground">Próximos jogos e histórico por temporada.</p>
        </div>
        {canManage ? (
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground"
            to="/app/staff/matches/new"
          >
            <CalendarPlus aria-hidden="true" className="h-5 w-5" /> Criar partida
          </Link>
        ) : null}
      </header>
      <MatchSection
        empty="Nenhuma partida futura agendada."
        matches={upcoming}
        title="Próximas partidas"
      />
      <MatchSection empty="O histórico ainda está vazio." matches={history} title="Histórico" />
    </div>
  );
}

function MatchSection({
  empty,
  matches,
  title,
}: {
  empty: string;
  matches: Match[];
  title: string;
}) {
  return (
    <section>
      <h2 className="mb-4 text-2xl font-black">{title}</h2>
      {matches.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {matches.map((match) => (
            <li className="rounded-2xl border bg-card p-5 shadow-sm" key={match.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black">MBJ × {match.opponent_name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatSaoPauloDateTime(match.match_date)}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">
                  {domainLabels.matchStatus[match.status]}
                </span>
              </div>
              <p className="mt-3 text-sm">
                {match.competition_name ?? 'Sem campeonato'} ·{' '}
                {match.location_name ?? 'Local a definir'}
              </p>
              <Link
                className="mt-4 inline-flex min-h-11 items-center rounded-lg border px-4 font-bold text-primary"
                to={`/app/matches/${match.id}`}
              >
                Ver detalhes
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
