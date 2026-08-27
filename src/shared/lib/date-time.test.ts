import { describe, expect, it } from 'vitest';

import {
  formatSaoPauloDate,
  formatSaoPauloDateTime,
  formatSaoPauloTime,
  toUtcIsoString,
} from '@/shared/lib/date-time';

describe('São Paulo date/time helpers', () => {
  const instant = '2026-08-25T23:30:00.000Z';

  it('formata data e hora no fuso America/Sao_Paulo', () => {
    expect(formatSaoPauloDate(instant)).toBe('25/08/2026');
    expect(formatSaoPauloTime(instant)).toBe('20:30');
    expect(formatSaoPauloDateTime(instant)).toBe('25/08/2026, 20:30');
  });

  it('normaliza instantes para armazenamento UTC', () => {
    expect(toUtcIsoString('2026-08-25T20:30:00-03:00')).toBe(instant);
  });

  it('recusa datas inválidas com mensagem segura', () => {
    expect(() => formatSaoPauloDate('não-é-data')).toThrow('Data ou hora inválida.');
  });
});
