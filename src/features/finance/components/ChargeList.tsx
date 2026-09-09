import { useState } from 'react';

import type { AthleteCharge, FinanceService } from '@/features/finance/api/charges.service';
import { AdjustAmountDialog } from '@/features/finance/components/AdjustAmountDialog';
import { ChargeReasonDialog } from '@/features/finance/components/ChargeReasonDialog';
import { formatBrl } from '@/features/finance/lib/currency';
import { formatSaoPauloDate } from '@/shared/lib/date-time';
import type { Database } from '@/shared/types/database.generated';

type ChargeStatus = Database['public']['Enums']['charge_status'];

const STATUS_LABEL: Record<ChargeStatus, string> = {
  CANCELLED: 'Cancelada',
  OVERDUE: 'Em atraso',
  PAID: 'Paga',
  PENDING: 'Pendente',
};

type DialogKind = 'adjust' | 'cancel' | 'reverse' | 'settle';

interface ChargeListProps {
  charges: AthleteCharge[];
  onChanged: () => void;
  service: FinanceService;
}

/** Lista de cobranças de um atleta, com as ações de transição da diretoria. */
export function ChargeList({ charges, onChanged, service }: ChargeListProps) {
  const [dialog, setDialog] = useState<{ charge: AthleteCharge; kind: DialogKind } | null>(null);

  if (charges.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">Sem cobranças.</p>;
  }

  const close = () => setDialog(null);

  return (
    <>
      <ul className="divide-y divide-border border-t border-border">
        {charges.map((charge) => (
          <li
            key={charge.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
          >
            <span className="text-foreground">
              {formatBrl(charge.amount)} · vence {formatSaoPauloDate(charge.due_date)} ·{' '}
              <span className="text-muted-foreground">
                {STATUS_LABEL[charge.status]}
                {charge.period ? ` (${charge.period})` : ''}
              </span>
            </span>
            <span className="flex flex-wrap gap-2">
              {(charge.status === 'PENDING' || charge.status === 'OVERDUE') && (
                <>
                  <button
                    className="min-h-9 rounded-lg border border-primary px-3 font-semibold text-primary"
                    onClick={() => setDialog({ charge, kind: 'settle' })}
                    type="button"
                  >
                    Dar baixa
                  </button>
                  <button
                    className="min-h-9 rounded-lg border border-border px-3 font-semibold text-foreground"
                    onClick={() => setDialog({ charge, kind: 'adjust' })}
                    type="button"
                  >
                    Ajustar
                  </button>
                </>
              )}
              {charge.status === 'PAID' && (
                <button
                  className="min-h-9 rounded-lg border border-border px-3 font-semibold text-foreground"
                  onClick={() => setDialog({ charge, kind: 'reverse' })}
                  type="button"
                >
                  Estornar
                </button>
              )}
              {charge.status !== 'CANCELLED' && (
                <button
                  className="min-h-9 rounded-lg border border-border px-3 font-semibold text-muted-foreground"
                  onClick={() => setDialog({ charge, kind: 'cancel' })}
                  type="button"
                >
                  Cancelar
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      {dialog?.kind === 'adjust' && (
        <AdjustAmountDialog
          chargeId={dialog.charge.id}
          currentAmount={Number(dialog.charge.amount)}
          onClose={close}
          onDone={onChanged}
          open
          service={service}
        />
      )}
      {dialog?.kind === 'settle' && (
        <ChargeReasonDialog
          action={(input) => service.settleCharge(input)}
          chargeId={dialog.charge.id}
          confirmLabel="Dar baixa"
          defaultReason="Baixa manual após conferência do comprovante."
          onClose={close}
          onDone={onChanged}
          open
          title="Dar baixa na cobrança"
        />
      )}
      {dialog?.kind === 'reverse' && (
        <ChargeReasonDialog
          action={(input) => service.reverseSettlement(input)}
          chargeId={dialog.charge.id}
          confirmLabel="Estornar baixa"
          defaultReason="Estorno de baixa lançada por engano."
          onClose={close}
          onDone={onChanged}
          open
          title="Estornar baixa"
        />
      )}
      {dialog?.kind === 'cancel' && (
        <ChargeReasonDialog
          action={(input) => service.cancelCharge(input)}
          chargeId={dialog.charge.id}
          confirmLabel="Cancelar cobrança"
          defaultReason="Cobrança cancelada pela diretoria."
          onClose={close}
          onDone={onChanged}
          open
          title="Cancelar cobrança"
        />
      )}
    </>
  );
}
