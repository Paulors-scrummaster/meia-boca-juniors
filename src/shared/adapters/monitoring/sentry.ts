import * as Sentry from '@sentry/react';
import type { BrowserOptions, Event } from '@sentry/react';

import { env } from '@/config/env';

type MonitoringEnvironment = 'development' | 'test' | 'staging' | 'production';

interface MonitoringConfig {
  appEnv: MonitoringEnvironment;
  dsn?: string | undefined;
  release?: string | undefined;
  supabaseUrl?: string | undefined;
}

const sensitiveKeyPattern =
  /^(authorization|cookie|cookies|password|passwd|secret|token|access_token|refresh_token|invite|invitation|invitation_link|invitationlink|reason|absence_reason|absencereason|justification|email|e-mail|name|full_name|fullname|shirt_name|shirtname|username|ip|ip_address)$/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const bearerPattern = /bearer\s+[a-z0-9._~+/=-]+/gi;
const credentialParameterPattern = /([?&#](?:token|code|invite|secret|password)=)[^&#\s]+/gi;
const inlineCredentialPattern =
  /\b(token|code|invite|secret|password|authorization)\s*[:=]\s*[^\s,;&#]+/gi;

function cleanUrl(value: string): string {
  try {
    const url = new URL(value, globalThis.location?.origin ?? 'https://invalid.local');
    url.search = '';
    url.hash = '';
    return url.origin === 'https://invalid.local'
      ? url.pathname
      : url.toString().replace(/\/$/, '');
  } catch {
    return value.split(/[?#]/, 1)[0] ?? '';
  }
}

function cleanText(value: string): string {
  return value
    .replace(emailPattern, '[redacted-email]')
    .replace(bearerPattern, 'Bearer [redacted]')
    .replace(credentialParameterPattern, '$1[redacted]')
    .replace(inlineCredentialPattern, '$1=[redacted]');
}

function sanitizeValue(value: unknown, key?: string): unknown {
  if (key && sensitiveKeyPattern.test(key)) return undefined;
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item)).filter((item) => item !== undefined);
  }
  if (!value || typeof value !== 'object') return value;

  const sanitized: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    const nextValue = sanitizeValue(entryValue, entryKey);
    if (nextValue !== undefined) sanitized[entryKey] = nextValue;
  }
  return sanitized;
}

export function sanitizeSentryEvent(event: Event): Event {
  const sanitized = sanitizeValue(event) as Event;

  if (event.user?.id) sanitized.user = { id: String(event.user.id) };
  else delete sanitized.user;

  if (event.request) {
    const request = (sanitizeValue(event.request) as NonNullable<Event['request']>) ?? {};
    delete request.headers;
    if (event.request.headers?.['content-type'] || event.request.headers?.['Content-Type']) {
      request.headers = {
        'content-type': String(
          event.request.headers['content-type'] ?? event.request.headers['Content-Type'],
        ),
      };
    }
    if (event.request.url) request.url = cleanUrl(event.request.url);
    else delete request.url;
    sanitized.request = request;
  }

  if (sanitized.exception?.values) {
    sanitized.exception.values = sanitized.exception.values.map((exception) => ({
      ...exception,
      value: 'Erro capturado (detalhes removidos).',
    }));
  }

  if (sanitized.breadcrumbs) {
    sanitized.breadcrumbs = sanitized.breadcrumbs.map((breadcrumb) =>
      breadcrumb.message
        ? { ...breadcrumb, message: cleanText(breadcrumb.message) }
        : { ...breadcrumb },
    );
  }

  return sanitized;
}

export function createMonitoringOptions(config: MonitoringConfig): BrowserOptions | null {
  if (!['staging', 'production'].includes(config.appEnv) || !config.dsn) return null;

  const traceTargets = ['self'];
  if (config.supabaseUrl) traceTargets.push(config.supabaseUrl);

  return {
    beforeSend: (event) => sanitizeSentryEvent(event) as typeof event,
    dsn: config.dsn,
    enabled: true,
    environment: config.appEnv,
    integrations: [Sentry.browserTracingIntegration()],
    propagateTraceparent: true,
    release: config.release,
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
    tracePropagationTargets: traceTargets,
    tracesSampleRate: config.appEnv === 'production' ? 0.05 : 0.1,
  };
}

let initialized = false;

export function initializeMonitoring(): boolean {
  if (initialized) return true;
  const options = createMonitoringOptions({
    appEnv: env.VITE_APP_ENV,
    dsn: env.VITE_SENTRY_DSN,
    release: env.VITE_SENTRY_RELEASE,
    supabaseUrl: env.VITE_SUPABASE_URL,
  });
  if (!options) return false;
  Sentry.init(options);
  initialized = true;
  return true;
}

export function captureMonitoringException(
  error: unknown,
  context: {
    role?: string | undefined;
    traceId?: string | undefined;
    userId?: string | undefined;
  } = {},
): string {
  const traceId = context.traceId ?? globalThis.crypto.randomUUID();

  if (!initialized) return traceId;
  Sentry.withScope((scope) => {
    scope.setTag('trace_id', traceId);
    if (context.role) scope.setTag('role', context.role);
    if (context.userId) scope.setUser({ id: context.userId });
    Sentry.captureException(error);
  });
  return traceId;
}
