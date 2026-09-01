import { useQuery } from '@tanstack/react-query';
import { BellRing, CalendarCheck, Vote } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  createNotificationsService,
  notificationKeys,
  type NotificationsService,
} from '@/features/notifications/api/notifications.service';
import { formatSaoPauloDateTime } from '@/shared/lib/date-time';

interface PendingActionsBannerProps {
  service?: NotificationsService;
}

export function PendingActionsBanner({
  service = createNotificationsService(),
}: PendingActionsBannerProps) {
  const pending = useQuery({
    queryFn: () => service.getPendingActions(),
    queryKey: notificationKeys.pendingActions(),
    refetchOnWindowFocus: true,
  });

  if (pending.isPending || pending.isError || (!pending.data?.presence && !pending.data?.voting)) {
    return null;
  }

  return (
    <section
      aria-label="Ações pendentes"
      className="mb-6 rounded-2xl border border-secondary bg-card p-4 shadow-sm"
      role="region"
    >
      <div className="flex items-start gap-3">
        <BellRing aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="font-black">Você tem ações pendentes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Este lembrete dentro do aplicativo funciona independentemente da permissão de push.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {pending.data.presence ? (
              <li className="rounded-xl bg-muted p-4">
                <p className="flex items-center gap-2 font-bold">
                  <CalendarCheck aria-hidden="true" className="h-5 w-5" /> Confirme sua presença
                </p>
                {pending.data.presence.applicableDeadline ? (
                  <p className="mt-1 text-sm">
                    Prazo: {formatSaoPauloDateTime(pending.data.presence.applicableDeadline)}
                  </p>
                ) : null}
                <Link
                  className="mt-3 inline-flex min-h-11 items-center font-bold text-primary"
                  to={`/app/athlete/matches/${pending.data.presence.matchId}/attendance`}
                >
                  Responder convocação
                </Link>
              </li>
            ) : null}
            {pending.data.voting ? (
              <li className="rounded-xl bg-muted p-4">
                <p className="flex items-center gap-2 font-bold">
                  <Vote aria-hidden="true" className="h-5 w-5" /> Vote no Craque do Jogo
                </p>
                <p className="mt-1 text-sm">
                  Encerra em {formatSaoPauloDateTime(pending.data.voting.closesAt)}
                </p>
                <Link
                  className="mt-3 inline-flex min-h-11 items-center font-bold text-primary"
                  to="/app/athlete/mvp-voting"
                >
                  Abrir votação
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </section>
  );
}
