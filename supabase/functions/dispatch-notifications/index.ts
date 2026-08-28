import {
  PushProviderError,
  type PushMessage,
  type PushProvider,
} from '../../../src/shared/adapters/push/push-adapter.ts';
import {
  createServiceClient,
  edgeRuntime,
  jsonFailure,
  jsonSuccess,
  readJsonObject,
  requiredEdgeEnv,
} from '../_shared/security.ts';

export interface ClaimedNotification {
  attemptCount: number;
  deliveryId: string;
  externalId: string;
  kind: string;
  payload: Record<string, unknown>;
  subscriptionId: string | null;
}

export interface NotificationDispatchRepository {
  claim(limit: number): Promise<ClaimedNotification[]>;
  disableSubscription(subscriptionId: string): Promise<void>;
  markFailed(deliveryId: string, errorCode: string): Promise<void>;
  markRetry(deliveryId: string, errorCode: string, retryAt: Date): Promise<void>;
  markSent(deliveryId: string): Promise<void>;
  markSkipped(deliveryId: string, errorCode: string): Promise<void>;
}

interface DispatchDependencies {
  expectedSecret: string;
  now?: () => Date;
  provider: PushProvider;
  repository: NotificationDispatchRepository;
}

function safeProviderError(error: unknown): { code: string; permanent: boolean } {
  if (error instanceof PushProviderError) return error;
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; permanent?: unknown };
    const code =
      typeof candidate.code === 'string' && /^[A-Z][A-Z0-9_]{2,63}$/.test(candidate.code)
        ? candidate.code
        : 'PROVIDER_ERROR';
    return { code, permanent: candidate.permanent === true };
  }
  return { code: 'PROVIDER_ERROR', permanent: false };
}

function displayMessage(delivery: ClaimedNotification): PushMessage {
  const title =
    typeof delivery.payload.title === 'string' ? delivery.payload.title : 'Meia Boca Juniors';
  const body =
    typeof delivery.payload.body === 'string'
      ? delivery.payload.body
      : 'Você tem uma nova atualização.';
  const route =
    typeof delivery.payload.route === 'string' &&
    /^\/app(?:\/[a-z0-9-]+)*(?:\/[0-9a-f-]+)?$/i.test(delivery.payload.route)
      ? delivery.payload.route
      : '/app';
  return {
    body: body.slice(0, 240),
    externalId: delivery.externalId,
    route,
    title: title.slice(0, 100),
  };
}

export function createDispatchNotificationsHandler({
  expectedSecret,
  now = () => new Date(),
  provider,
  repository,
}: DispatchDependencies) {
  return async (request: Request): Promise<Response> => {
    const traceId = crypto.randomUUID();
    try {
      if (request.method !== 'POST') return new Response(null, { status: 405 });
      if (!expectedSecret || request.headers.get('x-dispatch-secret') !== expectedSecret) {
        return jsonFailure({ code: '42501' }, traceId);
      }

      let batchSize = 25;
      if (request.headers.get('content-length') !== '0' && request.body) {
        const input = await readJsonObject(request);
        if (input.batchSize !== undefined) {
          if (!Number.isInteger(input.batchSize) || Number(input.batchSize) < 1) {
            return jsonFailure({ code: '22023' }, traceId);
          }
          batchSize = Math.min(Number(input.batchSize), 50);
        }
      }

      const deliveries = await repository.claim(batchSize);
      const counts = { claimed: deliveries.length, failed: 0, retried: 0, sent: 0, skipped: 0 };

      for (const delivery of deliveries) {
        if (!delivery.subscriptionId) {
          await repository.markSkipped(delivery.deliveryId, 'NO_ACTIVE_SUBSCRIPTION');
          counts.skipped += 1;
          continue;
        }
        try {
          await provider.send(displayMessage(delivery));
          await repository.markSent(delivery.deliveryId);
          counts.sent += 1;
        } catch (error) {
          const safe = safeProviderError(error);
          if (safe.permanent) {
            await repository.markSkipped(delivery.deliveryId, safe.code);
            await repository.disableSubscription(delivery.subscriptionId);
            counts.skipped += 1;
          } else if (delivery.attemptCount + 1 >= 5) {
            await repository.markFailed(delivery.deliveryId, safe.code);
            counts.failed += 1;
          } else {
            const retryAt = new Date(now().getTime() + 2 ** delivery.attemptCount * 60_000);
            await repository.markRetry(delivery.deliveryId, safe.code, retryAt);
            counts.retried += 1;
          }
        }
      }
      return jsonSuccess(counts, traceId);
    } catch (error) {
      return jsonFailure(error, traceId);
    }
  };
}

export function createOneSignalProvider(config: {
  appId: string;
  canonicalOrigin: string;
  fetcher?: typeof fetch;
  restApiKey: string;
}): PushProvider {
  const fetcher = config.fetcher ?? fetch;
  return {
    async send(message) {
      const response = await fetcher('https://api.onesignal.com/notifications?c=push', {
        body: JSON.stringify({
          app_id: config.appId,
          contents: { en: message.body },
          headings: { en: message.title },
          include_aliases: { external_id: [message.externalId] },
          target_channel: 'push',
          url: new URL(message.route, config.canonicalOrigin).toString(),
        }),
        headers: { Authorization: `Key ${config.restApiKey}`, 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) {
        const permanent = [400, 401, 403, 404, 410].includes(response.status);
        throw new PushProviderError(
          permanent ? 'PROVIDER_REJECTED' : 'PROVIDER_UNAVAILABLE',
          permanent,
        );
      }
      const result = (await response.json()) as { id?: unknown };
      return { providerMessageId: typeof result.id === 'string' ? result.id : null };
    },
  };
}

function createDefaultRepository(): NotificationDispatchRepository {
  const client = createServiceClient();
  async function complete(deliveryId: string, outcome: string, errorCode?: string, retryAt?: Date) {
    const { error } = await client.rpc('complete_notification_delivery', {
      delivery_uuid: deliveryId,
      outcome,
      retry_at: retryAt?.toISOString() ?? null,
      safe_error_code: errorCode ?? null,
    });
    if (error) throw error;
  }
  return {
    async claim(limit) {
      const { data, error } = await client.rpc('claim_notification_deliveries', {
        batch_limit: limit,
      });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        attemptCount: row.attempt_count,
        deliveryId: row.delivery_id,
        externalId: row.external_id,
        kind: row.kind,
        payload: row.payload as Record<string, unknown>,
        subscriptionId: row.subscription_id,
      }));
    },
    async disableSubscription(subscriptionId) {
      const { error } = await client
        .from('push_subscriptions')
        .update({ is_enabled: false })
        .eq('provider_subscription_id', subscriptionId);
      if (error) throw error;
    },
    markFailed: (id, code) => complete(id, 'FAILED', code),
    markRetry: (id, code, retryAt) => complete(id, 'RETRY', code, retryAt),
    markSent: (id) => complete(id, 'SENT'),
    markSkipped: (id, code) => complete(id, 'SKIPPED', code),
  };
}

const runtime = edgeRuntime();
if (runtime) {
  runtime.serve(
    createDispatchNotificationsHandler({
      expectedSecret: requiredEdgeEnv('NOTIFICATION_DISPATCH_SECRET'),
      provider: createOneSignalProvider({
        appId: requiredEdgeEnv('ONESIGNAL_APP_ID'),
        canonicalOrigin: requiredEdgeEnv('CANONICAL_ORIGIN'),
        restApiKey: requiredEdgeEnv('ONESIGNAL_REST_API_KEY'),
      }),
      repository: createDefaultRepository(),
    }),
  );
}
