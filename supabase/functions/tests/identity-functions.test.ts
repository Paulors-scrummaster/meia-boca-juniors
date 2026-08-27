// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

import {
  EdgeFunctionError,
  type IdentitySecurity,
  type SecurityContext,
} from '../_shared/security';
import { createAdminResetPasswordHandler } from '../admin-reset-password/index';
import { createAcceptInvitationHandler } from '../athlete-invitations/accept';
import { createAthleteInvitationsHandler } from '../athlete-invitations/index';

const traceId = '00000000-0000-4000-8000-000000009999';
const actorUserId = '00000000-0000-4000-8000-000000009001';

function securityContext(): SecurityContext {
  return {
    accessToken: 'verified-access-token',
    isAal2: true,
    roles: ['PRESIDENT'],
    traceId,
    userId: actorUserId,
  };
}

function security(overrides: Partial<IdentitySecurity> = {}): IdentitySecurity {
  return {
    authorize: vi.fn().mockResolvedValue(securityContext()),
    consumeRateLimit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function responseBody(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe('identity Edge Function contracts', () => {
  it('returns a safe unauthenticated failure without provider details', async () => {
    const handler = createAthleteInvitationsHandler({
      authAdmin: { disableUser: vi.fn(), generateLink: vi.fn() },
      repository: { create: vi.fn(), findActive: vi.fn(), revoke: vi.fn() },
      security: security({
        authorize: vi
          .fn()
          .mockRejectedValue(new EdgeFunctionError('UNAUTHENTICATED', 'provider JWT detail')),
      }),
    });

    const response = await handler(
      new Request('http://localhost/functions/v1/athlete-invitations/manage', {
        body: JSON.stringify({ operation: 'CREATE' }),
        method: 'POST',
      }),
    );

    expect(response.status).toBe(401);
    expect(await responseBody(response)).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        fieldErrors: {},
        message: 'Entre na sua conta para continuar.',
      },
      traceId: expect.any(String),
    });
  });

  it('creates a logical invite without persisting or sending the action link', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'invite-id' });
    const generateLink = vi.fn().mockResolvedValue({
      actionLink: 'https://auth.example.test/verify?code=opaque-test-value',
      authUserId: 'auth-user-id',
    });
    const identitySecurity = security();
    const handler = createAthleteInvitationsHandler({
      authAdmin: { disableUser: vi.fn(), generateLink },
      repository: { create, findActive: vi.fn(), revoke: vi.fn() },
      security: identitySecurity,
    });

    const response = await handler(
      new Request('http://localhost/functions/v1/athlete-invitations/manage', {
        body: JSON.stringify({
          athleteId: '00000000-0000-4000-8000-000000009101',
          email: 'Jogador@Example.Test',
          idempotencyKey: '00000000-0000-4000-8000-000000009201',
          operation: 'CREATE',
        }),
        headers: { authorization: 'Bearer verified' },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    expect(generateLink).toHaveBeenCalledWith('jogador@example.test', 'invite');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId,
        authUserId: 'auth-user-id',
        emailNormalized: 'jogador@example.test',
      }),
    );
    expect(JSON.stringify(create.mock.calls)).not.toContain('opaque-test-value');
    expect(await responseBody(response)).toEqual({
      data: {
        deliveryLink: 'https://auth.example.test/verify?code=opaque-test-value',
        invitationId: 'invite-id',
        logicalStatus: 'PENDING',
      },
      traceId,
    });
    expect(identitySecurity.consumeRateLimit).toHaveBeenCalledWith(securityContext(), {
      maximumAttempts: 10,
      scope: 'identity:invitation-management',
      windowSeconds: 3600,
    });
  });

  it('resends with a fresh link and revokes idempotently without product e-mail', async () => {
    const findActive = vi.fn().mockResolvedValue({
      authUserId: 'auth-user-id',
      emailNormalized: 'jogador@example.test',
      id: 'invite-id',
    });
    const generateLink = vi.fn().mockResolvedValue({
      actionLink: 'https://auth.example.test/fresh',
      authUserId: 'auth-user-id',
    });
    const disableUser = vi.fn().mockResolvedValue(undefined);
    const revoke = vi.fn().mockResolvedValue({ authUserId: 'auth-user-id', id: 'invite-id' });
    const handler = createAthleteInvitationsHandler({
      authAdmin: { disableUser, generateLink },
      repository: { create: vi.fn(), findActive, revoke },
      security: security(),
    });
    const base = {
      athleteId: '00000000-0000-4000-8000-000000009101',
      idempotencyKey: '00000000-0000-4000-8000-000000009202',
    };

    const resend = await handler(
      new Request('http://localhost/manage', {
        body: JSON.stringify({ ...base, operation: 'RESEND' }),
        method: 'POST',
      }),
    );
    const revokeResponse = await handler(
      new Request('http://localhost/manage', {
        body: JSON.stringify({ ...base, operation: 'REVOKE' }),
        method: 'POST',
      }),
    );

    expect(generateLink).toHaveBeenCalledWith('jogador@example.test', 'magiclink');
    expect((await responseBody(resend)).data).toEqual({
      deliveryLink: 'https://auth.example.test/fresh',
      invitationId: 'invite-id',
      logicalStatus: 'PENDING',
    });
    expect(revoke).toHaveBeenCalledOnce();
    expect(disableUser).toHaveBeenCalledWith('auth-user-id');
    expect((await responseBody(revokeResponse)).data).toEqual({
      invitationId: 'invite-id',
      logicalStatus: 'REVOKED',
    });
  });

  it('accepts one invitation through the atomic repository boundary', async () => {
    const accept = vi.fn().mockResolvedValue({
      athleteId: 'athlete-id',
      mustChangePassword: false,
      roles: ['ATHLETE'],
    });
    const identitySecurity = security();
    const handler = createAcceptInvitationHandler({
      repository: { accept },
      security: identitySecurity,
    });

    const response = await handler(
      new Request('http://localhost/functions/v1/athlete-invitations/accept', {
        body: JSON.stringify({ invitationId: '00000000-0000-4000-8000-000000009301' }),
        method: 'POST',
      }),
    );

    expect(accept).toHaveBeenCalledWith({
      accessToken: 'verified-access-token',
      authenticatedUserId: actorUserId,
      invitationId: '00000000-0000-4000-8000-000000009301',
      traceId,
    });
    expect(identitySecurity.consumeRateLimit).toHaveBeenCalledWith(securityContext(), {
      maximumAttempts: 10,
      scope: 'identity:invitation-acceptance',
      windowSeconds: 900,
    });
    expect((await responseBody(response)).data).toEqual({
      athleteId: 'athlete-id',
      mustChangePassword: false,
      roles: ['ATHLETE'],
    });
  });

  it('maps an approved invitation rate limit to a safe HTTP 429 response', async () => {
    const handler = createAcceptInvitationHandler({
      repository: { accept: vi.fn() },
      security: security({
        consumeRateLimit: vi
          .fn()
          .mockRejectedValue(new EdgeFunctionError('RATE_LIMITED', 'counter internals')),
      }),
    });

    const response = await handler(
      new Request('http://localhost/accept', {
        body: JSON.stringify({ invitationId: '00000000-0000-4000-8000-000000009301' }),
        method: 'POST',
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(429);
    expect(body).toContain('Muitas tentativas. Aguarde um pouco e tente novamente.');
    expect(body).not.toContain('counter internals');
  });

  it('resets a password with President+AAL2, safe audit completion, and five-per-hour limit', async () => {
    const updatePassword = vi.fn().mockResolvedValue(undefined);
    const complete = vi.fn().mockResolvedValue({ mustChangePassword: true });
    const identitySecurity = security();
    const handler = createAdminResetPasswordHandler({
      authAdmin: { updatePassword },
      repository: { complete },
      security: identitySecurity,
    });

    const response = await handler(
      new Request('http://localhost/functions/v1/admin-reset-password', {
        body: JSON.stringify({
          idempotencyKey: '00000000-0000-4000-8000-000000009401',
          temporaryPassword: 'Temporaria#2026',
          userId: '00000000-0000-4000-8000-000000009402',
        }),
        method: 'POST',
      }),
    );

    expect(updatePassword).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000009402',
      'Temporaria#2026',
    );
    expect(complete).toHaveBeenCalledWith({
      actorUserId,
      idempotencyKey: '00000000-0000-4000-8000-000000009401',
      targetUserId: '00000000-0000-4000-8000-000000009402',
      traceId,
    });
    expect(JSON.stringify(complete.mock.calls)).not.toContain('Temporaria#2026');
    expect(identitySecurity.consumeRateLimit).toHaveBeenCalledWith(securityContext(), {
      maximumAttempts: 5,
      scope: 'identity:admin-password-reset',
      windowSeconds: 3600,
    });
    expect(response.status).toBe(200);
  });

  it('denies administrative reset without AAL2 before touching Auth Admin', async () => {
    const updatePassword = vi.fn();
    const handler = createAdminResetPasswordHandler({
      authAdmin: { updatePassword },
      repository: { complete: vi.fn() },
      security: security({
        authorize: vi.fn().mockRejectedValue(new EdgeFunctionError('MFA_REQUIRED')),
      }),
    });

    const response = await handler(
      new Request('http://localhost/reset', {
        body: JSON.stringify({
          idempotencyKey: '00000000-0000-4000-8000-000000009401',
          temporaryPassword: 'Temporaria#2026',
          userId: '00000000-0000-4000-8000-000000009402',
        }),
        method: 'POST',
      }),
    );

    expect(response.status).toBe(403);
    expect(updatePassword).not.toHaveBeenCalled();
  });
});
