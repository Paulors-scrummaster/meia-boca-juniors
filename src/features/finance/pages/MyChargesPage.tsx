import {
  createFinanceService,
  type AthleteCharge,
  type FinanceService,
} from '@/features/finance/api/charges.service';
import { DelinquencyBadge } from '@/features/finance/components/DelinquencyBadge';
import { formatBrl, type DelinquencyBadgeValue } from '@/features/finance/lib/currency';
import { useAllCharges } from '@/features/finance/queries/charges.queries';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';
import { formatSaoPauloDate } from '@/shared/lib/date-time';
import type { Database } from '@/shared/types/database.generated';

type ChargeStatus = Database['public']['Enums']['charge_status'];

const STATUS_LABEL: Record<ChargeStatus, string> = {
  CANCELLED: 'Cancelada',
  OVERDUE: 'Em atraso',
  PAID: 'Paga',
  PENDING: 'Pendente',
};

/** Situação de inadimplência derivada das próprias cobranças (nunca bloqueia acesso). */
function badgeFor(charges: AthleteCharge[]): DelinquencyBadgeValue {
  if (charges.some((charge) => charge.status === 'OVERDUE')) return 'OVERDUE';
  if (charges.some((charge) => charge.status === 'PENDING')) return 'PENDING';
  return 'NONE';
}

interface MyChargesPageProps {
  service?: FinanceService;
}

/**
 * Visão do atleta das próprias mensalidades. Somente leitura: a baixa é feita pela
 * diretoria após conferência do comprovante enviado fora do aplicativo (FR-1.4).
 * O RLS de `athlete_charges` já restringe a consulta às cobranças do próprio atleta.
 */
export function MyChargesPage({ service = createFinanceService() }: MyChargesPageProps) {
  const charges = useAllCharges(service);

  if (charges.isPending) return <LoadingState label="Carregando suas mensalidades" />;
  if (charges.isError)
    return (
      <ErrorState
        message={mapToAppError(charges.error).message}
        onRetry={() => void charges.refetch()}
      />
    );

  const rows = charges.data ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-black text-foreground">Minhas mensalidades</h1>
        <DelinquencyBadge value={badgeFor(rows)} />
      </header>
      <p className="text-sm text-muted-foreground">
        A confirmação de pagamento é feita pela diretoria após o comprovante. Uma pendência aqui não
        afeta seu acesso a partidas, escalação ou votação.
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="Nenhuma cobrança"
          description="Você não possui mensalidades registradas."
        />
      ) : (
        <ul className="divide-y divide-border rounded-xl border bg-card">
          {rows.map((charge) => (
            <li key={charge.id} className="flex items-center justify-between gap-3 p-4">
              <span className="text-sm text-foreground">
                {formatBrl(charge.amount)}
                {charge.period ? ` · ${charge.period}` : ''} · vence{' '}
                {formatSaoPauloDate(charge.due_date)}
              </span>
              <span
                className={`text-sm font-semibold ${
                  charge.status === 'OVERDUE'
                    ? 'text-destructive'
                    : charge.status === 'PAID'
                      ? 'text-success'
                      : 'text-muted-foreground'
                }`}
              >
                {STATUS_LABEL[charge.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
