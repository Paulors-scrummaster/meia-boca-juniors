import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type IdentityRole = 'PRESIDENT' | 'COACH' | 'ATHLETE';
export type EdgeErrorCode =
  | 'UNAUTHENTICATED'
  | 'MFA_REQUIRED'
  | 'FORBIDDEN'
  | 'ACCOUNT_DISABLED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTEGRATION_UNAVAILABLE'
  | 'INTERNAL_ERROR';

const safeMessages: Record<EdgeErrorCode, string> = {
  UNAUTHENTICATED: 'Entre na sua conta para continuar.',
  MFA_REQUIRED: 'Confirme a verificação em duas etapas para continuar.',
  FORBIDDEN: 'Você não tem permissão para realizar esta ação.',
  ACCOUNT_DISABLED: 'Esta conta está desativada.',
  NOT_FOUND: 'O registro solicitado não foi encontrado.',
  VALIDATION_ERROR: 'Revise os campos informados.',
  CONFLICT: 'Não foi possível concluir porque os dados foram alterados.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  INTEGRATION_UNAVAILABLE: 'O serviço externo está indisponível no momento.',
  INTERNAL_ERROR: 'Não foi possível concluir a operação. Tente novamente.',
};

const httpStatuses: Record<EdgeErrorCode, number> = {
  UNAUTHENTICATED: 401,
  MFA_REQUIRED: 403,
  FORBIDDEN: 403,
  ACCOUNT_DISABLED: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTEGRATION_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class EdgeFunctionError extends Error {
  readonly code: EdgeErrorCode;
  readonly fieldErrors: Readonly<Record<string, string>>;

  constructor(
    code: EdgeErrorCode,
    _internalCause?: unknown,
    fieldErrors: Readonly<Record<string, string>> = {},
  ) {
    super(safeMessages[code]);
    this.name = 'EdgeFunctionError';
    this.code = code;
    this.fieldErrors = Object.freeze({ ...fieldErrors });
  }
}

export interface SecurityContext {
  accessToken: string;
  isAal2: boolean;
  roles: IdentityRole[];
  traceId: string;
  userId: string;
}

export interface AuthorizationRequirements {
  allowUnactivatedProfile?: boolean;
  requireAal2?: boolean;
  requiredRole?: IdentityRole;
}

export interface RateLimitPolicy {
  maximumAttempts: number;
  scope: string;
  windowSeconds: number;
}

export interface IdentitySecurity {
  authorize(request: Request, requirements?: AuthorizationRequirements): Promise<SecurityContext>;
  consumeRateLimit(context: SecurityContext, policy: RateLimitPolicy): Promise<void>;
}

interface IdentitySecurityConfig {
  anonKey: string;
  serviceRoleKey: string;
  supabaseUrl: string;
}

interface ProfileRow {
  account_status: 'ACTIVE' | 'DISABLED';
}

interface RoleRow {
  role: IdentityRole;
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) throw new EdgeFunctionError('UNAUTHENTICATED');
  return match[1];
}

function jwtAssuranceLevel(accessToken: string): 'aal1' | 'aal2' {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return 'aal1';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')),
    ) as {
      aal?: unknown;
    };
    return decoded.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

function requestTraceId(request: Request): string {
  const requested = request.headers.get('x-trace-id');
  return requested && uuidPattern.test(requested) ? requested : crypto.randomUUID();
}

export function createIdentitySecurity(config: IdentitySecurityConfig): IdentitySecurity {
  const serviceClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    async authorize(request, requirements = {}) {
      const accessToken = bearerToken(request);
      const verifier = createClient(config.supabaseUrl, config.anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await verifier.auth.getUser(accessToken);
      if (error || !data.user) throw new EdgeFunctionError('UNAUTHENTICATED', error);

      const context: SecurityContext = {
        accessToken,
        isAal2: jwtAssuranceLevel(accessToken) === 'aal2',
        roles: [],
        traceId: requestTraceId(request),
        userId: data.user.id,
      };

      const [profileResult, rolesResult] = await Promise.all([
        serviceClient
          .from('profiles')
          .select('account_status')
          .eq('id', data.user.id)
          .maybeSingle<ProfileRow>(),
        serviceClient.from('user_roles').select('role').eq('user_id', data.user.id),
      ]);

      if (profileResult.error || rolesResult.error) {
        throw new EdgeFunctionError('INTERNAL_ERROR', profileResult.error ?? rolesResult.error);
      }

      if (!profileResult.data) {
        if (requirements.allowUnactivatedProfile) return context;
        throw new EdgeFunctionError('UNAUTHENTICATED');
      }
      if (profileResult.data.account_status === 'DISABLED') {
        throw new EdgeFunctionError('ACCOUNT_DISABLED');
      }

      context.roles = ((rolesResult.data ?? []) as RoleRow[]).map(({ role }) => role);

      if (requirements.requiredRole && !context.roles.includes(requirements.requiredRole)) {
        throw new EdgeFunctionError('FORBIDDEN');
      }
      if (requirements.requireAal2 && !context.isAal2) {
        throw new EdgeFunctionError('MFA_REQUIRED');
      }

      return context;
    },

    async consumeRateLimit(context, policy) {
      const { data, error } = await serviceClient.rpc('consume_identity_rate_limit', {
        counter_scope: policy.scope,
        maximum_attempts: policy.maximumAttempts,
        subject_key: context.userId,
        window_seconds: policy.windowSeconds,
      });
      if (error) throw new EdgeFunctionError('INTERNAL_ERROR', error);
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.allowed) throw new EdgeFunctionError('RATE_LIMITED');
    },
  };
}

