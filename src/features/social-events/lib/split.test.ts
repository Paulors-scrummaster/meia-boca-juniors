import { describe, expect, it } from 'vitest';

import { computeSplit, countPeople } from '@/features/social-events/lib/split';

describe('social-event split (display mirror)', () => {
  it('conta atletas confirmados + acompanhantes', () => {
    expect(
      countPeople([
        { guestsCount: 1, status: 'CONFIRMED' },
        { guestsCount: 0, status: 'CONFIRMED' },
        { guestsCount: 3, status: 'DECLINED' },
      ]),
    ).toBe(3);
  });

  it('R$ 600,00 entre 15 pessoas → R$ 40,00 (quickstart Cenário 2)', () => {
    expect(computeSplit({ peopleCount: 15, totalCost: 600 })).toEqual({
      costPerPerson: 40,
      peopleCount: 15,
      splitUnavailable: false,
    });
  });

  it('recalcula quando muda a contagem', () => {
    expect(computeSplit({ peopleCount: 16, totalCost: 600 }).costPerPerson).toBe(37.5);
  });

  it('ninguém confirmado → indisponível, sem divisão por zero (FR-016)', () => {
    expect(computeSplit({ peopleCount: 0, totalCost: 600 })).toEqual({
      costPerPerson: null,
      peopleCount: 0,
      splitUnavailable: true,
    });
    expect(computeSplit({ presences: [], totalCost: 600 }).splitUnavailable).toBe(true);
  });
});
