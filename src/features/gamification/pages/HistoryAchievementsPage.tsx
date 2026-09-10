// Feature 003 · US4 (UX & Gamificação) · T092
// Aba "Histórico & Conquistas" (FR-024): retrospecto do clube de todos os tempos
// + galeria de troféus conquistados em todas as temporadas.

import type { GamificationService } from '@/features/gamification/api/gamification.service';
import {
  useAwardedTrophies,
  useClubRecord,
} from '@/features/gamification/queries/gamification.queries';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';
import { formatSaoPauloDate } from '@/shared/lib/date-time';

interface HistoryAchievementsPageProps {
  service?: GamificationService;
}

export function HistoryAchievementsPage({ service }: HistoryAchievementsPageProps) {
  const record = useClubRecord(service);
  const trophies = useAwardedTrophies(service);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-black text-foreground">Histórico &amp; Conquistas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O retrospecto do Meia Boca Juniors e todos os troféus já conquistados pelo elenco.
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold text-foreground">Retrospecto do clube</h2>
        {record.isPending ? (
          <LoadingState label="Carregando retrospecto" />
        ) : record.isError ? (
          <ErrorState
            message={mapToAppError(record.error).message}
            onRetry={() => void record.refetch()}
          />
        ) : (
          <dl className="mt-4 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
            <Stat label="Jogos" value={record.data.matchesPlayed} />
            <Stat label="Vitórias" value={record.data.wins} tone="text-success" />
            <Stat label="Empates" value={record.data.draws} />
            <Stat label="Derrotas" value={record.data.losses} tone="text-destructive" />
            <Stat label="Gols pró" value={record.data.goalsFor} />
            <Stat label="Gols contra" value={record.data.goalsAgainst} />
            <Stat
              label="Saldo"
              value={
                record.data.goalDiff > 0 ? `+${record.data.goalDiff}` : String(record.data.goalDiff)
              }
            />
          </dl>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold text-foreground">Galeria de troféus</h2>
        {trophies.isPending ? (
          <LoadingState label="Carregando troféus" />
        ) : trophies.isError ? (
          <ErrorState
            message={mapToAppError(trophies.error).message}
            onRetry={() => void trophies.refetch()}
          />
        ) : trophies.data.length === 0 ? (
          <EmptyState
            title="Nenhum troféu ainda"
            description="Os troféus aparecem aqui assim que forem conquistados."
          />
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {trophies.data.map((trophy) => (
              <li
                className="flex items-center justify-between gap-3 py-3 text-sm"
                key={`${trophy.athleteId}-${trophy.trophyCode}-${trophy.seasonId}`}
              >
                <span className="font-semibold text-foreground">
                  {trophy.titlePt}
                  <span className="ml-2 font-normal text-muted-foreground">
                    #{trophy.shirtNumber} {trophy.shirtName}
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Temporada {trophy.seasonYear} · {formatSaoPauloDate(trophy.awardedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, tone, value }: { label: string; tone?: string; value: number | string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={`font-mono text-2xl font-black tabular-nums ${tone ?? 'text-foreground'}`}>
        {value}
      </dd>
    </div>
  );
}
