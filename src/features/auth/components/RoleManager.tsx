import { Search, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import { type AuthService } from '@/features/auth/api/auth.service';
import { useEffectiveRoles, useSetRole } from '@/features/auth/queries/roles.queries';
import { ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';
import type { Database } from '@/shared/types/database.generated';

type AppRole = Database['public']['Enums']['app_role'];

const roleLabels: Record<AppRole, string> = {
  ATHLETE: 'Atleta',
  COACH: 'Técnico',
  PRESIDENT: 'Presidente',
};

interface RoleManagerProps {
  service?: AuthService;
  userId: string;
}

export function RoleManager({ service, userId }: RoleManagerProps) {
  const rolesQuery = useEffectiveRoles(userId, service);
  const mutation = useSetRole(userId, service);

  if (rolesQuery.isPending) return <LoadingState label="Carregando papéis" />;
  if (rolesQuery.isError) {
    return (
      <ErrorState
        message={mapToAppError(rolesQuery.error).message}
        onRetry={() => void rolesQuery.refetch()}
        title="Não foi possível carregar os papéis"
      />
    );
  }

  const activeRoles = rolesQuery.data ?? [];

  return (
    <section aria-labelledby="role-manager-title" className="rounded-2xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <ShieldCheck aria-hidden="true" className="h-6 w-6 text-primary" />
        <div>
          <h2 className="font-black" id="role-manager-title">
            Papéis de acesso
          </h2>
          <p className="text-sm text-muted-foreground">
            As permissões efetivas são a união de todos os papéis ativos.
          </p>
        </div>
      </div>

      <fieldset className="mt-5 space-y-3" disabled={mutation.isPending}>
        <legend className="sr-only">Papéis atribuídos</legend>
        {(Object.keys(roleLabels) as AppRole[]).map((role) => {
          const assigned = activeRoles.includes(role);
          return (
            <label
              className="flex min-h-12 cursor-pointer items-center justify-between rounded-xl border px-4"
              key={role}
            >
              <span className="font-semibold">{roleLabels[role]}</span>
              <input
                checked={assigned}
                className="h-5 w-5 accent-primary"
                onChange={() => mutation.mutate({ assigned: !assigned, role })}
                type="checkbox"
              />
            </label>
          );
        })}
      </fieldset>

      <p aria-live="polite" className="mt-4 min-h-6 text-sm">
        {mutation.isPending ? 'Salvando alteração…' : null}
        {mutation.isSuccess ? 'Papéis atualizados com sucesso.' : null}
        {mutation.isError ? mapToAppError(mutation.error).message : null}
      </p>
    </section>
  );
}

export function RoleAdministrationPage() {
  const [draftId, setDraftId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    draftId,
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-black uppercase tracking-[0.18em] text-primary">Administração</p>
        <h1 className="mt-2 text-3xl font-black">Gerenciar acessos</h1>
        <p className="mt-2 text-muted-foreground">
          Consulte o identificador técnico do integrante e atribua somente os papéis necessários.
        </p>
      </header>
      <form
        className="rounded-2xl border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (isUuid) setSelectedId(draftId);
        }}
      >
        <label className="font-semibold" htmlFor="role-user-id">
          Identificador do usuário
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            className="min-h-12 flex-1 rounded-xl border bg-background px-4"
            id="role-user-id"
            onChange={(event) => setDraftId(event.target.value.trim())}
            placeholder="00000000-0000-0000-0000-000000000000"
            value={draftId}
          />
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
            disabled={!isUuid}
            type="submit"
          >
            <Search aria-hidden="true" className="h-5 w-5" /> Consultar
          </button>
        </div>
        {draftId && !isUuid ? (
          <p className="mt-2 text-sm text-destructive">Informe um identificador válido.</p>
        ) : null}
      </form>
      {selectedId ? <RoleManager userId={selectedId} /> : null}
    </div>
  );
}
