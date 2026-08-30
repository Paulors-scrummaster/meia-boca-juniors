interface EdgeScope {
  setContext(name: string, context: Record<string, unknown>): void;
  setTag(name: string, value: string): void;
  setUser(user: { id: string }): void;
}

interface EdgeSentryClient {
  captureException(error: unknown): string;
  flush(timeout: number): Promise<boolean>;
  withScope<T>(callback: (scope: EdgeScope) => T | Promise<T>): T | Promise<T>;
}

export interface EdgeMonitoringContext {
  functionName: string;
  role?: string | undefined;
  traceId: string;
  userId?: string | undefined;
}

export interface EdgeMonitoring {
  captureAndFlush(error: unknown, context: EdgeMonitoringContext): Promise<string | undefined>;
}

function safeError(error: unknown): Error {
  const type = error instanceof Error && error.name ? error.name : 'Error';
  const sanitized = new Error('Edge Function failure (details removed).');
  sanitized.name = type;
  return sanitized;
}

export function createEdgeMonitoring(sentry: EdgeSentryClient): EdgeMonitoring {
  return {
    async captureAndFlush(error, context) {
      try {
        let eventId: string | undefined;
        await sentry.withScope(async (scope) => {
          scope.setTag('trace_id', context.traceId);
          scope.setTag('function', context.functionName);
          if (context.role) scope.setTag('role', context.role);
          if (context.userId) scope.setUser({ id: context.userId });
          eventId = sentry.captureException(safeError(error));
        });
        await sentry.flush(2_000);
        return eventId;
      } catch {
        return undefined;
      }
    },
  };
}

export async function initializeEdgeMonitoring(): Promise<EdgeMonitoring | undefined> {
  const runtime = globalThis as typeof globalThis & {
    Deno?: { env: { get(name: string): string | undefined } };
  };
  const dsn = runtime.Deno?.env.get('SENTRY_DSN');
  const environment = runtime.Deno?.env.get('APP_ENV');
  if (!dsn || !['staging', 'production'].includes(environment ?? '')) return undefined;

  const moduleName = 'npm:@sentry/deno@^8';
  const sentry = (await import(/* @vite-ignore */ moduleName)) as EdgeSentryClient & {
    init(options: Record<string, unknown>): void;
  };
  sentry.init({
    beforeSend(event: unknown) {
      return event;
    },
    defaultIntegrations: false,
    dsn,
    environment,
    release: runtime.Deno?.env.get('SENTRY_RELEASE'),
    sendDefaultPii: false,
    tracesSampleRate: environment === 'production' ? 0.05 : 0.1,
  });
  return createEdgeMonitoring(sentry);
}
