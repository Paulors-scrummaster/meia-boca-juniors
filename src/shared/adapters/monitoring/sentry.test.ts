import { describe, expect, it } from 'vitest';

import { createMonitoringOptions, sanitizeSentryEvent } from '@/shared/adapters/monitoring/sentry';

describe('Sentry browser adapter', () => {
  it('habilita somente staging/production com PII e Replay desativados', () => {
    expect(
      createMonitoringOptions({ appEnv: 'test', dsn: 'https://public@sentry.test/1' }),
    ).toBeNull();

    const options = createMonitoringOptions({
      appEnv: 'production',
      dsn: 'https://public@sentry.test/1',
      release: 'commit-sha',
    });

    expect(options).toMatchObject({
      enabled: true,
      environment: 'production',
      release: 'commit-sha',
      replaysOnErrorSampleRate: 0,
      replaysSessionSampleRate: 0,
      sendDefaultPii: false,
      tracesSampleRate: 0.05,
    });
  });

  it('remove credenciais e dados pessoais de todo o evento antes do envio', () => {
    const sanitized = sanitizeSentryEvent({
      breadcrumbs: [
        {
          data: { email: 'player@example.test', route: '/app/matches', token: 'secret' },
          message: 'Falha para player@example.test com token=secret',
        },
      ],
      extra: {
        absenceReason: 'informação privada',
        nested: { invitationLink: 'https://example.test/?token=secret', safeCode: 'CONFLICT' },
      },
      request: {
        cookies: { session: 'secret' },
        headers: { authorization: 'Bearer secret', 'content-type': 'application/json' },
        url: 'https://app.test/convite?token=secret#private',
      },
      tags: { role: 'ATHLETE', trace_id: '00000000-0000-4000-8000-000000000001' },
      user: {
        email: 'player@example.test',
        id: 'technical-uuid',
        ip_address: '127.0.0.1',
        username: 'Player',
      },
    });
    const serialized = JSON.stringify(sanitized);

    expect(sanitized.user).toEqual({ id: 'technical-uuid' });
    expect(sanitized.request?.url).toBe('https://app.test/convite');
    expect(sanitized.request?.headers).toEqual({ 'content-type': 'application/json' });
    expect(serialized).not.toContain('player@example.test');
    expect(serialized).not.toContain('informação privada');
    expect(serialized).not.toContain('Bearer secret');
    expect(serialized).not.toContain('token=secret');
    expect(serialized).toContain('CONFLICT');
    expect(serialized).toContain('ATHLETE');
  });
});
