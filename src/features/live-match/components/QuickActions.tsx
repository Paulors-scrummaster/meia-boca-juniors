// Feature 003 · US3 (Súmula Live) · T068
// Botões de ação rápida — carimbam o minuto corrente do cronômetro (FR-4.2).

import { useId, useState } from 'react';

import type { RosterAthlete } from '@/features/live-match/api/live-match.service';
import {
  LIVE_EVENT_LABEL,
  LIVE_EVENT_TYPES,
  requiresTargetAthlete,
} from '@/features/live-match/lib/event-labels';
import type { LiveEventType, TeamSide } from '@/features/live-match/lib/offline-queue';

export interface QuickActionInput {
  athleteId: string;
  eventType: LiveEventType;
  minute: number;
  targetAthleteId: string | null;
  teamSide: TeamSide;
}

interface QuickActionsProps {
  athletes: RosterAthlete[];
  disabled?: boolean;
  minute: number;
  onLog: (input: QuickActionInput) => void;
}

export function QuickActions({ athletes, disabled = false, minute, onLog }: QuickActionsProps) {
  const athleteFieldId = useId();
  const targetFieldId = useId();
  const sideFieldId = useId();
  const [athleteId, setAthleteId] = useState('');
  const [targetAthleteId, setTargetAthleteId] = useState('');
  const [teamSide, setTeamSide] = useState<TeamSide>('MBJ');
  const [error, setError] = useState<string | null>(null);

  function handle(eventType: LiveEventType) {
    if (!athleteId) {
      setError('Escolha o atleta.');
      return;
    }
    if (requiresTargetAthlete(eventType) && !targetAthleteId) {
      setError('Substituição precisa de quem sai.');
      return;
    }
    if (targetAthleteId && targetAthleteId === athleteId) {
      setError('Os dois atletas precisam ser diferentes.');
      return;
    }
    setError(null);
    onLog({
      athleteId,
      eventType,
      minute,
      targetAthleteId: targetAthleteId || null,
      teamSide,
    });
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold text-foreground">Registrar evento</h2>
        <span className="text-sm font-black text-primary">minuto {minute}&apos;</span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold text-foreground" htmlFor={athleteFieldId}>
          Atleta
          <select
            className="mt-1 min-h-11 w-full rounded-lg border bg-background px-2"
            disabled={disabled}
            id={athleteFieldId}
            onChange={(event) => setAthleteId(event.target.value)}
            value={athleteId}
          >
            <option value="">Selecione…</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                #{athlete.shirtNumber} {athlete.shirtName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-foreground" htmlFor={targetFieldId}>
          Assistência / quem sai
          <select
            className="mt-1 min-h-11 w-full rounded-lg border bg-background px-2"
            disabled={disabled}
            id={targetFieldId}
            onChange={(event) => setTargetAthleteId(event.target.value)}
            value={targetAthleteId}
          >
            <option value="">—</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                #{athlete.shirtNumber} {athlete.shirtName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-foreground" htmlFor={sideFieldId}>
          Lado
          <select
            className="mt-1 min-h-11 w-full rounded-lg border bg-background px-2"
            disabled={disabled}
            id={sideFieldId}
            onChange={(event) => setTeamSide(event.target.value as TeamSide)}
            value={teamSide}
          >
            <option value="MBJ">MBJ</option>
            <option value="OPPONENT">Adversário</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {LIVE_EVENT_TYPES.map((type) => (
          <button
            className="min-h-11 rounded-lg bg-primary px-4 font-bold text-primary-foreground disabled:opacity-60"
            disabled={disabled}
            key={type}
            onClick={() => handle(type)}
            type="button"
          >
            {LIVE_EVENT_LABEL[type]}
          </button>
        ))}
      </div>

      {error ? <p className="mt-2 text-sm font-semibold text-destructive">{error}</p> : null}
    </section>
  );
}
