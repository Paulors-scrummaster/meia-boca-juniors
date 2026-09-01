import type { SupabaseClient } from '@supabase/supabase-js';

import {
  configuredOrigins,
  createDefaultIdentitySecurity,
  createServiceClient,
  edgeRuntime,
  EdgeFunctionError,
  jsonFailure,
  jsonSuccess,
  readJsonObject,
  requireIdempotencyKey,
  requireUuid,
  type EdgeRequestHandler,
  type IdentitySecurity,
  type SecurityContext,
  withCors,
} from '../_shared/security.ts';

interface PasswordAdmin {
  updatePassword(userId: string, temporaryPassword: string): Promise<void>;
}

interface PasswordResetRepository {
  complete(input: {
    actorUserId: string;
    idempotencyKey: string;
    targetUserId: string;
    traceId: string;
  }): Promise<{ mustChangePassword: boolean; sessionsRevoked?: number }>;
}

interface AdminResetPasswordDependencies {
  authAdmin: PasswordAdmin;
  repository: PasswordResetRepository;
  security: IdentitySecurity;
}

function temporaryPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 72) {
    throw new EdgeFunctionError('VALIDATION_ERROR', undefined, {
      temporaryPassword: 'A senha temporária deve ter entre 8 e 72 caracteres.',
    });
  }
  return value;
}

export function createAdminResetPasswordHandler(
  dependencies: AdminResetPasswordDependencies,
): EdgeRequestHandler {
  return async (request) => {
    let context: SecurityContext | undefined;
    try {
      if (request.method !== 'POST') throw new EdgeFunctionError('VALIDATION_ERROR');
      context = await dependencies.security.authorize(request, {
        requireAal2: true,
        requiredRole: 'PRESIDENT',
      });
      await dependencies.security.consumeRateLimit(context, {
        maximumAttempts: 5,
        scope: 'identity:admin-password-reset',
        windowSeconds: 3600,
      });

      const body = await readJsonObject(request);
      const userId = requireUuid(body.userId, 'userId');
      const idempotencyKey = requireIdempotencyKey(body.idempotencyKey);
      const password = temporaryPassword(body.temporaryPassword);

      await dependencies.authAdmin.updatePassword(userId, password);
      const result = await dependencies.repository.complete({
        actorUserId: context.userId,
        idempotencyKey,
        targetUserId: userId,
        traceId: context.traceId,
      });
      return jsonSuccess(
        { mustChangePassword: result.mustChangePassword, userId },
        context.traceId,
      );
    } catch (error) {
      return jsonFailure(error, context?.traceId);
    }
  };
}

function createPasswordAdmin(client: SupabaseClient): PasswordAdmin {
  return {
    async updatePassword(userId, password) {
      const { error } = await client.auth.admin.updateUserById(userId, { password });
      if (error) throw new EdgeFunctionError('INTEGRATION_UNAVAILABLE', error);
    },
  };
}

function createRepository(client: SupabaseClient): PasswordResetRepository {
  return {
    async complete(input) {
      const { data, error } = await client.rpc('complete_admin_password_reset', {
        actor_user_id: input.actorUserId,
        command_idempotency_key: input.idempotencyKey,
        request_trace_id: input.traceId,
        target_user_id: input.targetUserId,
      });
      if (error) throw error;
      const result = data as {
        credentialChangeRequired?: unknown;
        mustChangePassword?: unknown;
        sessionsRevoked?: unknown;
      } | null;
      const credentialChangeRequired =
        result?.credentialChangeRequired ?? result?.mustChangePassword;
      if (typeof credentialChangeRequired !== 'boolean') {
        throw new EdgeFunctionError('INTERNAL_ERROR');
      }
      return {
        mustChangePassword: credentialChangeRequired,
        ...(typeof result.sessionsRevoked === 'number'
          ? { sessionsRevoked: result.sessionsRevoked }
          : {}),
      };
    },
  };
}

const runtime = edgeRuntime();
if (runtime) {
  const serviceClient = createServiceClient();
  runtime.serve(
    withCors(
      createAdminResetPasswordHandler({
        authAdmin: createPasswordAdmin(serviceClient),
        repository: createRepository(serviceClient),
        security: createDefaultIdentitySecurity(),
      }),
      configuredOrigins(),
    ),
  );
}
