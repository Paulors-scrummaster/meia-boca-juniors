import { useState } from 'react';

import type { SocialEventsService } from '@/features/social-events/api/social-events.service';
import { useSetPresence } from '@/features/social-events/queries/social-events.queries';
import { OnlineActionGuard } from '@/shared/components/OnlineActionGuard';
import { mapToAppError } from '@/shared/lib/app-error';

interface PresenceControlProps {
  eventId: string;
  initialGuests?: number;
  initialStatus?: 'CONFIRMED' | 'DECLINED' | null;
  service?: SocialEventsService;
}

/** Confirmação/recusa do atleta + quantidade de acompanhantes (FR-2.2, 0..20). */
export function PresenceControl({
  eventId,
  initialGuests = 0,
  initialStatus = null,
  service,
}: PresenceControlProps) {
  const mutate = useSetPresence(eventId, service);
  const [guests, setGuests] = useState(initialGuests);
  const [error, setError] = useState<string | null>(null);

  function submit(status: 'CONFIRMED' | 'DECLINED') {
    setError(null);
    mutate.mutate(
      { guestsCount: status === 'CONFIRMED' ? guests : 0, status },
      { onError: (err) => setError(mapToAppError(err).message) },
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="font-bold text-foreground">Sua presença</p>
      {initialStatus ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Resposta atual: {initialStatus === 'CONFIRMED' ? 'Confirmado' : 'Recusado'}
        </p>
      ) : null}
      <OnlineActionGuard>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-semibold">Acompanhantes</span>
            <input
              className="min-h-11 w-24 rounded-lg border border-input bg-background px-3"
              max={20}
              min={0}
              onChange={(event) =>
                setGuests(Math.max(0, Math.min(20, Number(event.target.value) || 0)))
              }
              type="number"
              value={guests}
            />
          </label>
          <button
            className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60"
            disabled={mutate.isPending}
            onClick={() => submit('CONFIRMED')}
            type="button"
          >
            Confirmar presença
          </button>
          <button
            className="min-h-11 rounded-lg border border-border px-4 font-semibold text-foreground disabled:opacity-60"
            disabled={mutate.isPending}
            onClick={() => submit('DECLINED')}
            type="button"
          >
            Não vou
          </button>
        </div>
      </OnlineActionGuard>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
