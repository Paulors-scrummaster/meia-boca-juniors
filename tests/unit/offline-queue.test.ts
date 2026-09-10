import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  attachOnlineDrain,
  createOfflineQueue,
  type EnqueueInput,
  type OfflineQueue,
} from '@/features/live-match/lib/offline-queue';

const MATCH = '00000000-0000-4000-8000-000000000abc';

function pending(overrides: Partial<EnqueueInput> = {}): EnqueueInput {
  return {
    athleteId: '00000000-0000-4000-8000-0000000000a1',
    clientEventId: globalThis.crypto.randomUUID(),
    eventType: 'GOAL',
    matchId: MATCH,
    minute: 10,
    targetAthleteId: null,
    teamSide: 'MBJ',
    ...overrides,
  };
}

let queue: OfflineQueue;

beforeEach(() => {
  queue = createOfflineQueue({ dbName: `test-${globalThis.crypto.randomUUID()}` });
});

describe('offline-queue', () => {
  it('reports an empty store', async () => {
    expect(await queue.count()).toBe(0);
    expect(await queue.list()).toEqual([]);
    expect(await queue.drain(vi.fn())).toEqual({ remaining: 0, sent: 0 });
  });

  it('adds an event', async () => {
    const event = pending({ createdAtMs: 1 });
    expect(await queue.enqueue(event)).toBe(true);
    expect(await queue.count()).toBe(1);
    const [stored] = await queue.list();
    expect(stored.clientEventId).toBe(event.clientEventId);
    expect(stored.createdAtMs).toBe(1);
  });

  it('deduplicates by clientEventId', async () => {
    const id = globalThis.crypto.randomUUID();
    expect(await queue.enqueue(pending({ clientEventId: id, minute: 10 }))).toBe(true);
    expect(await queue.enqueue(pending({ clientEventId: id, minute: 77 }))).toBe(false);
    expect(await queue.count()).toBe(1);
    const [stored] = await queue.list();
    expect(stored.minute).toBe(10); // a primeira escrita prevalece
  });

  it('drains in createdAtMs order and clears sent rows', async () => {
    await queue.enqueue(pending({ clientEventId: 'c', createdAtMs: 300, minute: 3 }));
    await queue.enqueue(pending({ clientEventId: 'a', createdAtMs: 100, minute: 1 }));
    await queue.enqueue(pending({ clientEventId: 'b', createdAtMs: 200, minute: 2 }));

    const seen: string[] = [];
    const result = await queue.drain(async (event) => {
      seen.push(event.clientEventId);
    });

    expect(seen).toEqual(['a', 'b', 'c']);
    expect(result).toEqual({ remaining: 0, sent: 3 });
    expect(await queue.count()).toBe(0);
  });

  it('stops draining at the first failure and preserves order', async () => {
    await queue.enqueue(pending({ clientEventId: 'a', createdAtMs: 100 }));
    await queue.enqueue(pending({ clientEventId: 'b', createdAtMs: 200 }));
    await queue.enqueue(pending({ clientEventId: 'c', createdAtMs: 300 }));

    const seen: string[] = [];
    const result = await queue.drain(async (event) => {
      seen.push(event.clientEventId);
      if (event.clientEventId === 'b') throw new Error('offline again');
    });

    expect(seen).toEqual(['a', 'b']);
    expect(result).toEqual({ remaining: 2, sent: 1 });
    expect((await queue.list()).map((row) => row.clientEventId)).toEqual(['b', 'c']);
  });

  it('removes and clears', async () => {
    await queue.enqueue(pending({ clientEventId: 'x', createdAtMs: 1 }));
    await queue.enqueue(pending({ clientEventId: 'y', createdAtMs: 2 }));
    await queue.remove('x');
    expect((await queue.list()).map((row) => row.clientEventId)).toEqual(['y']);
    await queue.clear();
    expect(await queue.count()).toBe(0);
  });

  it('drains on the browser online event', async () => {
    await queue.enqueue(pending({ clientEventId: 'z', createdAtMs: 1 }));
    const send = vi.fn().mockResolvedValue(undefined);
    const detach = attachOnlineDrain(queue, send);

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(async () => {
      expect(send).toHaveBeenCalledTimes(1);
      expect(await queue.count()).toBe(0);
    });

    detach();
    window.dispatchEvent(new Event('online'));
    expect(send).toHaveBeenCalledTimes(1); // não dispara após o detach
  });
});
