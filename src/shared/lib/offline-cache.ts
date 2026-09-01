import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { DehydratedState, Mutation, Query } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

import { offlineNextMatchSchema, offlinePublishedLineupSchema } from '@/shared/types/offline-cache';

export const OFFLINE_CACHE_VERSION = 1 as const;
export const OFFLINE_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export interface OfflineCacheIdentity {
  clubId: string;
  deploymentId: string;
  userId: string;
}

type CleanupHook = () => Promise<void> | void;

const cleanupHooks = new Map<string, Set<CleanupHook>>();

function safeSegment(value: string): string {
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9-]+$/.test(normalized)) {
    throw new Error('Identificador de cache offline inválido.');
  }
  return normalized;
}

export function createOfflineStorageKey(identity: OfflineCacheIdentity): string {
  return [
    'mbj:query-cache',
    `v${OFFLINE_CACHE_VERSION}`,
    safeSegment(identity.deploymentId),
    safeSegment(identity.clubId),
    safeSegment(identity.userId),
  ].join(':');
}

export function createOfflineBuster(identity: OfflineCacheIdentity): string {
  return [
    'offline',
    `v${OFFLINE_CACHE_VERSION}`,
    safeSegment(identity.deploymentId),
    safeSegment(identity.clubId),
    safeSegment(identity.userId),
  ].join(':');
}

export function isOfflineCacheExpired(timestamp: number, now = Date.now()): boolean {
  return timestamp > now || now - timestamp > OFFLINE_CACHE_MAX_AGE;
}

function isExactNextMatchKey(queryKey: readonly unknown[], userId: string): boolean {
  return (
    queryKey.length === 3 &&
    queryKey[0] === 'offline' &&
    queryKey[1] === userId &&
    queryKey[2] === 'next-match'
  );
}

function isExactPublishedLineupKey(queryKey: readonly unknown[], userId: string): boolean {
  return (
    queryKey.length === 4 &&
    queryKey[0] === 'offline' &&
    queryKey[1] === userId &&
    queryKey[2] === 'published-lineup' &&
    typeof queryKey[3] === 'string' &&
    queryKey[3].length > 0
  );
}

function isAllowedData(queryKey: readonly unknown[], data: unknown, userId: string): boolean {
  if (isExactNextMatchKey(queryKey, userId)) {
    return offlineNextMatchSchema.safeParse(data).success;
  }
  if (isExactPublishedLineupKey(queryKey, userId)) {
    const parsed = offlinePublishedLineupSchema.safeParse(data);
    return parsed.success && parsed.data.matchId === queryKey[3];
  }
  return false;
}

export function shouldPersistOfflineQuery(query: Query, userId: string): boolean {
  if (query.state.status !== 'success') return false;
  if (isExactNextMatchKey(query.queryKey, userId)) {
    return (
      query.meta?.persistOffline === 'next-match' &&
      isAllowedData(query.queryKey, query.state.data, userId)
    );
  }
  if (isExactPublishedLineupKey(query.queryKey, userId)) {
    return (
      query.meta?.persistOffline === 'published-lineup' &&
      isAllowedData(query.queryKey, query.state.data, userId)
    );
  }
  return false;
}

export function shouldDehydrateOfflineMutation(mutation: Mutation): boolean {
  void mutation;
  return false;
}

export function parsePersistedOfflineState(
  state: DehydratedState,
  userId: string,
): DehydratedState | null {
  if (!Array.isArray(state.mutations) || state.mutations.length !== 0) return null;
  if (!Array.isArray(state.queries)) return null;

  for (const query of state.queries) {
    if (!isAllowedData(query.queryKey, query.state.data, userId)) return null;
  }
  return state;
}

export function createOfflinePersister(
  identity: OfflineCacheIdentity,
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): Persister {
  const key = createOfflineStorageKey(identity);
  const base = createSyncStoragePersister({ key, storage, throttleTime: 0 });

  return {
    persistClient: (client) => base.persistClient(client),
    removeClient: () => base.removeClient(),
    async restoreClient() {
      const restored = await base.restoreClient();
      if (!restored) return undefined;
      if (isOfflineCacheExpired(restored.timestamp)) {
        await base.removeClient();
        return undefined;
      }
      const state = parsePersistedOfflineState(restored.clientState, identity.userId);
      if (!state) {
        await base.removeClient();
        return undefined;
      }
      return { ...restored, clientState: state } satisfies PersistedClient;
    },
  };
}

export function registerOfflineCleanup(userId: string, hook: CleanupHook): () => void {
  const hooks = cleanupHooks.get(userId) ?? new Set<CleanupHook>();
  hooks.add(hook);
  cleanupHooks.set(userId, hooks);
  return () => {
    hooks.delete(hook);
    if (hooks.size === 0) cleanupHooks.delete(userId);
  };
}

export async function purgeRegisteredOfflineState(userId: string): Promise<void> {
  const hooks = [...(cleanupHooks.get(userId) ?? [])];
  for (const hook of hooks) await hook();
}
