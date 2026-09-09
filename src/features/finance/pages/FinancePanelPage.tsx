import { useState } from 'react';

import { DelinquencyBadge } from '@/features/finance/components/DelinquencyBadge';
import {
  createFinanceService,
  type AthleteCharge,
  type FinanceService,
} from '@/features/finance/api/charges.service';
import { formatBrl } from '@/features/finance/lib/currency';
import {
  useAllCharges,
  useCancelCharge,
  useFinanceOverview,
  useReverseSettlement,
  useRunMonthlyGeneration,
  useSetDefaultDuesAmount,
  useSettleCharge,
} from '@/features/finance/queries/charges.queries';
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

interface FinancePanelPageProps {
  service?: FinanceService;
}

export function FinancePanelPage({ service = createFinanceService() }: FinancePanelPageProps) {
  const overview = useFinanceOverview(service);
  const charges = useAllCharges(service);
  const generate = useRunMonthlyGeneration(service);
  const setAmount = useSetDefaultDuesAmount(service);
  const settle = useSettleCharge(service);
  const reverse = useReverseSettlement(service);
  const cancel = useCancelCharge(service);

  const [amount, setAmountValue] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function run<T>(promise: Promise<T>, onOk: (result: T) => void) {
    setActionError(null);
    setFeedback(null);
    promise.then(onOk).catch((error) => setActionError(mapToAppError(error).message));
  }

  const chargesByAthlete = new Map<string, AthleteCharge[]>();
  for (const charge of charges.data ?? []) {
    const list = chargesByAthlete.get(charge.athlete_id) ?? [];
    list.push(charge);
    chargesByAthlete.set(charge.athlete_id, list);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-black text-foreground">Financeiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Controle de mensalidades e adimplência do elenco. Registro interno — a
          liquidação é conferida fora do aplicativo.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-bold text-foreground">Rotina mensal</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-semibold text-foreground">Valor padrão (R$)</span>
            <input
              className="min-h-11 w-40 rounded-lg border border-input bg-background px-3 text-foreground"
              inputMode="decimal"
              onChange={(event) => setAmountValue(event.target.value)}
              value={amount}
            />
          </label>
          <button
            className="min-h-11 rounded-lg border border-primary px-4 font-semibold text-primary disabled:opacity-60"
            disabled={setAmount.isPending || Number(amount) <= 0}
            onClick={() =>
              run(setAmount.mutateAsync(Number(amount)), () => {
                setFeedback('Valor padrão atualizado.');
                setAmountValue('');
              })
            }
            type="button"
          >
            Salvar valor
          </button>
          <button
            className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60"
            disabled={generate.isPending}
            onClick={() =>
              run(generate.mutateAsync(null), (result) =>
                setFeedback(
                  `Geração ${result.period}: ${result.created} criada(s), ${result.skippedExempt} isenta(s), ${result.skippedExisting} já existente(s).`,
                ),
              )
            }
            type="button"
          >
            Gerar mensalidades do mês
          </button>
        </div>
        {feedback ? <p className="mt-3 text-sm text-success">{feedback}</p> : null}
        {actionError ? <p className="mt-3 text-sm text-destructive">{actionError}</p> : null}
      </section>

      {overview.isPending || charges.isPending ? (
        <LoadingState label="Carregando situação financeira" />
      ) : overview.isError ? (
        <ErrorState
          message={mapToAppError(overview.error).message}
          onRetry={() => void overview.refetch()}
        />
      ) : (overview.data?.length ?? 0) === 0 ? (
        <EmptyState title="Sem atletas ativos" description="Cadastre o elenco para gerar cobranças." />
      ) : (
        <ul className="space-y-4">
          {(overview.data ?? [])
            .filter((row): row is typeof row & { athlete_id: string } => row.athlete_id != null)
            .map((row) => (
            <li key={row.athlete_id} className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-foreground">
                    {row.shirt_number != null ? `#${row.shirt_number} ` : ''}
                    {row.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Pendente {formatBrl(row.pending_amount ?? 0)} · Em atraso{' '}
                    {formatBrl(row.overdue_amount ?? 0)} · Pago na temporada{' '}
                    {formatBrl(row.paid_active_season_amount ?? 0)}
                  </p>
                </div>
                <DelinquencyBadge value={row.badge as 'NONE' | 'PENDING' | 'OVERDUE'} />
              </div>

              <ul className="mt-3 divide-y divide-border border-t border-border">
                {(chargesByAthlete.get(row.athlete_id) ?? []).map((charge) => (
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
                    <span className="flex gap-2">
                      {charge.status === 'PENDING' || charge.status === 'OVERDUE' ? (
                        <button
                          className="min-h-9 rounded-lg border border-primary px-3 font-semibold text-primary"
                          onClick={() =>
                            run(
                              settle.mutateAsync({
                                chargeId: charge.id,
                                reason: 'Baixa manual após conferência do comprovante.',
                              }),
                              () => setFeedback('Cobrança baixada.'),
                            )
                          }
                          type="button"
                        >
                          Dar baixa
                        </button>
                      ) : null}
                      {charge.status === 'PAID' ? (
                        <button
                          className="min-h-9 rounded-lg border border-border px-3 font-semibold text-foreground"
                          onClick={() =>
                            run(
                              reverse.mutateAsync({
                                chargeId: charge.id,
                                reason: 'Estorno de baixa lançada por engano.',
                              }),
                              () => setFeedback('Baixa estornada.'),
                            )
                          }
                          type="button"
                        >
                          Estornar
                        </button>
                      ) : null}
                      {charge.status !== 'CANCELLED' ? (
                        <button
                          className="min-h-9 rounded-lg border border-border px-3 font-semibold text-muted-foreground"
                          onClick={() =>
                            run(
                              cancel.mutateAsync({
                                chargeId: charge.id,
                                reason: 'Cobrança cancelada pela diretoria.',
                              }),
                              () => setFeedback('Cobrança cancelada.'),
                            )
                          }
                          type="button"
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))}
                {(chargesByAthlete.get(row.athlete_id) ?? []).length === 0 ? (
                  <li className="py-2 text-sm text-muted-foreground">Sem cobranças.</li>
                ) : null}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
