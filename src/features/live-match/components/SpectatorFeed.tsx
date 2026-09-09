// Feature 003 · US3 (Súmula Live) · T070
// Feed em tempo real para atletas/torcedores. `useLiveSumulaFeed` assina o
// Realtime; a lista já vem sem eventos desfeitos (FR-031, SC-003, SC-005).

import { useMemo } from 'react';

import type { LiveMatchService } from '@/features/live-match/api/live-match.service';
import { LIVE_EVENT_LABEL, scoreFromEvents } from '@/features/live-match/lib/event-labels';
import { useLiveRoster, useLiveSumulaFeed } from '@/features/live-match/queries/live-match.queries';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';

interface SpectatorFeedProps {
  matchId: string;
  service?: LiveMatchService | undefined;
}

export function SpectatorFeed({ matchId, service }: SpectatorFeedProps) {
  const feed = useLiveSumulaFeed(matchId, service);
  const roster = useLiveRoster(service);

  const nameOf = useMemo(() => {
    const map = new Map((roster.data ?? []).map((a) => [a.id, `#${a.shirtNumber} ${a.shirtName}`]));
    return (athleteId: string | null) => (athleteId ? (map.get(athleteId) ?? '—') : '—');
  }, [roster.data]);

  if (feed.isPending) return <LoadingState label="Carregando súmula ao vivo" />;
  if (feed.isError)
    return (
      <ErrorState message={mapToAppError(feed.error).message} onRetry={() => void feed.refetch()} />
    );

  const events = feed.data ?? [];
  const score = scoreFromEvents(events);

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold text-foreground">Lances</h2>
        <span
          className="font-mono text-2xl font-black tabular-nums text-foreground"
          data-testid="live-score"
        >
          {score.mbj} <span className="text-muted-foreground">×</span> {score.opponent}
        </span>
      </div>

      {events.length === 0 ? (
        <EmptyState title="Sem eventos ainda" description="Os lances aparecem aqui em tempo real." />
      ) : (
        <ol className="mt-3 divide-y divide-border">
          {events.map((event) => (
            <li className="flex items-center gap-3 py-2 text-sm" key={event.id}>
              <span className="w-10 shrink-0 font-black text-primary">{event.minute}&apos;</span>
              <span className="font-semibold text-foreground">{LIVE_EVENT_LABEL[event.event_type]}</span>
              <span className="text-muted-foreground">
                {nameOf(event.athlete_id)}
                {event.team_side === 'OPPONENT' ? ' (adversário)' : ''}
                {event.target_athlete_id ? ` · ${nameOf(event.target_athlete_id)}` : ''}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
