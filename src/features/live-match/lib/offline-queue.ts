// Feature 003 · US3 (Súmula Live) · T065
// Fila offline da súmula — wrapper próprio fino sobre IndexedDB (R8, sem lib
// `idb`). Uma única store `pending_events`, chave = `clientEventId` (UUID v4
// gerado no clique). É a ÚNICA exceção offline-write aprovada (Constituição
// Princípio V, desvio registrado no plan); nenhum outro módulo pode reusar.
//
// Semântica:
//  - `enqueue` deduplica pela chave (segundo clique com o mesmo id é no-op);
//  - `drain` reenvia em ordem de `createdAtMs` e para no primeiro erro,
//    preservando a ordem para a próxima tentativa;
//  - `attachOnlineDrain` dispara `drain` no evento `online` do navegador.

import type { Database } from '@/shared/types/database.generated';

export type LiveEventType = Database['public']['Enums']['live_event_type'];
export type TeamSide = Database['public']['Enums']['team_side'];

export interface PendingLiveEvent {
  athleteId: string;
  clientEventId: string;
  createdAtMs: number;
  eventType: LiveEventType;
  matchId: string;
  minute: number;
  targetAthleteId: string | null;
  teamSide: TeamSide;
}

export interface OfflineDrainResult {
  remaining: number;
  sent: number;
}

export interface OfflineQueue {
  clear(): Promise<void>;
  count(): Promise<number>;
  drain(send: (event: PendingLiveEvent) => Promise<void>): Promise<OfflineDrainResult>;
  enqueue(event: EnqueueInput): Promise<boolean>;
  list(): Promise<PendingLiveEvent[]>;
  remove(clientEventId: string): Promise<void>;
}

export type EnqueueInput = Omit<PendingLiveEvent, 'createdAtMs'> & { createdAtMs?: number };

export interface OfflineQueueOptions {
  dbName?: string;
  factory?: IDBFactory;
}

const DEFAULT_DB_NAME = 'mbj-live-sumula';
const DB_VERSION = 1;
const STORE = 'pending_events';

function toPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function openDatabase(factory: IDBFactory, dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(dbName, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'clientEventId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
}

function isConstraintError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'ConstraintError';
}

export function createOfflineQueue(options: OfflineQueueOptions = {}): OfflineQueue {
  const dbName = options.dbName ?? DEFAULT_DB_NAME;
  const factory = options.factory ?? globalThis.indexedDB;
  let dbPromise: Promise<IDBDatabase> | null = null;

  function db(): Promise<IDBDatabase> {
    if (!factory) {
      return Promise.reject(new Error('IndexedDB is unavailable in this environment'));
    }
    dbPromise ??= openDatabase(factory, dbName);
    return dbPromise;
  }

  async function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const connection = await db();
    const tx = connection.transaction(STORE, mode);
    const result = await run(tx.objectStore(STORE));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    });
    return result;
  }

  return {
    async clear() {
      await withStore('readwrite', (store) => toPromise(store.clear()));
    },
    async count() {
      return withStore('readonly', (store) => toPromise(store.count()));
    },
    async drain(send) {
      const pending = await this.list();
      let sent = 0;
      for (const event of pending) {
        try {
          await send(event);
        } catch {
          break;
        }
        await this.remove(event.clientEventId);
        sent += 1;
      }
      return { remaining: await this.count(), sent };
    },
    async enqueue(event) {
      const row: PendingLiveEvent = {
        athleteId: event.athleteId,
        clientEventId: event.clientEventId,
        createdAtMs: event.createdAtMs ?? Date.now(),
        eventType: event.eventType,
        matchId: event.matchId,
        minute: event.minute,
        targetAthleteId: event.targetAthleteId,
        teamSide: event.teamSide,
      };
      try {
        await withStore('readwrite', (store) => toPromise(store.add(row)));
        return true;
      } catch (error) {
        if (isConstraintError(error)) return false;
        throw error;
      }
    },
    async list() {
      const rows = await withStore('readonly', (store) =>
        toPromise(store.getAll() as IDBRequest<PendingLiveEvent[]>),
      );
      return rows.sort((a, b) => a.createdAtMs - b.createdAtMs);
    },
    async remove(clientEventId) {
      await withStore('readwrite', (store) => toPromise(store.delete(clientEventId)));
    },
  };
}

/**
 * Liga o `drain` ao evento `online` do navegador. Devolve a função de limpeza.
 * No-op fora do browser (SSR / testes sem window).
 */
export function attachOnlineDrain(
  queue: OfflineQueue,
  send: (event: PendingLiveEvent) => Promise<void>,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    void queue.drain(send);
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