export function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new EdgeFunctionError('VALIDATION_ERROR', undefined, {
      [field]: 'Informe um identificador válido.',
    });
  }
  return value;
}

export function requireIdempotencyKey(value: unknown): string {
  return requireUuid(value, 'idempotencyKey');
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = (await request.json()) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('invalid body');
    return value as Record<string, unknown>;
  } catch (error) {
    throw new EdgeFunctionError('VALIDATION_ERROR', error);
  }
}

export function mapEdgeError(error: unknown): EdgeFunctionError {
  if (error instanceof EdgeFunctionError) return error;

  const databaseCode =
    error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
  if (databaseCode === '42501') return new EdgeFunctionError('FORBIDDEN', error);
  if (databaseCode === 'P0002' || databaseCode === 'PGRST116') {
    return new EdgeFunctionError('NOT_FOUND', error);
  }
  if (databaseCode === '23505' || databaseCode === '23514' || databaseCode === 'P0001') {
    return new EdgeFunctionError('CONFLICT', error);
  }
  if (databaseCode === '22023') return new EdgeFunctionError('VALIDATION_ERROR', error);
  return new EdgeFunctionError('INTERNAL_ERROR', error);
}

export function jsonSuccess(data: unknown, traceId: string, headers: HeadersInit = {}): Response {
  return Response.json(
    { data, traceId },
    { headers: { 'cache-control': 'no-store', ...headers }, status: 200 },
  );
}

export function jsonFailure(
  error: unknown,
  traceId = crypto.randomUUID(),
  headers: HeadersInit = {},
): Response {
  const safeError = mapEdgeError(error);
  return Response.json(
    {
      error: {
        code: safeError.code,
        fieldErrors: safeError.fieldErrors,
        message: safeMessages[safeError.code],
      },
      traceId,
    },
    {
      headers: { 'cache-control': 'no-store', ...headers },
      status: httpStatuses[safeError.code],
    },
  );
}

export type EdgeRequestHandler = (request: Request) => Promise<Response>;

export function withCors(handler: EdgeRequestHandler, allowedOrigins: ReadonlySet<string>) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const headers: Record<string, string> = {
      'access-control-allow-headers':
        'authorization, apikey, content-type, x-client-info, x-trace-id',
      'access-control-allow-methods': 'POST, OPTIONS',
      vary: 'Origin',
    };

    if (origin) {
      if (!allowedOrigins.has(origin)) return jsonFailure(new EdgeFunctionError('FORBIDDEN'));
      headers['access-control-allow-origin'] = origin;
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers, status: 204 });

    const response = await handler(request);
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
  };
}

interface EdgeRuntime {
  env: { get(name: string): string | undefined };
  serve(handler: EdgeRequestHandler): void;
}

export function edgeRuntime(): EdgeRuntime | undefined {
  return (globalThis as typeof globalThis & { Deno?: EdgeRuntime }).Deno;
}

export function requiredEdgeEnv(name: string): string {
  const value = edgeRuntime()?.env.get(name);
  if (!value) throw new Error(`Missing required Edge Function environment variable: ${name}`);
  return value;
}

export function configuredOrigins(): ReadonlySet<string> {
  const configured = edgeRuntime()?.env.get('ALLOWED_ORIGINS');
  return new Set(
    (configured ?? 'http://127.0.0.1:5173,http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function createServiceClient(): SupabaseClient {
  return createClient(
    requiredEdgeEnv('SUPABASE_URL'),
    requiredEdgeEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

export function createDefaultIdentitySecurity(): IdentitySecurity {
  return createIdentitySecurity({
    anonKey: requiredEdgeEnv('SUPABASE_ANON_KEY'),
    serviceRoleKey: requiredEdgeEnv('SUPABASE_SERVICE_ROLE_KEY'),
    supabaseUrl: requiredEdgeEnv('SUPABASE_URL'),
  });
}
