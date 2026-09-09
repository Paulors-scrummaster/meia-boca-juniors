// Feature 003 · US3 (Súmula Live) · T064
// Relógio da partida — lógica pura, sem React nem timers. A UI guarda o
// `MatchClockState`, chama um `now()` (Date.now) para renderizar e persiste o
// estado junto da fila offline. Pausa/retomada modelam o intervalo: o tempo
// parado nunca conta para o minuto do evento.

export type MatchClockPhase = 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED';

export interface MatchClockState {
  /** Soma das pausas já encerradas (ms). */
  readonly accumulatedPausedMs: number;
  readonly phase: MatchClockPhase;
  /** Início da pausa corrente (ms epoch), ou null. */
  readonly pausedAtMs: number | null;
  /** Apito inicial (ms epoch), ou null antes de começar. */
  readonly startedAtMs: number | null;
  /** Apito final (ms epoch), ou null. */
  readonly stoppedAtMs: number | null;
}

export const initialMatchClock: MatchClockState = {
  accumulatedPausedMs: 0,
  phase: 'IDLE',
  pausedAtMs: null,
  startedAtMs: null,
  stoppedAtMs: null,
};

/** Apito inicial. Sem efeito se o relógio já saiu de IDLE. */
export function startClock(state: MatchClockState, nowMs: number): MatchClockState {
  if (state.phase !== 'IDLE') return state;
  return { ...initialMatchClock, phase: 'RUNNING', startedAtMs: nowMs };
}

/** Intervalo / bola parada longa. Sem efeito fora de RUNNING. */
export function pauseClock(state: MatchClockState, nowMs: number): MatchClockState {
  if (state.phase !== 'RUNNING') return state;
  return { ...state, pausedAtMs: nowMs, phase: 'PAUSED' };
}

/** Volta do intervalo. Sem efeito fora de PAUSED. */
export function resumeClock(state: MatchClockState, nowMs: number): MatchClockState {
  if (state.phase !== 'PAUSED' || state.pausedAtMs === null) return state;
  return {
    ...state,
    accumulatedPausedMs: state.accumulatedPausedMs + Math.max(0, nowMs - state.pausedAtMs),
    pausedAtMs: null,
    phase: 'RUNNING',
  };
}

/** Apito final. Congela o tempo decorrido; dobra a pausa aberta em accumulated. */
export function stopClock(state: MatchClockState, nowMs: number): MatchClockState {
  if (state.phase === 'IDLE' || state.phase === 'STOPPED') return state;
  const accumulatedPausedMs =
    state.phase === 'PAUSED' && state.pausedAtMs !== null
      ? state.accumulatedPausedMs + Math.max(0, nowMs - state.pausedAtMs)
      : state.accumulatedPausedMs;
  return { ...state, accumulatedPausedMs, pausedAtMs: null, phase: 'STOPPED', stoppedAtMs: nowMs };
}

/** Tempo de jogo decorrido em ms, já descontadas as pausas. */
export function elapsedMs(state: MatchClockState, nowMs: number): number {
  if (state.startedAtMs === null) return 0;
  let ceilingMs = nowMs;
  if (state.phase === 'STOPPED' && state.stoppedAtMs !== null) ceilingMs = state.stoppedAtMs;
  else if (state.phase === 'PAUSED' && state.pausedAtMs !== null) ceilingMs = state.pausedAtMs;
  return Math.max(0, ceilingMs - state.startedAtMs - state.accumulatedPausedMs);
}

export function elapsedSeconds(state: MatchClockState, nowMs: number): number {
  return Math.floor(elapsedMs(state, nowMs) / 1000);
}

/** Minuto corrente para carimbar o evento (00:00 → minuto 0; 01:00 → minuto 1). */
export function currentMinute(state: MatchClockState, nowMs: number): number {
  return Math.floor(elapsedSeconds(state, nowMs) / 60);
}

/** "MM:SS" para o cronômetro na tela. */
export function formatClock(state: MatchClockState, nowMs: number): string {
  const total = elapsedSeconds(state, nowMs);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
