export interface PushMessage {
  body: string;
  externalId: string;
  route: string;
  title: string;
}

export interface PushSendResult {
  providerMessageId: string | null;
}

export interface PushProvider {
  send(message: PushMessage): Promise<PushSendResult>;
}

export class PushProviderError extends Error {
  readonly code: string;
  readonly permanent: boolean;

  constructor(code: string, permanent: boolean, cause?: unknown) {
    super('O provedor de notificações não concluiu o envio.', { cause });
    this.name = 'PushProviderError';
    this.code = /^[A-Z][A-Z0-9_]{2,63}$/.test(code) ? code : 'PROVIDER_ERROR';
    this.permanent = permanent;
  }
}

export function createForcedFailurePushProvider(code = 'PROVIDER_UNAVAILABLE'): PushProvider {
  return {
    async send() {
      throw new PushProviderError(code, false);
    },
  };
}
