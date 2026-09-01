// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  EdgeFunctionError,
  type IdentitySecurity,
  type SecurityContext,
} from '../_shared/security';
import { createDispatchNotificationsHandler } from '../dispatch-notifications/index';
import { createPushIdentityHandler } from '../push-identity/index';

const traceId = '00000000-0000-4000-8000-000000019999';
const userId = '00000000-0000-4000-8000-000000019001';

function context(): SecurityContext {
  return {
    accessToken: 'verified-access-token',
    isAal2: false,
    roles: ['ATHLETE'],
    traceId,
    userId,
  };
}

function security(overrides: Partial<IdentitySecurity> = {}): IdentitySecurity {
  return {
    authorize: vi.fn().mockResolvedValue(context()),
    consumeRateLimit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function body(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe('notification Edge Function contracts', () => {
  it('derives the verified push external identity from the session and applies thirty per hour', async () => {
    const issue = vi.fn().mockResolvedValue('short-lived-identity-token');
    const identitySecurity = security();
    const handler = createPushIdentityHandler({ security: identitySecurity, signer: { issue } });

    const response = await handler(
      new Request('http://localhost/functions/v1/push-identity', {
        body: JSON.stringify({ externalId: 'attacker-controlled-id' }),
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    expect(issue).toHaveBeenCalledWith({ expiresInSeconds: 300, externalId: userId });
    expect(identitySecurity.consumeRateLimit).toHaveBeenCalledWith(context(), {
      maximumAttempts: 30,
      scope: 'notifications:push-identity',
      windowSeconds: 3600,
    });
    expect(await body(response)).toEqual({
      data: { externalId: userId, identityToken: 'short-lived-identity-token' },
      traceId,
    });
  });

  it('maps push-identity throttling to a safe response', async () => {
    const handler = createPushIdentityHandler({
      security: security({
        consumeRateLimit: vi
          .fn()
          .mockRejectedValue(new EdgeFunctionError('RATE_LIMITED', 'counter detail')),
      }),
      signer: { issue: vi.fn() },
    });

    const response = await handler(
      new Request('http://localhost/push-identity', { method: 'POST' }),
    );
    const serialized = JSON.stringify(await body(response));

    expect(response.status).toBe(429);
    expect(serialized).toContain('RATE_LIMITED');
    expect(serialized).not.toContain('counter detail');
  });

  it('rejects browser dispatch before claiming any work', async () => {
    const claim = vi.fn();
    const handler = createDispatchNotificationsHandler({
      expectedSecret: 'internal-only-secret',
      provider: { send: vi.fn() },
      repository: {
        claim,
        disableSubscription: vi.fn(),
        markFailed: vi.fn(),
        markRetry: vi.fn(),
        markSent: vi.fn(),
        markSkipped: vi.fn(),
      },
    });

    const response = await handler(new Request('http://localhost/dispatch', { method: 'POST' }));

    expect(response.status).toBe(403);
    expect(claim).not.toHaveBeenCalled();
  });

  it('claims a bounded batch and marks successful deliveries without leaking provider data', async () => {
    const claim = vi.fn().mockResolvedValue([
      {
        attemptCount: 0,
        deliveryId: 'delivery-1',
        externalId: userId,
        kind: 'NOTICE_PUBLISHED',
        payload: { body: 'Consulte o mural.', route: '/app/notices', title: 'Novo aviso' },
        subscriptionId: 'opaque-provider-id',
      },
    ]);
    const markSent = vi.fn().mockResolvedValue(undefined);
    const handler = createDispatchNotificationsHandler({
      expectedSecret: 'internal-only-secret',
      provider: { send: vi.fn().mockResolvedValue({ providerMessageId: 'provider-message-id' }) },
      repository: {
        claim,
        disableSubscription: vi.fn(),
        markFailed: vi.fn(),
        markRetry: vi.fn(),
        markSent,
        markSkipped: vi.fn(),
      },
    });

    const response = await handler(
      new Request('http://localhost/dispatch', {
        body: JSON.stringify({ batchSize: 500 }),
        headers: { 'x-dispatch-secret': 'internal-only-secret' },
        method: 'POST',
      }),
    );

    expect(claim).toHaveBeenCalledWith(50);
    expect(markSent).toHaveBeenCalledWith('delivery-1');
    const responseText = await response.text();
    expect(JSON.parse(responseText)).toEqual({
      data: { claimed: 1, failed: 0, retried: 0, sent: 1, skipped: 0 },
      traceId: expect.any(String),
    });
    expect(responseText).not.toContain('opaque-provider-id');
    expect(responseText).not.toContain('provider-message-id');
  });

  it('isolates failures, retries transient errors, and permanently skips invalid subscriptions', async () => {
    const deliveries = [
      {
        attemptCount: 1,
        deliveryId: 'transient',
        externalId: userId,
        kind: 'CALL_UP',
        payload: {},
        subscriptionId: 'sub-1',
      },
      {
        attemptCount: 0,
        deliveryId: 'permanent',
        externalId: userId,
        kind: 'CALL_UP',
        payload: {},
        subscriptionId: 'sub-2',
      },
      {
        attemptCount: 0,
        deliveryId: 'success',
        externalId: userId,
        kind: 'CALL_UP',
        payload: {},
        subscriptionId: 'sub-3',
      },
    ];
    const send = vi
      .fn()
      .mockRejectedValueOnce({ code: 'PROVIDER_UNAVAILABLE', permanent: false })
      .mockRejectedValueOnce({ code: 'SUBSCRIPTION_INVALID', permanent: true })
      .mockResolvedValueOnce({ providerMessageId: 'ok' });
    const markRetry = vi.fn();
    const markSkipped = vi.fn();
    const disableSubscription = vi.fn();
    const markSent = vi.fn();
    const handler = createDispatchNotificationsHandler({
      expectedSecret: 'internal-only-secret',
      now: () => new Date('2026-08-28T12:00:00.000Z'),
      provider: { send },
      repository: {
        claim: vi.fn().mockResolvedValue(deliveries),
        disableSubscription,
        markFailed: vi.fn(),
        markRetry,
        markSent,
        markSkipped,
      },
    });

    const response = await handler(
      new Request('http://localhost/dispatch', {
        headers: { 'x-dispatch-secret': 'internal-only-secret' },
        method: 'POST',
      }),
    );

    expect(markRetry).toHaveBeenCalledWith(
      'transient',
      'PROVIDER_UNAVAILABLE',
      new Date('2026-08-28T12:02:00.000Z'),
    );
    expect(markSkipped).toHaveBeenCalledWith('permanent', 'SUBSCRIPTION_INVALID');
    expect(disableSubscription).toHaveBeenCalledWith('sub-2');
    expect(markSent).toHaveBeenCalledWith('success');
    expect((await body(response)).data).toEqual({
      claimed: 3,
      failed: 0,
      retried: 1,
      sent: 1,
      skipped: 1,
    });
  });

  it('stops after the bounded retry limit and records only a safe error code', async () => {
    const markFailed = vi.fn();
    const handler = createDispatchNotificationsHandler({
      expectedSecret: 'internal-only-secret',
      provider: { send: vi.fn().mockRejectedValue(new Error('raw provider response with token')) },
      repository: {
        claim: vi.fn().mockResolvedValue([
          {
            attemptCount: 4,
            deliveryId: 'exhausted',
            externalId: userId,
            kind: 'CALL_UP',
            payload: {},
            subscriptionId: 'sub-4',
          },
        ]),
        disableSubscription: vi.fn(),
        markFailed,
        markRetry: vi.fn(),
        markSent: vi.fn(),
        markSkipped: vi.fn(),
      },
    });

    const response = await handler(
      new Request('http://localhost/dispatch', {
        headers: { 'x-dispatch-secret': 'internal-only-secret' },
        method: 'POST',
      }),
    );

    expect(markFailed).toHaveBeenCalledWith('exhausted', 'PROVIDER_ERROR');
    const responseBody = await body(response);
    const serialized = JSON.stringify(responseBody);
    expect(serialized).not.toContain('raw provider response');
    expect(responseBody.data).toEqual({ claimed: 1, failed: 1, retried: 0, sent: 0, skipped: 0 });
  });
});
