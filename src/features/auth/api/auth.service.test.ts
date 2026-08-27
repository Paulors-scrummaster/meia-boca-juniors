import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { createAuthService } from '@/features/auth/api/auth.service';
import type { Database } from '@/shared/types/database.generated';

function clientStub(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      mfa: {
        challenge: vi.fn(),
        enroll: vi.fn(),
        verify: vi.fn(),
      },
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(),
    functions: { invoke: vi.fn() },
    rpc: vi.fn(),
    ...overrides,
  } as unknown as SupabaseClient<Database>;
}

describe('auth service', () => {
  it('uses the typed invitation management and acceptance endpoints', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          data: { invitationId: 'invite-id', logicalStatus: 'PENDING' },
          traceId: crypto.randomUUID(),
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          data: { athleteId: 'athlete-id', mustChangePassword: false, roles: ['ATHLETE'] },
          traceId: crypto.randomUUID(),
        },
        error: null,
      });
    const service = createAuthService(clientStub({ functions: { invoke } }));

    await expect(
      service.manageInvitation({
        athleteId: 'athlete-id',
        email: 'athlete@example.test',
        idempotencyKey: 'idempotency-id',
        operation: 'CREATE',
      }),
    ).resolves.toEqual({ invitationId: 'invite-id', logicalStatus: 'PENDING' });
    await expect(service.acceptInvitation('invite-id')).resolves.toEqual({
      athleteId: 'athlete-id',
      mustChangePassword: false,
      roles: ['ATHLETE'],
    });
    expect(invoke).toHaveBeenNthCalledWith(
      1,
      'athlete-invitations/manage',
      expect.objectContaining({ body: expect.objectContaining({ operation: 'CREATE' }) }),
    );
    expect(invoke).toHaveBeenNthCalledWith(2, 'athlete-invitations/accept', {
      body: { invitationId: 'invite-id' },
    });
  });

  it('enrolls and verifies a TOTP factor through Supabase Auth', async () => {
    const challenge = vi.fn().mockResolvedValue({ data: { id: 'challenge-id' }, error: null });
    const enroll = vi.fn().mockResolvedValue({
      data: {
        id: 'factor-id',
        totp: { qr_code: '<svg />', secret: 'technical-secret', uri: 'otpauth://totp/test' },
      },
      error: null,
    });
    const verify = vi.fn().mockResolvedValue({ data: {}, error: null });
    const service = createAuthService(
      clientStub({
        auth: {
          mfa: { challenge, enroll, verify },
          signInWithPassword: vi.fn(),
          signOut: vi.fn(),
          updateUser: vi.fn(),
        },
      }),
    );

    await expect(service.enrollMfa('Celular principal')).resolves.toEqual({
      factorId: 'factor-id',
      qrCode: '<svg />',
      secret: 'technical-secret',
      uri: 'otpauth://totp/test',
    });
    await expect(service.challengeMfa('factor-id', '123456')).resolves.toBeUndefined();
    expect(verify).toHaveBeenCalledWith({
      challengeId: 'challenge-id',
      code: '123456',
      factorId: 'factor-id',
    });
  });

  it('covers login, roles, forced password change, administrative reset, and local logout', async () => {
    const session = { access_token: 'token' } as Session;
    const user = { id: 'user-id' } as User;
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { session, user }, error: null });
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const invoke = vi.fn().mockResolvedValue({
      data: {
        data: { mustChangePassword: true, userId: 'target-id' },
        traceId: crypto.randomUUID(),
      },
      error: null,
    });
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: { mustChangePassword: false }, error: null })
      .mockResolvedValueOnce({ data: { roles: ['ATHLETE', 'COACH'] }, error: null });
    const select = vi.fn().mockResolvedValue({
      data: [{ role: 'ATHLETE' }, { role: 'COACH' }],
      error: null,
    });
    const service = createAuthService(
      clientStub({
        auth: {
          mfa: { challenge: vi.fn(), enroll: vi.fn(), verify: vi.fn() },
          signInWithPassword,
          signOut,
          updateUser,
        },
        from: vi.fn().mockReturnValue({ select }),
        functions: { invoke },
        rpc,
      }),
    );

    await expect(
      service.signInWithPassword({ email: 'user@example.test', password: 'password' }),
    ).resolves.toEqual({ session, user });
    await expect(service.getRoles()).resolves.toEqual(['ATHLETE', 'COACH']);
    await expect(service.changePassword('NovaSenha#2026')).resolves.toBeUndefined();
    await expect(
      service.setRole({ assigned: true, role: 'COACH', userId: 'target-id' }),
    ).resolves.toEqual(['ATHLETE', 'COACH']);
    await expect(
      service.resetPassword({
        idempotencyKey: 'idempotency-id',
        temporaryPassword: 'Temporaria#2026',
        userId: 'target-id',
      }),
    ).resolves.toBeUndefined();
    await expect(service.signOut()).resolves.toBeUndefined();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
