// Feature 003 · US3 (Súmula Live) · T068
// Cronômetro da partida. Estado do relógio e o "tick" vivem no container; aqui é
// só apresentação + botões conforme a fase.

import { formatClock, type MatchClockState } from '@/features/live-match/lib/match-clock';

interface StopwatchProps {
  clock: MatchClockState;
  disabled?: boolean;
  nowMs: number;
  onPause: () => void;
  onResume: () => void;
  onStart: () => void;
  onStop: () => void;
}

export function Stopwatch({
  clock,
  disabled = false,
  nowMs,
  onPause,
  onResume,
  onStart,
  onStop,
}: StopwatchProps) {
  return (
    <section className="rounded-2xl border bg-card p-5 text-center">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
        Cronômetro
      </p>
      <p
        aria-live="polite"
        className="mt-1 font-mono text-5xl font-black tabular-nums text-foreground"
      >
        {formatClock(clock, nowMs)}
      </p>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {clock.phase === 'IDLE' ? (
          <button
            className="min-h-11 rounded-lg bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
            disabled={disabled}
            onClick={onStart}
            type="button"
          >
            Iniciar (apito inicial)
          </button>
        ) : null}

        {clock.phase === 'RUNNING' ? (
          <>
            <button
              className="min-h-11 rounded-lg border px-4 font-bold text-primary disabled:opacity-60"
              disabled={disabled}
              onClick={onPause}
              type="button"
            >
              Intervalo
            </button>
            <button
              className="min-h-11 rounded-lg border border-destructive px-4 font-bold text-destructive disabled:opacity-60"
              disabled={disabled}
              onClick={onStop}
              type="button"
            >
              Apito final
            </button>
          </>
        ) : null}

        {clock.phase === 'PAUSED' ? (
          <>
            <button
              className="min-h-11 rounded-lg bg-primary px-5 font-bold text-primary-foreground disabled:opacity-60"
              disabled={disabled}
              onClick={onResume}
              type="button"
            >
              Retomar
            </button>
            <button
              className="min-h-11 rounded-lg border border-destructive px-4 font-bold text-destructive disabled:opacity-60"
              disabled={disabled}
              onClick={onStop}
              type="button"
            >
              Apito final
            </button>
          </>
        ) : null}

        {clock.phase === 'STOPPED' ? (
          <p className="text-sm font-semibold text-muted-foreground">
            Partida encerrada no cronômetro.
          </p>
        ) : null}
      </div>
    </section>
  );
}
