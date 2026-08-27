import { useState } from 'react';

import { APPROVED_FORMATIONS, type ApprovedFormation } from '@/config/club.config';
import type { LineupAthlete, PresenceByAthlete } from '@/features/lineups/api/lineups.service';
import { getLineupEligibilityMessage } from '@/features/lineups/lib/lineup-eligibility';

interface FormationSelectorProps {
  athletes: LineupAthlete[];
  formation: ApprovedFormation;
  onFormationChange: (formation: ApprovedFormation) => void;
  presenceByAthlete: PresenceByAthlete;
}

export function FormationSelector({
  athletes,
  formation,
  onFormationChange,
  presenceByAthlete,
}: FormationSelectorProps) {
  const [consultedAthleteId, setConsultedAthleteId] = useState('');
  const consultedAthlete = athletes.find((athlete) => athlete.id === consultedAthleteId);
  const message = consultedAthlete
    ? getLineupEligibilityMessage(consultedAthlete, presenceByAthlete[consultedAthlete.id])
    : null;

  return (
    <section className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
      <label className="font-semibold">
        Formação
        <select
          className="form-input"
          onChange={(event) => onFormationChange(event.target.value as ApprovedFormation)}
          value={formation}
        >
          {APPROVED_FORMATIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="font-semibold">
        Atleta para consultar elegibilidade
        <select
          className="form-input"
          onChange={(event) => setConsultedAthleteId(event.target.value)}
          value={consultedAthleteId}
        >
          <option value="">Selecione</option>
          {athletes.map((athlete) => (
            <option key={athlete.id} value={athlete.id}>
              {athlete.full_name}
            </option>
          ))}
        </select>
      </label>
      {message ? (
        <p
          className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive sm:col-span-2"
          role="alert"
        >
          {message}
        </p>
      ) : consultedAthlete ? (
        <p
          className="rounded-xl bg-primary/10 p-3 text-sm font-semibold text-primary sm:col-span-2"
          aria-live="polite"
        >
          {consultedAthlete.full_name} está elegível para esta escalação.
        </p>
      ) : null}
    </section>
  );
}
