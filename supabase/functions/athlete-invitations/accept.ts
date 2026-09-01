import { createClient } from '@supabase/supabase-js';

import {
  EdgeFunctionError,
  jsonFailure,
  jsonSuccess,
  readJsonObject,
  requiredEdgeEnv,
  requireUuid,
  type EdgeRequestHandler,
  type IdentityRole,
  type IdentitySecurity,
  type SecurityContext,
} from '../_shared/security.ts';

interface AcceptanceResult {
  athleteId: string;
  mustChangePassword: boolean;
  roles: IdentityRole[];
}

interface AcceptanceRepository {
  accept(input: {
    accessToken: string;
    authenticatedUserId: string;
    invitationId: string;
    traceId: string;
  }): Promise<AcceptanceResult>;
}

interface AcceptInvitationDependencies {
  repository: AcceptanceRepository;
  security: IdentitySecurity;
}

export function createAcceptInvitationHandler(
  dependencies: AcceptInvitationDependencies,
): EdgeRequestHandler {
  return async (request) => {
    let context: SecurityContext | undefined;
    try {
      if (request.method !== 'POST') throw new EdgeFunctionError('VALIDATION_ERROR');
      context = await dependencies.security.authorize(request, { allowUnactivatedProfile: true });
      await dependencies.security.consumeRateLimit(context, {
        maximumAttempts: 10,
        scope: 'identity:invitation-acceptance',
        windowSeconds: 900,
      });
      const body = await readJsonObject(request);
      const invitationId = requireUuid(body.invitationId, 'invitationId');
      const result = await dependencies.repository.accept({
        accessToken: context.accessToken,
        authenticatedUserId: context.userId,
        invitationId,
        traceId: context.traceId,
      });
      return jsonSuccess(result, context.traceId);
    } catch (error) {
      return jsonFailure(error, context?.traceId);
    }
  };
}

export function createAcceptanceRepository(): AcceptanceRepository {
  return {
    async accept(input) {
      const client = createClient(
        requiredEdgeEnv('SUPABASE_URL'),
        requiredEdgeEnv('SUPABASE_ANON_KEY'),
        {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: `Bearer ${input.accessToken}` } },
        },
      );
      const { data, error } = await client.rpc('accept_athlete_invitation', {
        invitation_uuid: input.invitationId,
        request_trace_id: input.traceId,
      });
      if (error) throw error;
      const result = data as Partial<AcceptanceResult> | null;
      if (
        typeof result?.athleteId !== 'string' ||
        typeof result.mustChangePassword !== 'boolean' ||
        !Array.isArray(result.roles)
      ) {
        throw new EdgeFunctionError('INTERNAL_ERROR');
      }
      return {
        athleteId: result.athleteId,
        mustChangePassword: result.mustChangePassword,
        roles: result.roles,
      };
    },
  };
}
