import { SAO_PAULO_TIME_ZONE } from '@/shared/lib/date-time';

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
});

/** Formata um valor numérico (ou string numérica) como moeda pt-BR. */
export function formatBrl(value: number | string): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(amount)) throw new RangeError('Valor monetário inválido.');
  return brlFormatter.format(amount);
}

const monthFormatter = new Intl.DateTimeFormat('en-CA', {
  month: '2-digit',
  timeZone: SAO_PAULO_TIME_ZONE,
  year: 'numeric',
});

/** Período de mensalidade (`YYYY-MM`) do instante dado, no fuso do clube. */
export function duesPeriod(value: Date | number | string = new Date()): string {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) throw new RangeError('Data inválida.');
  const parts = Object.fromEntries(
    monthFormatter
      .formatToParts(instant)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value: part }) => [type, part]),
  );
  return `${parts.year}-${parts.month}`;
}

/** Rótulo humano de um período `YYYY-MM` (ex.: `2026-09` → `set/2026`). */
export function formatPeriodLabel(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) throw new RangeError('Período inválido.');
  const [, year, month] = match;
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, 1)));
  return label.replace('.', '');
}

/** Vencimento padrão (dia 10) de um período `YYYY-MM`, como `YYYY-MM-DD`. */
export function defaultDueDate(period: string): string {
  if (!/^\d{4}-\d{2}$/.test(period)) throw new RangeError('Período inválido.');
  return `${period}-10`;
}

export type DelinquencyBadgeValue = 'NONE' | 'PENDING' | 'OVERDUE';

const badgeLabels: Record<Exclude<DelinquencyBadgeValue, 'NONE'>, string> = {
  OVERDUE: 'Em Atraso',
  PENDING: 'Pendente',
};

export function delinquencyBadgeLabel(value: DelinquencyBadgeValue): string | null {
  return value === 'NONE' ? null : badgeLabels[value];
}
