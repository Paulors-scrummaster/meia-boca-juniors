import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  createSocialEventsService,
  type SocialEventsService,
} from '@/features/social-events/api/social-events.service';
import { PresenceControl } from '@/features/social-events/components/PresenceControl';
import {
  useCloseEvent,
  useEventParticipants,
  useEventSplit,
  useSocialEvent,
} from '@/features/social-events/queries/social-events.queries';
import { formatBrl } from '@/features/finance/lib/currency';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';
import { formatSaoPauloDateTime } from '@/shared/lib/date-time';

interface SocialEventDetailPageProps {
  canManage?: boolean;
  eventId?: string;
  isAthlete?: boolean;
  service?: SocialEventsService;
}

export function SocialEventDetailPage({
  canManage = false,
  eventId,
  isAthlete = false,
  service = createSocialEventsService(),
}: SocialEventDetailPageProps) {
  const params = useParams();
  const id = eventId ?? params.eventId ?? '';
  const event = useSocialEvent(id, service);
  const split = useEventSplit(id, service);
  const participants = useEventParticipants(id, service);
  const close = useCloseEvent(id, service);
  const [closeError, setCloseError] = useState<string | null>(null);

  if (event.isPending) return <LoadingState label="Carregando evento" />;
  if (event.isError)
    return (
      <ErrorState
        message={mapToAppError(event.error).message}
        onRetry={() => void event.refetch()}
      />
    );
  if (!event.data) return <EmptyState title="Evento não encontrado" />;

  const ev = event.data;
  const isOpen = ev.status === 'OPEN';

  return (
    <div className="space-y-5">
      <Link
        className="inline-flex min-h-11 items-center font-semibold text-primary"
        to="/app/resenhas"
      >
        ← Voltar às resenhas
      </Link>

      <header className="rounded-xl border bg-card p-5">
        <h1 className="text-xl font-black text-foreground">{ev.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatSaoPauloDateTime(ev.event_at)} · {ev.location_name}
        </p>
        <p className="mt-2 text-sm text-foreground">
          Custo total {formatBrl(ev.total_cost)} ·{' '}
          <span className="font-semibold">{isOpen ? 'Aberto' : 'Fechado'}</span>
        </p>
      </header>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-bold text-foreground">Rateio</h2>
        {split.isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">Calculando…</p>
        ) : split.data?.splitUnavailable ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Rateio indisponível — ninguém confirmou presença ainda.
          </p>
        ) : (
          <p className="mt-2 text-lg font-black text-foreground">
            {formatBrl(split.data?.costPerPerson ?? 0)}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              por pessoa · {split.data?.peopleCount ?? 0} confirmada(s)
            </span>
          </p>
        )}

        {canManage && isOpen ? (
          <div className="mt-4">
            <button
              className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60"
              disabled={close.isPending}
              onClick={() => {
                setCloseError(null);
                close.mutate(undefined, {
                  onError: (error) => setCloseError(mapToAppError(error).message),
                });
              }}
              type="button"
            >
              Fechar Evento &amp; Consolidar Rateio
            </button>
            {closeError ? <p className="mt-2 text-sm text-destructive">{closeError}</p> : null}
          </div>
        ) : null}
      </section>

      {isAthlete && isOpen ? <PresenceControl eventId={id} service={service} /> : null}

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-bold text-foreground">Participantes</h2>
        <ul className="mt-2 divide-y divide-border">
          {(participants.data ?? []).map((participant) => (
            <li
              key={participant.athleteId}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="text-foreground">
                {participant.shirtName}
                {participant.status === 'CONFIRMED' && participant.guestsCount > 0
                  ? ` +${participant.guestsCount}`
                  : ''}
              </span>
              <span className="text-muted-foreground">
                {participant.status === 'CONFIRMED'
                  ? participant.share != null
                    ? formatBrl(participant.share)
                    : 'Confirmado'
                  : 'Recusou'}
              </span>
            </li>
          ))}
          {(participants.data ?? []).length === 0 ? (
            <li className="py-2 text-sm text-muted-foreground">Ninguém respondeu ainda.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
