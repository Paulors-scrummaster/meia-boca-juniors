// Feature 003 · US3 (Súmula Live) — rótulos PT-BR e placar derivado dos eventos.

import type { LiveMatchEvent } from '@/features/live-match/api/live-match.service';
import type { LiveEventType } from '@/features/live-match/lib/offline-queue';

// Cobre todo o enum `live_event_type` do banco — inclusive `ASSIST` — para que o
// feed / a revisão consigam rotular qualquer linha existente. `ASSIST` como
// evento independente NÃO é mais criável pela UI (H1): a assistência entra
// vinculada ao GOAL, via `target_athlete_id`, e é isso que `finalize_sumula`
// consolida em `match_goals.assistant_athlete_id`.
export const LIVE_EVENT_LABEL: Record<LiveEventType, string> = {
  ASSIST: 'Assistência',
  GOAL: 'Gol',
  RED_CARD: 'Cartão vermelho',
  SUBSTITUTION: 'Substituição',
  YELLOW_CARD: 'Cartão amarelo',
};

/**
 * Tipos que o Registrador pode criar pelo cronômetro (FR-4.2). Sem `ASSIST`
 * avulso — a assistência é o `target_athlete_id` do gol.
 */
export const LIVE_EVENT_TYPES: LiveEventType[] = [
  'GOAL',
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
