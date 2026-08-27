import { createServer, type Server } from 'node:http';

import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import { createAuthService } from '../../src/features/auth/api/auth.service';
import { AppError, appErrorMessages } from '../../src/shared/lib/app-error';

test('maps a local Auth HTTP 429 to the stable safe Portuguese error', async () => {
  let server: Server | undefined;

  try {
    const address = await new Promise<{ port: number }>((resolve) => {
      server = createServer((_request, response) => {
        response.writeHead(429, { 'content-type': 'application/json' });
        response.end(
          JSON.stringify({
            code: 'over_request_rate_limit',
            message: 'provider throttle details must never reach the user',
          }),
        );
      });
      server.listen(0, '127.0.0.1', () => {
        const value = server?.address();
        if (!value || typeof value === 'string')
          throw new Error('Local Auth server did not start.');
        resolve({ port: value.port });
      });
    });
    const client = createClient(`http://127.0.0.1:${address.port}`, 'local-anon-key', {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const auth = createAuthService(client);

    const failure = await auth
      .signInWithPassword({ email: 'rate-limit@example.test', password: 'irrelevant' })
      .then(() => null)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AppError);
    expect((failure as AppError).code).toBe('RATE_LIMITED');
    expect((failure as AppError).message).toBe(appErrorMessages.RATE_LIMITED);
    expect((failure as AppError).message).not.toContain('provider throttle details');
  } finally {
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
