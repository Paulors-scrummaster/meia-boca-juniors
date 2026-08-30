// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import { createEdgeMonitoring } from '../_shared/monitoring';

describe('Edge Function monitoring', () => {
  it('usa escopo isolado por requisição, contexto sanitizado e flush limitado', async () => {
    const captureException = vi.fn().mockReturnValue('event-id');
    const flush = vi.fn().mockResolvedValue(true);
    const setContext = vi.fn();
    const setTag = vi.fn();
    const setUser = vi.fn();
    const withScope = vi.fn(async (callback) => callback({ setContext, setTag, setUser }));
    const monitoring = createEdgeMonitoring({ captureException, flush, withScope });

    const eventId = await monitoring.captureAndFlush(new Error('provider token=secret'), {
      functionName: 'push-identity',
      role: 'ATHLETE',
      traceId: '00000000-0000-4000-8000-000000000001',
      userId: 'technical-uuid',
    });

    expect(eventId).toBe('event-id');
    expect(withScope).toHaveBeenCalledOnce();
    expect(setUser).toHaveBeenCalledWith({ id: 'technical-uuid' });
    expect(setTag).toHaveBeenCalledWith('trace_id', '00000000-0000-4000-8000-000000000001');
    expect(setTag).toHaveBeenCalledWith('function', 'push-identity');
    expect(setTag).toHaveBeenCalledWith('role', 'ATHLETE');
    expect(setContext).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ token: expect.anything() }),
    );
    expect(flush).toHaveBeenCalledWith(2_000);
  });

  it('não transforma falha do monitoramento em falha da função', async () => {
    const monitoring = createEdgeMonitoring({
      captureException: vi.fn(() => {
        throw new Error('monitor unavailable');
      }),
      flush: vi.fn().mockRejectedValue(new Error('flush unavailable')),
      withScope: vi.fn(async (callback) =>
        callback({ setContext: vi.fn(), setTag: vi.fn(), setUser: vi.fn() }),
      ),
    });

    await expect(
      monitoring.captureAndFlush(new Error('business failure'), {
        functionName: 'dispatch-notifications',
        traceId: '00000000-0000-4000-8000-000000000001',
      }),
    ).resolves.toBeUndefined();
  });
});
