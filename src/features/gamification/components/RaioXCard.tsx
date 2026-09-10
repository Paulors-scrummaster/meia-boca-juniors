// Feature 003 · US4 (UX & Gamificação) · T090
// Card "Raio-X": confronto direto contra o adversário de uma partida agendada
// (FR-022/023, SC-010). Estado "sem histórico" quando é o primeiro confronto.

import type { GamificationService } from '@/features/gamification/api/gamification.service';
import { useHeadToHead } from '@/features/gamification/queries/gamification.queries';
import { ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';

interface RaioXCardProps {
  opponentName: string;
  service?: GamificationService | undefined;
}

export function RaioXCard({ opponentName, service }: RaioXCardProps) {
  const query = useHeadToHead(opponentName, service);

  if (query.isPending) return <LoadingState label="Carregando o Raio-X" />;
  if (query.isError)
    return (
      <ErrorState
        message={mapToAppError(query.error).message}
        onRetry={() => void query.refetch()}
      />
    );

  const record = query.data;

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold text-foreground">Raio-X · MBJ × {opponentName}</h2>
        {record.hasHistory ? (
          <span className="text-sm text-muted-foreground">{record.matchesPlayed} confronto(s)</span>
        ) : null}
      </div>

      {record.hasHistory ? (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center sm:grid-cols-4">
            <Stat label="Vitórias" value={record.wins} tone="text-success" />
            <Stat label="Empates" value={record.draws} tone="text-muted-foreground" />
            <Stat label="Derrotas" value={record.losses} tone="text-destructive" />
            <Stat
              label="Saldo de gols"
              value={record.goalDiff > 0 ? `+${record.goalDiff}` : String(record.goalDiff)}
              tone="text-foreground"
            />
          </dl>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Primeiro confronto contra {opponentName} — sem histórico registrado.
        </p>
      )}
    </section>
  );
}

function Stat({ label, tone, value }: { label: string; tone: string; value: number | string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={`font-mono text-2xl font-black tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}
