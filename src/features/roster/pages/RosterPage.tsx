import { Search, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type { RosterService } from '@/features/roster/api/roster.service';
import { AthleteAvatar } from '@/features/roster/components/AthleteAvatar';
import { useRoster } from '@/features/roster/queries/roster.queries';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';
import { domainLabels } from '@/shared/lib/domain-labels';

interface RosterPageProps {
  canManage?: boolean;
  service?: RosterService;
}

export function RosterPage({ canManage = false, service }: RosterPageProps) {
  const query = useRoster(service);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const athletes = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    return (query.data ?? []).filter((athlete) => {
      const matchesStatus = status === 'ALL' || athlete.status === status;
      const haystack =
        `${athlete.full_name} ${athlete.shirt_name} ${athlete.shirt_number} ${athlete.primary_position}`.toLocaleLowerCase(
          'pt-BR',
        );
      return matchesStatus && (!normalizedSearch || haystack.includes(normalizedSearch));
    });
  }, [query.data, search, status]);

  if (query.isPending) return <LoadingState label="Carregando elenco" />;
  if (query.isError)
    return (
      <ErrorState
        title="Não foi possível carregar o elenco"
        message={mapToAppError(query.error).message}
        onRetry={() => void query.refetch()}
      />
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">
            Meia Boca Juniors
          </p>
          <h1 className="mt-2 text-3xl font-black">Elenco</h1>
          <p className="mt-2 text-muted-foreground">
            Perfis esportivos atuais e histórico preservado.
          </p>
        </div>
        {canManage ? (
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground"
            to="/app/admin/roster/new"
          >
            <UserPlus aria-hidden="true" className="h-5 w-5" /> Cadastrar atleta
          </Link>
        ) : null}
      </header>

      <section
        aria-label="Filtros do elenco"
        className="grid gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-[1fr_13rem]"
      >
        <label className="relative font-semibold">
          Buscar atleta
          <Search
            aria-hidden="true"
            className="absolute bottom-3 left-3 h-5 w-5 text-muted-foreground"
          />
          <input
            className="form-input pl-10"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, número ou posição"
            value={search}
          />
        </label>
        <label className="font-semibold">
          Filtrar por estado
          <select
            className="form-input"
            onChange={(event) => setStatus(event.target.value)}
            value={status}
          >
            <option value="ALL">Todos</option>
            {Object.entries(domainLabels.athleteStatus).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {athletes.length === 0 ? (
        <EmptyState
          title="Nenhum atleta encontrado"
          description="Ajuste os filtros ou cadastre um novo integrante."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {athletes.map((athlete) => (
            <li className="rounded-2xl border bg-card p-5 shadow-sm" key={athlete.id}>
              <div className="flex items-start gap-4">
                <AthleteAvatar name={athlete.full_name} url={athlete.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{athlete.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    #{athlete.shirt_number} · {athlete.primary_position}
                  </p>
                  <span className="mt-2 inline-flex rounded-full bg-muted px-3 py-1 text-xs font-bold">
                    {domainLabels.athleteStatus[athlete.status]}
                  </span>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  aria-label={`Ver perfil de ${athlete.full_name}`}
                  className="min-h-11 flex-1 rounded-lg border px-3 py-2 text-center font-semibold text-primary"
                  to={`/app/roster/${athlete.id}`}
                >
                  Ver perfil
                </Link>
                {canManage && !athlete.anonymized_at ? (
                  <Link
                    aria-label={`Editar ${athlete.full_name}`}
                    className="min-h-11 flex-1 rounded-lg bg-primary px-3 py-2 text-center font-semibold text-primary-foreground"
                    to={`/app/admin/roster/${athlete.id}/edit`}
                  >
                    Editar
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
