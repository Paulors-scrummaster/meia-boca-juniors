import { ArrowLeft, History, Pencil } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import type { AuthService } from '@/features/auth/api/auth.service';
import { InvitationManager } from '@/features/auth/components/InvitationManager';
import type { RosterService } from '@/features/roster/api/roster.service';
import { AthleteAvatar } from '@/features/roster/components/AthleteAvatar';
import { useAthlete } from '@/features/roster/queries/roster.queries';
import { ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';
import { formatSaoPauloDate } from '@/shared/lib/date-time';
import { domainLabels } from '@/shared/lib/domain-labels';

interface AthleteProfilePageProps {
  athleteId?: string;
  authService?: AuthService;
  canManage?: boolean;
  service?: RosterService;
}

export function AthleteProfilePage({
  athleteId,
  authService,
  canManage = false,
  service,
}: AthleteProfilePageProps) {
  const params = useParams();
  const id = athleteId ?? params.athleteId ?? '';
  const query = useAthlete(id, service);
  if (query.isPending) return <LoadingState label="Carregando ficha esportiva" />;
  if (query.isError)
    return (
      <ErrorState
        title="Ficha não encontrada"
        message={mapToAppError(query.error).message}
        onRetry={() => void query.refetch()}
      />
    );
  const athlete = query.data;

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary"
        to="/app/roster"
      >
        <ArrowLeft aria-hidden="true" className="h-5 w-5" /> Voltar ao elenco
      </Link>
      <section className="rounded-3xl border bg-card p-6 shadow-lg sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <AthleteAvatar
            className="h-24 w-24 text-2xl"
            name={athlete.full_name}
            url={athlete.avatar_url}
          />
          <div className="flex-1">
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">
              {domainLabels.athleteStatus[athlete.status]}
            </span>
            <h1 className="mt-3 text-3xl font-black">{athlete.full_name}</h1>
            <p className="mt-1 text-lg text-muted-foreground">
              {athlete.shirt_name} · #{athlete.shirt_number}
            </p>
            <p className="mt-1 font-semibold">{athlete.primary_position}</p>
          </div>
          {canManage && !athlete.anonymized_at ? (
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground"
              to={`/app/admin/roster/${athlete.id}/edit`}
            >
              <Pencil aria-hidden="true" className="h-5 w-5" /> Editar perfil
            </Link>
          ) : null}
        </div>
      </section>

      {canManage && !athlete.anonymized_at && !athlete.user_id ? (
        <InvitationManager
          athleteId={athlete.id}
          {...(authService ? { service: authService } : {})}
        />
      ) : null}

      <section aria-labelledby="history-title" className="rounded-3xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <History aria-hidden="true" className="h-7 w-7 text-primary" />
          <h2 className="text-xl font-black" id="history-title">
            Histórico esportivo preservado
          </h2>
        </div>
        <p className="mt-3 text-muted-foreground">
          Este identificador permanece ligado às partidas e estatísticas oficiais, inclusive após
          inativação ou anonimização.
        </p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">No elenco desde</dt>
            <dd className="font-bold">{formatSaoPauloDate(athlete.created_at)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Inativação</dt>
            <dd className="font-bold">
              {athlete.inactivated_at
                ? formatSaoPauloDate(athlete.inactivated_at)
                : 'Não inativado'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Privacidade</dt>
            <dd className="font-bold">
              {athlete.anonymized_at ? 'Dados anonimizados' : 'Perfil identificado'}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
