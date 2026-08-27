import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { PresenceResponsePanel } from '@/features/attendance/components/PresenceResponsePanel';
import { useAttendanceRealtime } from '@/features/attendance/hooks/use-attendance-realtime';
import {
  createMatchesService,
  matchKeys,
  type MatchesService,
} from '@/features/matches/api/matches.service';
import { ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';
import { formatSaoPauloDateTime } from '@/shared/lib/date-time';
import { domainLabels } from '@/shared/lib/domain-labels';

interface MatchDetailPageProps {
  canManage?: boolean;
  isAthlete?: boolean;
  matchId: string;
  service?: MatchesService;
}

export function MatchDetailPage({
  canManage = false,
  isAthlete = false,
  matchId,
  service = createMatchesService(),
}: MatchDetailPageProps) {
  const query = useQuery({
    queryFn: () => service.getMatch(matchId),
    queryKey: matchKeys.detail(matchId),
  });
  useAttendanceRealtime(matchId, canManage || isAthlete);
  if (query.isPending) return <LoadingState label="Carregando partida" />;
  if (query.isError)
    return (
      <ErrorState
        title="Não foi possível carregar a partida"
        message={mapToAppError(query.error).message}
      />
    );
  const match = query.data;
  return (
    <div className="space-y-6">
      <article className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-primary">Partida</p>
            <h1 className="mt-2 text-3xl font-black">MBJ × {match.opponent_name}</h1>
          </div>
          <span className="rounded-full bg-muted px-4 py-2 text-sm font-black">
            {domainLabels.matchStatus[match.status]}
          </span>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <Detail label="Data e hora" value={formatSaoPauloDateTime(match.match_date)} />
          <Detail label="Prazo geral" value={formatSaoPauloDateTime(match.confirmation_deadline)} />
          <Detail label="Local" value={match.location_name ?? 'A definir'} />
          <Detail label="Campeonato" value={match.competition_name ?? 'Não informado'} />
        </dl>
        {canManage ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="min-h-11 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground"
              to={`/app/staff/matches/${match.id}/attendance`}
            >
              Painel de presenças
            </Link>
            <Link
              className="min-h-11 rounded-xl border px-4 py-3 font-bold text-primary"
              to={`/app/staff/matches/${match.id}/edit`}
            >
              Editar partida
            </Link>
          </div>
        ) : null}
      </article>
      {isAthlete ? <PresenceResponsePanel matchId={match.id} /> : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
