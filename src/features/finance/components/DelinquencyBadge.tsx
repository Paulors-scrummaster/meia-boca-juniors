import {
  delinquencyBadgeLabel,
  type DelinquencyBadgeValue,
} from '@/features/finance/lib/currency';

interface DelinquencyBadgeProps {
  className?: string;
  value: DelinquencyBadgeValue | null | undefined;
}

/**
 * Badge discreto de inadimplência (FR-005). É puramente visual: nunca bloqueia
 * o acesso do atleta a partidas, escalação ou votação (FR-006 / SC-006).
 */
export function DelinquencyBadge({ className = '', value }: DelinquencyBadgeProps) {
  const label = value ? delinquencyBadgeLabel(value) : null;
  if (!label) return null;

  const tone =
    value === 'OVERDUE'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : 'border-warning/40 bg-warning/10 text-warning';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone} ${className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
