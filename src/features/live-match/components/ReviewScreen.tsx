// Feature 003 · US3 (Súmula Live) · T069
// Tela de revisão pós-jogo. Edita minuto / autor / autor da assistência
// (amend_live_event, IN_REVIEW). "Confirmar e Finalizar Súmula" fica desabilitado
// enquanto a fila offline não esvazia OU o usuário não é comissão/admin (FR-034,
// FR-037b, SC-013).

import { useState } from 'react';

import type { FinalizeResult, LiveMatchService } from '@/features/live-match/api/live-match.service';
import { LIVE_EVENT_LABEL, scoreFromEvents } from '@/features/live-match/lib/event-labels';
import {
  useAmendLiveEvent,
  useFinalizeSumula,
  useLiveRoster,
  useLiveSumulaFeed,
} from '@/features/live-match/queries/live-match.queries';
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/feedback';
import { mapToAppError } from '@/shared/lib/app-error';

interface ReviewScreenProps {
  canFinalize: boolean;
  matchId: string;
  pendingCount: number;
  service?: LiveMatchService | undefined;
}

export function ReviewScreen({ canFinalize, matchId, pendingCount, service }: ReviewScreenProps) {
  const feed = useLiveSumulaFeed(matchId, service);
  const roster = useLiveRoster(service);
  const amend = useAmendLiveEvent(matchId, service);
  const finalize = useFinalizeSumula(matchId, pendingCount, service);
  const [result, setResult] = useState<FinalizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (feed.isPending) return <LoadingState label="Carregando súmula" />;
  if (feed.isError)
    return (
      <ErrorState message={mapToAppError(feed.error).message} onRetry={() => void feed.refetch()} />
    );

  const events = feed.data ?? [];
  const athletes = roster.data ?? [];
  const score = scoreFromEvents(events);
  const finalizeDisabled = !canFinalize || pendingCount > 0 || finalize.isPending;

  if (result) {
    return (
      <section className="rounded-2xl border bg-card p-6 text-center">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
          Súmula finalizada
        </p>
        <p className="mt-2 font-mono text-4xl font-black tabular-nums text-foreground">
          {result.mbjScore} <span className="text-muted-foreground">×</span> {result.opponentScore}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Revisão {result.revision} · votação de Craque do Jogo aberta.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold text-foreground">Revisão da súmula</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Placar corrente {score.mbj} × {score.opponent}. Ajuste o que for preciso antes de finalizar.
        </p>
      </header>

      {events.length === 0 ? (
        <EmptyState title="Nenhum evento registrado" />
      ) : (
        <ul className="space-y-2">
          {events.map((event) => (
            <li className="rounded-xl border bg-card p-4" key={event.id}>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-black text-primary">{LIVE_EVENT_LABEL[event.event_type]}</span>
                <label className="text-sm font-semibold text-foreground">
                  Minuto
                  <input
                    className="ml-2 min-h-11 w-20 rounded-lg border bg-background px-2"
                    defaultValue={event.minute}
                    max={200}
                    min={0}
                    onBlur={(input) => {
                      const minute = Number(input.target.value);
                      if (Number.isInteger(minute) && minute !== event.minute) {
                        amend.mutate({ eventId: event.id, minute });
                      }
                    }}
                    type="number"
                  />
                </label>
                <label className="text-sm font-semibold text-foreground">
                  Autor
                  <select
                    className="ml-2 min-h-11 rounded-lg border bg-background px-2"
                    defaultValue={event.athlete_id}
                    onChange={(input) => amend.mutate({ athleteId: input.target.value, eventId: event.id })}
                  >
                    {athletes.map((athlete) => (
                      <option key={athlete.id} value={athlete.id}>
                        #{athlete.shirtNumber} {athlete.shirtName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-foreground">
                  Assistência / quem sai
                  <select
                    className="ml-2 min-h-11 rounded-lg border bg-background px-2"
                    defaultValue={event.target_athlete_id ?? ''}
                    onChange={(input) =>
                      amend.mutate({ eventId: event.id, targetAthleteId: input.target.value || null })
                    }
                  >
                    <option value="">—</option>
                    {athletes.map((athlete) => (
                      <option key={athlete.id} value={athlete.id}>
                        #{athlete.shirtNumber} {athlete.shirtName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl border bg-card p-5">
        {pendingCount > 0 ? (
          <p className="mb-2 text-sm font-semibold text-destructive">
            {pendingCount} evento(s) ainda não sincronizado(s) — finalização bloqueada.
          </p>
        ) : null}
        {!canFinalize ? (
          <p className="mb-2 text-sm text-muted-foreground">
            Apenas a comissão técnica / diretoria finaliza a súmula.
          </p>
        ) : null}
        <button
          className="min-h-11 rounded-lg bg-primary px-5 font-bold text-primary-foreground disabled:opacity-50"
          disabled={finalizeDisabled}
          onClick={() => {
            setError(null);
            finalize.mutate(undefined, {
              onError: (finalizeError) => setError(mapToAppError(finalizeError).message),
              onSuccess: (data) => setResult(data),
            });
          }}
          type="button"
        >
          Confirmar e Finalizar Súmula
        </button>
        {error ? <p className="mt-2 text-sm font-semibold text-destructive">{error}</p> : null}
      </div>
    </section>
  );
}
