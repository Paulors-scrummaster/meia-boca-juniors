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
  requiredEdgeEnv,
  requireIdempotencyKey,
  requireUuid,
  type EdgeRequestHandler,
  type IdentitySecurity,
  type SecurityContext,
  withCors,
} from '../_shared/security.ts';
import { createAcceptanceRepository, createAcceptInvitationHandler } from './accept.ts';

type InvitationOperation = 'CREATE' | 'RESEND' | 'REVOKE';
type LinkType = 'invite';

interface GeneratedLink {
  actionLink: string;
  authUserId: string;
}

interface ActiveInvite {
  authUserId: string;
  emailNormalized: string;
  id: string;
}

interface InvitationAuthAdmin {
  disableUser(authUserId: string): Promise<void>;
  generateLink(email: string, type: LinkType): Promise<GeneratedLink>;
}

interface InvitationRepository {
  create(input: {
    actorUserId: string;
    athleteId: string;
    authUserId: string;
    emailNormalized: string;
    idempotencyKey: string;
    traceId: string;
  }): Promise<{ id: string }>;
  findActive(athleteId: string): Promise<ActiveInvite>;
  recordResend?(input: {
    actorUserId: string;
    idempotencyKey: string;
    invitationId: string;
    traceId: string;
  }): Promise<void>;
  revoke(input: {
    actorUserId: string;
    athleteId: string;
    idempotencyKey: string;
    traceId: string;
  }): Promise<{ authUserId: string | null; id: string }>;
}

interface AthleteInvitationsDependencies {
  activationOrigin: string;
  authAdmin: InvitationAuthAdmin;
  repository: InvitationRepository;
  security: IdentitySecurity;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function deliveryLinkForInvitation(
  actionLink: string,
  activationOrigin: string,
  invitationId: string,
) {
  const actionUrl = new URL(actionLink);
  const originUrl = new URL(activationOrigin);
  const secureOrigin =
    originUrl.protocol === 'https:' ||
    (originUrl.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(originUrl.hostname));
  if (!secureOrigin || originUrl.username || originUrl.password) {
    throw new EdgeFunctionError('INTERNAL_ERROR');
  }

  const activationUrl = new URL('/convite', originUrl.origin);
  activationUrl.searchParams.set('invitationId', invitationId);
  actionUrl.searchParams.set('redirect_to', activationUrl.toString());
  return actionUrl.toString();
}

function operation(value: unknown): InvitationOperation {
  if (value === 'CREATE' || value === 'RESEND' || value === 'REVOKE') return value;
  throw new EdgeFunctionError('VALIDATION_ERROR', undefined, {
    operation: 'Selecione uma operação válida.',
  });
}

function normalizedEmail(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized.length > 320 || !emailPattern.test(normalized)) {
    throw new EdgeFunctionError('VALIDATION_ERROR', undefined, {
      email: 'Informe um e-mail válido.',
    });
  }
  return normalized;
}

export function createAthleteInvitationsHandler(
  dependencies: AthleteInvitationsDependencies,
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
        maximumAttempts: 10,
        scope: 'identity:invitation-management',
        windowSeconds: 3600,
      });

      const body = await readJsonObject(request);
      const selectedOperation = operation(body.operation);
      const athleteId = requireUuid(body.athleteId, 'athleteId');
      const idempotencyKey = requireIdempotencyKey(body.idempotencyKey);

      if (selectedOperation === 'CREATE') {
        const email = normalizedEmail(body.email);
        const generated = await dependencies.authAdmin.generateLink(email, 'invite');
        try {
          const invitation = await dependencies.repository.create({
            actorUserId: context.userId,
            athleteId,
            authUserId: generated.authUserId,
            emailNormalized: email,
            idempotencyKey,
            traceId: context.traceId,
          });
          return jsonSuccess(
            {
              deliveryLink: deliveryLinkForInvitation(
                generated.actionLink,
                dependencies.activationOrigin,
                invitation.id,
              ),
              invitationId: invitation.id,
              logicalStatus: 'PENDING',
            },
            context.traceId,
          );
        } catch (error) {
          await dependencies.authAdmin.disableUser(generated.authUserId).catch(() => undefined);
          throw error;
        }
      }

      if (selectedOperation === 'RESEND') {
        const invitation = await dependencies.repository.findActive(athleteId);
        const generated = await dependencies.authAdmin.generateLink(
          invitation.emailNormalized,
          'invite',
        );
        await dependencies.repository.recordResend?.({
          actorUserId: context.userId,
          idempotencyKey,
          invitationId: invitation.id,
          traceId: context.traceId,
        });
        return jsonSuccess(
          {
            deliveryLink: deliveryLinkForInvitation(
              generated.actionLink,
              dependencies.activationOrigin,
              invitation.id,
            ),
            invitationId: invitation.id,
            logicalStatus: 'PENDING',
          },
          context.traceId,
        );
      }

      const invitation = await dependencies.repository.revoke({
        actorUserId: context.userId,
        athleteId,
        idempotencyKey,
        traceId: context.traceId,
      });
      if (invitation.authUserId) {
        await dependencies.authAdmin.disableUser(invitation.authUserId);
      }
      return jsonSuccess(
        { invitationId: invitation.id, logicalStatus: 'REVOKED' },
        context.traceId,
      );
    } catch (error) {
      return jsonFailure(error, context?.traceId);
    }
  };
}

