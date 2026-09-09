import { describe, expect, it } from 'vitest';

import {
  currentMinute,
  elapsedSeconds,
  formatClock,
  initialMatchClock,
  pauseClock,
  resumeClock,
  startClock,
  stopClock,
} from '@/features/live-match/lib/match-clock';

const T0 = 1_700_000_000_000;
const min = (n: number) => T0 + n * 60_000;
const sec = (n: number) => T0 + n * 1_000;

describe('match-clock', () => {
  it('starts idle at zero', () => {
    expect(initialMatchClock.phase).toBe('IDLE');
    expect(elapsedSeconds(initialMatchClock, min(10))).toBe(0);
    expect(currentMinute(initialMatchClock, min(10))).toBe(0);
    expect(formatClock(initialMatchClock, min(10))).toBe('00:00');
  });

  it('tracks elapsed minute while running', () => {
    const running = startClock(initialMatchClock, T0);
    expect(running.phase).toBe('RUNNING');
    expect(currentMinute(running, T0)).toBe(0);
    expect(currentMinute(running, sec(59))).toBe(0);
    expect(currentMinute(running, sec(60))).toBe(1);
    expect(currentMinute(running, sec(90))).toBe(1);
    expect(formatClock(running, sec(90))).toBe('01:30');
    expect(currentMinute(running, min(14))).toBe(14);
  });

  it('freezes time during half-time and resumes without counting the break', () => {
    let clock = startClock(initialMatchClock, T0);
    clock = pauseClock(clock, min(45)); // apito de intervalo aos 45'
    expect(clock.phase).toBe('PAUSED');

    // O relógio não anda durante o intervalo, mesmo consultado 10 min depois.
    expect(currentMinute(clock, min(55))).toBe(45);
    expect(formatClock(clock, min(55))).toBe('45:00');

    clock = resumeClock(clock, min(60)); // 15 min de intervalo
    expect(clock.phase).toBe('RUNNING');

    // 10 min de segundo tempo → 55', não 70'.
    expect(currentMinute(clock, min(70))).toBe(55);
    expect(formatClock(clock, min(70))).toBe('55:00');
  });

  it('supports several pause/resume cycles', () => {
    let clock = startClock(initialMatchClock, T0);
    clock = pauseClock(clock, min(10));
    clock = resumeClock(clock, min(12)); // -2 min
    clock = pauseClock(clock, min(20));
    clock = resumeClock(clock, min(23)); // -3 min more, total -5
    expect(currentMinute(clock, min(30))).toBe(25);
  });

  it('stops and freezes the elapsed time', () => {
    let clock = startClock(initialMatchClock, T0);
    clock = stopClock(clock, min(92));
    expect(clock.phase).toBe('STOPPED');
    expect(currentMinute(clock, min(200))).toBe(92);
    expect(formatClock(clock, min(200))).toBe('92:00');
  });

  it('folds an open pause into the total when stopped', () => {
    let clock = startClock(initialMatchClock, T0);
    clock = pauseClock(clock, min(45));
    clock = stopClock(clock, min(50));
    expect(currentMinute(clock, min(999))).toBe(45);
  });

  it('ignores out-of-phase transitions', () => {
    const running = startClock(initialMatchClock, T0);
    expect(startClock(running, min(5))).toBe(running); // já rodando
    expect(resumeClock(running, min(5))).toBe(running); // não está pausado

    const paused = pauseClock(running, min(5));
    expect(pauseClock(paused, min(6))).toBe(paused); // já pausado
    expect(startClock(paused, min(6))).toBe(paused);

    expect(pauseClock(initialMatchClock, min(1))).toBe(initialMatchClock); // nem começou
    expect(stopClock(initialMatchClock, min(1))).toBe(initialMatchClock);
  });
});
