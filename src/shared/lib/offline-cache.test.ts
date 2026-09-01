import type { DehydratedState, Query, Mutation } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  OFFLINE_CACHE_MAX_AGE,
  OFFLINE_CACHE_VERSION,
  createOfflineBuster,
  createOfflineStorageKey,
  isOfflineCacheExpired,
  parsePersistedOfflineState,
  shouldDehydrateOfflineMutation,
  shouldPersistOfflineQuery,
} from '@/shared/lib/offline-cache';
import { offlineNextMatchSchema, offlinePublishedLineupSchema } from '@/shared/types/offline-cache';

const userId = '00000000-0000-4000-8000-000000000146';
const matchId = '00000000-0000-4000-8000-000000000147';
const cachedAt = '2026-08-29T18:00:00.000Z';

const nextMatch = {
  cachedAt,
  match: {
    competitionName: 'Liga Local',
    id: matchId,
    locationName: 'Campo Principal',
    matchDate: '2026-08-30T21:00:00.000Z',
    opponentName: 'Adversário Teste',
    status: 'SCHEDULED',
  },
  myCall: {
    applicableDeadline: '2026-08-30T18:00:00.000Z',
    callStatus: 'CALLED',
    presenceStatus: 'PENDING',
  },
  schemaVersion: 1,
} as const;

const publishedLineup = {
  cachedAt,
  lineup: {
    formationCode: '4-4-2',
    publishedAt: '2026-08-29T17:00:00.000Z',
    reserves: [
      {
        athleteId: '00000000-0000-4000-8000-000000000149',
        displayOrder: 0,
        shirtName: 'Reserva',
        shirtNumber: 12,
      },
    ],
    revision: 2,
    starters: [
      {
        athleteId: '00000000-0000-4000-8000-000000000148',
        positionX: 50,
        positionY: 80,
        shirtName: 'Titular',
        shirtNumber: 9,
        tacticalPosition: 'ATA',
      },
    ],
  },
  matchId,
  schemaVersion: 1,
} as const;

function query(meta: unknown, queryKey: readonly unknown[], data: unknown, status = 'success') {
  return {
    meta,
    queryKey,
    state: { data, status },
  } as unknown as Query;
}

describe('offline cache', () => {
  it('valida DTOs mínimos e rejeita campos excedentes em qualquer nível', () => {
    expect(offlineNextMatchSchema.parse(nextMatch)).toEqual(nextMatch);
    expect(offlinePublishedLineupSchema.parse(publishedLineup)).toEqual(publishedLineup);

    expect(() =>
      offlineNextMatchSchema.parse({ ...nextMatch, accessToken: 'não pode persistir' }),
    ).toThrow();
    expect(() =>
      offlineNextMatchSchema.parse({
        ...nextMatch,
        myCall: { ...nextMatch.myCall, refusalReason: 'privado' },
      }),
    ).toThrow();
    expect(() =>
      offlinePublishedLineupSchema.parse({
        ...publishedLineup,
        lineup: {
          ...publishedLineup.lineup,
          starters: [{ ...publishedLineup.lineup.starters[0], email: 'privado@teste.local' }],
        },
      }),
    ).toThrow();
  });

  it('usa chave e buster isolados por versão, deployment, clube e usuário', () => {
    expect(OFFLINE_CACHE_VERSION).toBe(1);
    expect(createOfflineStorageKey({ clubId: 'mbj', deploymentId: 'preview-183', userId })).toBe(
      `mbj:query-cache:v1:preview-183:mbj:${userId}`,
    );
    expect(createOfflineBuster({ clubId: 'mbj', deploymentId: 'preview-183', userId })).toBe(
      `offline:v1:preview-183:mbj:${userId}`,
    );
    expect(createOfflineStorageKey({ clubId: 'mbj', deploymentId: 'production', userId })).not.toBe(
      createOfflineStorageKey({ clubId: 'mbj', deploymentId: 'preview-183', userId }),
    );
  });

  it('permite exatamente as duas famílias, somente com meta explícita e DTO válido', () => {
    expect(
      shouldPersistOfflineQuery(
        query({ persistOffline: 'next-match' }, ['offline', userId, 'next-match'], nextMatch),
        userId,
      ),
    ).toBe(true);
    expect(
      shouldPersistOfflineQuery(
        query(
          { persistOffline: 'published-lineup' },
          ['offline', userId, 'published-lineup', matchId],
          publishedLineup,
        ),
        userId,
      ),
    ).toBe(true);

    const denied = [
      query(undefined, ['offline', userId, 'next-match'], nextMatch),
      query({ persistOffline: 'next-match' }, ['matches', 'list'], nextMatch),
      query(
        { persistOffline: 'next-match' },
        ['offline', 'outro-usuario', 'next-match'],
        nextMatch,
      ),
      query(
        { persistOffline: 'next-match' },
        ['offline', userId, 'next-match'],
        nextMatch,
        'error',
      ),
      query(
        { persistOffline: 'published-lineup' },
        ['offline', userId, 'published-lineup'],
        publishedLineup,
      ),
      query(
        { persistOffline: 'published-lineup' },
        ['offline', userId, 'published-lineup', matchId],
        { ...publishedLineup, token: 'privado' },
      ),
    ];
    denied.forEach((candidate) => expect(shouldPersistOfflineQuery(candidate, userId)).toBe(false));
  });

  it('expira em no máximo 24 horas e rejeita estado incompatível ou adulterado', () => {
    expect(OFFLINE_CACHE_MAX_AGE).toBe(24 * 60 * 60 * 1000);
    const now = Date.parse('2026-08-30T18:00:00.000Z');
    expect(isOfflineCacheExpired(now - OFFLINE_CACHE_MAX_AGE, now)).toBe(false);
    expect(isOfflineCacheExpired(now - OFFLINE_CACHE_MAX_AGE - 1, now)).toBe(true);
    expect(isOfflineCacheExpired(now + 1, now)).toBe(true);
    const state = {
      mutations: [],
      queries: [
        {
          queryHash: 'next',
          queryKey: ['offline', userId, 'next-match'],
          state: { data: nextMatch, dataUpdatedAt: Date.parse(cachedAt), status: 'success' },
        },
      ],
    } as unknown as DehydratedState;

    expect(parsePersistedOfflineState(state, userId)).toEqual(state);
    expect(
      parsePersistedOfflineState({ ...state, mutations: [{}] } as DehydratedState, userId),
    ).toBeNull();
    expect(
      parsePersistedOfflineState(
        {
          ...state,
          queries: [{ ...state.queries[0], queryKey: ['private', 'profile'] }],
        } as DehydratedState,
        userId,
      ),
    ).toBeNull();
  });

  it('exclui mutations de forma absoluta, inclusive pausadas', () => {
    expect(shouldDehydrateOfflineMutation({} as Mutation)).toBe(false);
    expect(shouldDehydrateOfflineMutation({ state: { isPaused: true } } as Mutation)).toBe(false);
  });
});