function createAuthAdmin(client: SupabaseClient): InvitationAuthAdmin {
  return {
    async disableUser(authUserId) {
      const { error } = await client.auth.admin.updateUserById(authUserId, {
        ban_duration: '876000h',
      });
      if (error) throw new EdgeFunctionError('INTEGRATION_UNAVAILABLE', error);
    },
    async generateLink(email, type) {
      const { data, error } = await client.auth.admin.generateLink({ email, type });
      if (error || !data.properties?.action_link || !data.user?.id) {
        throw new EdgeFunctionError('INTEGRATION_UNAVAILABLE', error);
      }
      return { actionLink: data.properties.action_link, authUserId: data.user.id };
    },
  };
}

function createRepository(client: SupabaseClient): InvitationRepository {
  return {
    async create(input) {
      const { data, error } = await client.rpc('create_identity_invite', {
        actor_user_id: input.actorUserId,
        athlete_uuid: input.athleteId,
        command_idempotency_key: input.idempotencyKey,
        invitation_auth_user_id: input.authUserId,
        normalized_email: input.emailNormalized,
        request_trace_id: input.traceId,
      });
      if (error) throw error;
      const invitationId = (data as { invitationId?: unknown } | null)?.invitationId;
      if (typeof invitationId !== 'string') throw new EdgeFunctionError('INTERNAL_ERROR');
      return { id: invitationId };
    },
    async findActive(athleteId) {
      const { data, error } = await client
        .from('athlete_invites')
        .select('id, auth_user_id, email_normalized')
        .eq('athlete_id', athleteId)
        .is('redeemed_at', null)
        .is('revoked_at', null)
        .maybeSingle();
      if (error) throw error;
      if (!data?.auth_user_id) throw new EdgeFunctionError('NOT_FOUND');
      return {
        authUserId: data.auth_user_id,
        emailNormalized: data.email_normalized,
        id: data.id,
      };
    },
    async recordResend(input) {
      const { error } = await client.rpc('record_identity_invite_resend', {
        actor_user_id: input.actorUserId,
        command_idempotency_key: input.idempotencyKey,
        invitation_uuid: input.invitationId,
        request_trace_id: input.traceId,
      });
      if (error) throw error;
    },
    async revoke(input) {
      const { data, error } = await client.rpc('revoke_identity_invite', {
        actor_user_id: input.actorUserId,
        athlete_uuid: input.athleteId,
        command_idempotency_key: input.idempotencyKey,
        request_trace_id: input.traceId,
      });
      if (error) throw error;
      const result = data as { authUserId?: unknown; invitationId?: unknown } | null;
      if (typeof result?.invitationId !== 'string') throw new EdgeFunctionError('INTERNAL_ERROR');
      return {
        authUserId: typeof result.authUserId === 'string' ? result.authUserId : null,
        id: result.invitationId,
      };
    },
  };
}

const runtime = edgeRuntime();
if (runtime) {
  const serviceClient = createServiceClient();
  const security = createDefaultIdentitySecurity();
  const manageHandler = createAthleteInvitationsHandler({
    activationOrigin: requiredEdgeEnv('CANONICAL_ORIGIN'),
    authAdmin: createAuthAdmin(serviceClient),
    repository: createRepository(serviceClient),
    security,
  });
  const acceptHandler = createAcceptInvitationHandler({
    repository: createAcceptanceRepository(),
    security,
  });
  runtime.serve(
    withCors(
      (request) =>
        new URL(request.url).pathname.endsWith('/accept')
          ? acceptHandler(request)
          : manageHandler(request),
      configuredOrigins(),
    ),
  );
}
