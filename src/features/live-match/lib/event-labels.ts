// Feature 003 · US3 (Súmula Live) — rótulos PT-BR e placar derivado dos eventos.

import type { LiveMatchEvent } from '@/features/live-match/api/live-match.service';
import type { LiveEventType } from '@/features/live-match/lib/offline-queue';

export const LIVE_EVENT_LABEL: Record<LiveEventType, string> = {
  ASSIST: 'Assistência',
  GOAL: 'Gol',
  RED_CARD: 'Cartão vermelho',
  SUBSTITUTION: 'Substituição',
  YELLOW_CARD: 'Cartão amarelo',
};

export const LIVE_EVENT_TYPES: LiveEventType[] = [
  'GOAL',
  'ASSIST',
  'YELLOW_CARD',
  'RED_CARD',
  'SUBSTITUTION',
];

/** Segundo atleta obrigatório (substituição: quem sai). */
export function requiresTargetAthlete(type: LiveEventType): boolean {
  return type === 'SUBSTITUTION';
}

export interface LiveScore {
  mbj: number;
  opponent: number;
}

/** Placar corrente = gols não desfeitos por lado. */
export function scoreFromEvents(events: readonly LiveMatchEvent[]): LiveScore {
  return events.reduce<LiveScore>(
    (score, event) => {
      if (event.event_type !== 'GOAL' || event.undone) return score;
      return event.team_side === 'OPPONENT'
        ? { ...score, opponent: score.opponent + 1 }
        : { ...score, mbj: score.mbj + 1 };
    },
    { mbj: 0, opponent: 0 },
  );
}
