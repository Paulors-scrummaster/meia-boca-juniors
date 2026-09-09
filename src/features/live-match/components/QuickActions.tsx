// Feature 003 · US3 (Súmula Live) · T068
// Botões de ação rápida — carimbam o minuto corrente do cronômetro (FR-4.2).
// Gol / cartões: um toque. Substituição: exige os dois atletas com papéis
// explícitos ("Quem entra" / "Quem sai"), então abre um passo dedicado (M7).
// Não há mais ação de "Assistência" avulsa (H1): a assistência é o segundo
// atleta do gol e vira `target_athlete_id`.

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

const INSTANT_TYPES = LIVE_EVENT_TYPES.filter((type) => type !== 'SUBSTITUTION');

export function QuickActions({ athletes, disabled = false, minute, onLog }: QuickActionsProps) {
  const athleteFieldId = useId();
  const targetFieldId = useId();
  const sideFieldId = useId();
  const [athleteId, setAthleteId] = useState('');
  const [targetAthleteId, setTargetAthleteId] = useState('');
  const [teamSide, setTeamSide] = useState<TeamSide>('MBJ');
  const [subMode, setSubMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handle(eventType: LiveEventType) {
    const isSub = eventType === 'SUBSTITUTION';
    if (!athleteId) {
      setError(isSub ? 'Escolha quem entra.' : 'Escolha o atleta.');
      return;
    }
    if (requiresTargetAthlete(eventType) && !targetAthleteId) {
      setError('Escolha quem sai.');
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
      // athlete_id = quem entra (sub) / autor (gol, cartão);
      // target_athlete_id = quem sai (sub) / assistência (gol).
      targetAthleteId: targetAthleteId || null,
      teamSide,
    });
    if (isSub) {
      setSubMode(false);
      setTargetAthleteId('');
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bold text-foreground">Registrar evento</h2>
        <span className="text-sm font-black text-primary">minuto {minute}&apos;</span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold text-foreground" htmlFor={athleteFieldId}>
          {subMode ? 'Quem entra' : 'Atleta'}
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
          {subMode ? 'Quem sai' : 'Assistência (opcional)'}
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
            disabled={disabled || subMode}
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
        {INSTANT_TYPES.map((type) => (
          <button
            className="min-h-11 rounded-lg bg-primary px-4 font-bold text-primary-foreground disabled:opacity-60"
            disabled={disabled || subMode}
            key={type}
            onClick={() => handle(type)}
            type="button"
          >
            {LIVE_EVENT_LABEL[type]}
          </button>
        ))}
        <button
          aria-pressed={subMode}
          className={`min-h-11 rounded-lg border border-primary px-4 font-bold disabled:opacity-60 ${
            subMode ? 'bg-primary text-primary-foreground' : 'text-primary'
          }`}
          disabled={disabled}
          onClick={() => {
            setError(null);
            setSubMode((open) => !open);
          }}
          type="button"
        >
          {LIVE_EVENT_LABEL.SUBSTITUTION}
        </button>
      </div>

      {subMode ? (
        <button
          className="mt-3 min-h-11 rounded-lg bg-primary px-4 font-bold text-primary-foreground disabled:opacity-60"
          disabled={disabled}
          onClick={() => handle('SUBSTITUTION')}
          type="button"
        >
          Registrar substituição
        </button>
      ) : null}

      {error ? <p className="mt-2 text-sm font-semibold text-destructive">{error}</p> : null}
    </section>
  );
}
