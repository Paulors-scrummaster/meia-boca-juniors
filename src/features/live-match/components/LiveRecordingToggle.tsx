// Feature 003 · US3 (Súmula Live) · T072
// Bloco de pré-jogo no detalhe da partida: liga o registro ao vivo, designa o
// Registrador de Campo e o goleiro titular. Só comissão/diretoria + AAL2 (a rota
// já garante); o servidor revalida.

import { useId, useState } from 'react';
import { Link } from 'react-router-dom';

import type { LiveMatchService } from '@/features/live-match/api/live-match.service';
import {
  useEnableLiveRecording,
  useLiveMatchSetup,
  useLiveRoster,
} from '@/features/live-match/queries/live-match.queries';
import { mapToAppError } from '@/shared/lib/app-error';

interface LiveRecordingToggleProps {
  matchId: string;
  service?: LiveMatchService | undefined;
}

export function LiveRecordingToggle({ matchId, service }: LiveRecordingToggleProps) {
  const setup = useLiveMatchSetup(matchId, service);
  const roster = useLiveRoster(service);
  const enable = useEnableLiveRecording(matchId, service);
  const recorderFieldId = useId();
  const keeperFieldId = useId();
  const [recorderUserId, setRecorderUserId] = useState('');
  const [startingGoalkeeperAthleteId, setStartingGoalkeeperAthleteId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recorderOptions = (roster.data ?? [])
    .filter((athlete) => athlete.userId)
    .map((athlete) => ({
      id: athlete.userId as string,
      label: `#${athlete.shirtNumber} ${athlete.shirtName}`,
    }));

  if (setup.isPending) return null;

  if (setup.data) {
    return (
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="font-bold text-foreground">Registro ao vivo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Habilitado · situação: <span className="font-semibold">{setup.data.status}</span>
        </p>
        <Link
          className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-bold text-primary-foreground"
          to={`/app/partidas/${matchId}/sumula`}
        >
          Abrir súmula ao vivo
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="font-bold text-foreground">Registro ao vivo</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ative o cronômetro e a súmula digital para esta partida.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-foreground" htmlFor={recorderFieldId}>
          Registrador de Campo
          <select
            className="mt-1 min-h-11 w-full rounded-lg border bg-background px-2"
            id={recorderFieldId}
            onChange={(event) => setRecorderUserId(event.target.value)}
            value={recorderUserId}
          >
            <option value="">Selecione…</option>
            {recorderOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-foreground" htmlFor={keeperFieldId}>
          Goleiro titular
          <select
            className="mt-1 min-h-11 w-full rounded-lg border bg-background px-2"
            id={keeperFieldId}
            onChange={(event) => setStartingGoalkeeperAthleteId(event.target.value)}
            value={startingGoalkeeperAthleteId}
          >
            <option value="">Selecione…</option>
            {(roster.data ?? []).map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                #{athlete.shirtNumber} {athlete.shirtName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        className="mt-4 min-h-11 rounded-lg bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
        disabled={enable.isPending || !recorderUserId || !startingGoalkeeperAthleteId}
        onClick={() => {
          setError(null);
          enable.mutate(
            { matchId, recorderUserId, startingGoalkeeperAthleteId },
            { onError: (enableError) => setError(mapToAppError(enableError).message) },
          );
        }}
        type="button"
      >
        Habilitar registro ao vivo
      </button>
      {error ? <p className="mt-2 text-sm font-semibold text-destructive">{error}</p> : null}
    </section>
  );
}
