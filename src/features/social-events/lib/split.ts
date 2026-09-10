export interface SplitResult {
  costPerPerson: number | null;
  peopleCount: number;
  splitUnavailable: boolean;
}

export interface ConfirmedPresence {
  guestsCount: number;
  status: 'CONFIRMED' | 'DECLINED';
}

/** Total de pessoas confirmadas (atletas + acompanhantes). */
export function countPeople(presences: readonly ConfirmedPresence[]): number {
  return presences
    .filter((presence) => presence.status === 'CONFIRMED')
    .reduce((sum, presence) => sum + 1 + Math.max(0, presence.guestsCount), 0);
}

/**
 * Espelho de exibição da regra do servidor (`public.social_event_split`): enquanto
 * o evento está aberto, `costPerPerson = round(totalCost / peopleCount, 2)`; com
 * ninguém confirmado, `splitUnavailable = true` e `costPerPerson = null` (FR-016).
 * O valor consolidado exato por atleta vem do servidor no fechamento (SC-002).
 */
export function computeSplit(input: {
  presences?: readonly ConfirmedPresence[];
  peopleCount?: number;
  totalCost: number;
}): SplitResult {
  const peopleCount = input.peopleCount ?? countPeople(input.presences ?? []);
  if (peopleCount <= 0) {
    return { costPerPerson: null, peopleCount: 0, splitUnavailable: true };
  }
  return {
    costPerPerson: Math.round((input.totalCost / peopleCount) * 100) / 100,
    peopleCount,
    splitUnavailable: false,
  };
}
