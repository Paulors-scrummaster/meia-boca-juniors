import { Link } from 'react-router-dom';

import {
  createSocialEventsService,
  type SocialEventsService,
} from '@/features/social-events/api/social-events.service';
import { EventForm } from '@/features/social-events/components/EventForm';
import { useSocialEvents } from '@/features/social-events/queries/social-events.queries';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';
import { formatSaoPauloDateTime } from '@/shared/lib/date-time';

interface SocialEventsListPageProps {
  canManage?: boolean;
  service?: SocialEventsService;
}

export function SocialEventsListPage({
  canManage = false,
  service = createSocialEventsService(),
}: SocialEventsListPageProps) {
  const events = useSocialEvents(service);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-black text-foreground">Resenhas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Churrascos e resenhas pós-jogo, com confirmação de presença e rateio dos custos.
        </p>
      </header>

      {canManage ? (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="font-bold text-foreground">Novo evento</h2>
          <div className="mt-3">
            <EventForm onCreated={() => void events.refetch()} service={service} />
          </div>
        </section>
      ) : null}

      {events.isPending ? (
        <LoadingState label="Carregando eventos" />
      ) : events.isError ? (
        <ErrorState
          message={mapToAppError(events.error).message}
          onRetry={() => void events.refetch()}
        />
      ) : (events.data?.length ?? 0) === 0 ? (
        <EmptyState title="Nenhum evento" description="Ainda não há resenhas cadastradas." />
      ) : (
        <ul className="space-y-3">
          {events.data?.map((event) => (
            <li key={event.id} className="rounded-xl border bg-card p-5">
              <Link className="block" to={`/app/resenhas/${event.id}`}>
                <p className="font-bold text-primary">{event.title}</p>
                <p className="text-sm text-muted-foreground">
                  {formatSaoPauloDateTime(event.event_at)} · {event.location_name} ·{' '}
                  {event.status === 'OPEN' ? 'Aberto' : 'Fechado'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
