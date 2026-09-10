import { describe, expect, it } from 'vitest';

import {
  defaultDueDate,
  delinquencyBadgeLabel,
  duesPeriod,
  formatBrl,
  formatPeriodLabel,
} from '@/features/finance/lib/currency';

describe('finance currency helpers', () => {
  it('formata valores como moeda pt-BR', () => {
    expect(formatBrl(40)).toBe('R$ 40,00');
    expect(formatBrl('37.5')).toBe('R$ 37,50');
  });

  it('rejeita valores não numéricos', () => {
    expect(() => formatBrl('abc')).toThrow(RangeError);
  });

  it('deriva o período de mensalidade no fuso do clube', () => {
    // 2026-10-01T01:00:00Z ainda é 30/09 em São Paulo (UTC-3).
    expect(duesPeriod('2026-10-01T01:00:00Z')).toBe('2026-09');
    expect(duesPeriod('2026-09-15T12:00:00Z')).toBe('2026-09');
  });

  it('rotula um período YYYY-MM', () => {
    expect(formatPeriodLabel('2026-09')).toBe('set de 2026');
  });

  it('calcula o vencimento padrão no dia 10', () => {
    expect(defaultDueDate('2026-09')).toBe('2026-09-10');
    expect(() => defaultDueDate('2026/09')).toThrow(RangeError);
  });

  it('traduz o valor do badge de inadimplência', () => {
    expect(delinquencyBadgeLabel('NONE')).toBeNull();
    expect(delinquencyBadgeLabel('PENDING')).toBe('Pendente');
    expect(delinquencyBadgeLabel('OVERDUE')).toBe('Em Atraso');
  });
});
