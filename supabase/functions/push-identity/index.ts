import {
  configuredOrigins,
  createDefaultIdentitySecurity,
  edgeRuntime,
  jsonFailure,
  jsonSuccess,
  requiredEdgeEnv,
  type IdentitySecurity,
  withCors,
} from '../_shared/security.ts';

export interface PushIdentitySigner {
  issue(input: { expiresInSeconds: number; externalId: string }): Promise<string>;
}

interface PushIdentityDependencies {
  security: IdentitySecurity;
  signer: PushIdentitySigner;
}

function base64Url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createHmacPushIdentitySigner(secret: string, appId: string): PushIdentitySigner {
  return {
    async issue({ expiresInSeconds, externalId }) {
      const now = Math.floor(Date.now() / 1000);
      const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const payload = base64Url(
        JSON.stringify({ exp: now + expiresInSeconds, iat: now, iss: appId, sub: externalId }),
      );
      const unsigned = `${header}.${payload}`;
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { hash: 'SHA-256', name: 'HMAC' },
        false,
        ['sign'],
      );
      const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned));
      return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
    },
  };
}

export function createPushIdentityHandler({ security, signer }: PushIdentityDependencies) {
  return async (request: Request): Promise<Response> => {
    let traceId: string | undefined;
    try {
      if (request.method !== 'POST') return new Response(null, { status: 405 });
      const context = await security.authorize(request);
      traceId = context.traceId;
      await security.consumeRateLimit(context, {
        maximumAttempts: 30,
        scope: 'notifications:push-identity',
        windowSeconds: 3600,
      });
      const identityToken = await signer.issue({
        expiresInSeconds: 300,
        externalId: context.userId,
      });
      return jsonSuccess({ externalId: context.userId, identityToken }, context.traceId);
    } catch (error) {
      return jsonFailure(error, traceId);
    }
  };
}

function createDefaultHandler() {
  return createPushIdentityHandler({
    security: createDefaultIdentitySecurity(),
    signer: createHmacPushIdentitySigner(
      requiredEdgeEnv('ONESIGNAL_IDENTITY_VERIFICATION_KEY'),
      requiredEdgeEnv('ONESIGNAL_APP_ID'),
    ),
  });
}

const runtime = edgeRuntime();
if (runtime) runtime.serve(withCors(createDefaultHandler(), configuredOrigins()));
