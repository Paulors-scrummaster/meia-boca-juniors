import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

import {
  AppError,
  appErrorMessages,
  type AppErrorCode,
  type AppErrorResponse,
} from '@/shared/lib/app-error';
import type { Database, Json } from '@/shared/types/database.generated';

type AppRole = Database['public']['Enums']['app_role'];

export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthenticatedSession {
  session: Session;
  user: User;
}

export interface InvitationManagementInput {
  athleteId: string;
  email?: string;
  idempotencyKey: string;
  operation: 'CREATE' | 'RESEND' | 'REVOKE';
}

export interface InvitationManagementResult {
  deliveryLink?: string;
  invitationId: string;
  logicalStatus: 'PENDING' | 'REVOKED';
}

export interface InvitationAcceptanceResult {
  athleteId: string;
  mustChangePassword: boolean;
  roles: AppRole[];
}

export interface MfaEnrollmentResult {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

export interface MfaFactor {
  factorId: string;
  friendlyName: string | null;
  status: 'verified' | 'unverified';
}

export interface AuthService {
  acceptInvitation(invitationId: string): Promise<InvitationAcceptanceResult>;
  challengeMfa(factorId: string, code: string): Promise<void>;
  changePassword(password: string): Promise<void>;
  enrollMfa(friendlyName?: string): Promise<MfaEnrollmentResult>;
  getMfaFactors(): Promise<MfaFactor[]>;
  getRoles(userId?: string): Promise<AppRole[]>;
  manageInvitation(input: InvitationManagementInput): Promise<InvitationManagementResult>;
  resetPassword(input: {
    idempotencyKey: string;
    temporaryPassword: string;
    userId: string;
  }): Promise<void>;
  setRole(input: { assigned: boolean; role: AppRole; userId: string }): Promise<AppRole[]>;
  signInWithPassword(input: SignInInput): Promise<AuthenticatedSession>;
  signOut(): Promise<void>;
}

interface FunctionEnvelope<T> {
  data: T;
  traceId: string;
}

const stableCodes = new Set<AppErrorCode>(Object.keys(appErrorMessages) as AppErrorCode[]);

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if ('status' in error && typeof error.status === 'number') return error.status;
  if ('statusCode' in error && typeof error.statusCode === 'number') return error.statusCode;
  if ('context' in error && error.context instanceof Response) return error.context.status;
  return undefined;
}

async function responseAppError(error: unknown): Promise<AppError | null> {
  if (!error || typeof error !== 'object' || !('context' in error)) return null;
  if (!(error.context instanceof Response)) return null;

  try {
    const payload = (await error.context.clone().json()) as Partial<AppErrorResponse>;
    const code = payload.error?.code;
    if (code && stableCodes.has(code)) {
      return new AppError(code, {
        fieldErrors: payload.error?.fieldErrors ?? {},
        ...(payload.traceId ? { traceId: payload.traceId } : {}),
      });
    }
  } catch {
    return null;
  }
  return null;
}

async function mapAuthFailure(error: unknown): Promise<AppError> {
  if (error instanceof AppError) return error;
  const status = errorStatus(error);
  if (status === 429) return new AppError('RATE_LIMITED');

  const safeResponseError = await responseAppError(error);
  if (safeResponseError) return safeResponseError;

  const code =
    error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
  if (code === 'over_request_rate_limit') return new AppError('RATE_LIMITED');
  if (code === 'invalid_credentials' || status === 401) return new AppError('UNAUTHENTICATED');
  if (status === 403) return new AppError('FORBIDDEN');
  if (status === 409) return new AppError('CONFLICT');
  if (status === 400 || status === 422) return new AppError('VALIDATION_ERROR');
  return new AppError('INTERNAL_ERROR');
}

async function requireNoError(error: unknown): Promise<void> {
  if (error) throw await mapAuthFailure(error);
}

function parseEnvelope<T>(value: unknown): FunctionEnvelope<T> {
  if (!value || typeof value !== 'object' || !('data' in value) || !('traceId' in value)) {
    throw new AppError('INTERNAL_ERROR');
  }
  return value as FunctionEnvelope<T>;
}

function parseRoles(value: Json | null): AppRole[] {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('roles' in value)) {
    throw new AppError('INTERNAL_ERROR');
  }
  const roles = value.roles;
  if (
    !Array.isArray(roles) ||
    roles.some((role) => role !== 'PRESIDENT' && role !== 'COACH' && role !== 'ATHLETE')
  ) {
    throw new AppError('INTERNAL_ERROR');
  }
  return roles as AppRole[];
}

export function createAuthService(client: SupabaseClient<Database>): AuthService {
  async function invoke<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
    const { data, error } = await client.functions.invoke(functionName, { body });
    await requireNoError(error);
    return parseEnvelope<T>(data).data;
  }

  return {
    async acceptInvitation(invitationId) {
      return invoke<InvitationAcceptanceResult>('athlete-invitations/accept', { invitationId });
    },

    async challengeMfa(factorId, code) {
      const challenge = await client.auth.mfa.challenge({ factorId });
      await requireNoError(challenge.error);
      const challengeId = challenge.data?.id;
      if (!challengeId) throw new AppError('INTERNAL_ERROR');
      const verification = await client.auth.mfa.verify({ challengeId, code, factorId });
      await requireNoError(verification.error);
    },

    async changePassword(password) {
      const update = await client.auth.updateUser({ password });
      await requireNoError(update.error);
      const completion = await client.rpc('complete_forced_password_change', {
        request_trace_id: crypto.randomUUID(),
      });
      await requireNoError(completion.error);
    },

    async enrollMfa(friendlyName) {
      const { data, error } = await client.auth.mfa.enroll({
        factorType: 'totp',
        ...(friendlyName ? { friendlyName } : {}),
      });
      await requireNoError(error);
      if (!data?.id || !data.totp) throw new AppError('INTERNAL_ERROR');
      return {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      };
    },

    async getMfaFactors() {
      const { data, error } = await client.auth.mfa.listFactors();
      await requireNoError(error);
      return (data?.all ?? [])
        .filter((factor) => factor.factor_type === 'totp')
        .map((factor) => ({
          factorId: factor.id,
          friendlyName: factor.friendly_name ?? null,
          status: factor.status,
        }));
    },

    async getRoles(userId) {
      if (userId) {
        const { data, error } = await client.rpc('get_user_roles', {
          target_user_id: userId,
        });
        await requireNoError(error);
        return parseRoles(data);
      }
      const query = client.from('user_roles').select('role');
      const { data, error } = await query;
      await requireNoError(error);
      return (data ?? []).map(({ role }) => role);
    },

    async manageInvitation(input) {
      return invoke<InvitationManagementResult>('athlete-invitations/manage', { ...input });
    },

    async resetPassword(input) {
      await invoke<{ mustChangePassword: boolean; userId: string }>('admin-reset-password', {
        ...input,
      });
    },

    async setRole(input) {
      const { data, error } = await client.rpc('set_user_role', {
        request_trace_id: crypto.randomUUID(),
        should_assign: input.assigned,
        target_role: input.role,
        target_user_id: input.userId,
      });
      await requireNoError(error);
      return parseRoles(data);
    },

    async signInWithPassword(input) {
      const { data, error } = await client.auth.signInWithPassword(input);
      await requireNoError(error);
      if (!data.session || !data.user) throw new AppError('UNAUTHENTICATED');
      return { session: data.session, user: data.user };
    },

    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' });
      await requireNoError(error);
    },
  };
}
