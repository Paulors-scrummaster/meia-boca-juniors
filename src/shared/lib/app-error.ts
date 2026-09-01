export const appErrorMessages = {
  UNAUTHENTICATED: 'Entre na sua conta para continuar.',
  MFA_REQUIRED: 'Confirme a verificação em duas etapas para continuar.',
  FORBIDDEN: 'Você não tem permissão para realizar esta ação.',
  ACCOUNT_DISABLED: 'Esta conta está desativada.',
  NOT_FOUND: 'O registro solicitado não foi encontrado.',
  VALIDATION_ERROR: 'Revise os campos informados.',
  CONFLICT: 'Não foi possível concluir porque os dados foram alterados.',
  DEADLINE_CLOSED: 'O prazo para esta ação foi encerrado.',
  MATCH_LOCKED: 'A partida está bloqueada para alterações.',
  OFFLINE: 'Conecte-se à internet para realizar esta ação.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  INTEGRATION_UNAVAILABLE: 'O serviço externo está indisponível no momento.',
  INTERNAL_ERROR: 'Não foi possível concluir a operação. Tente novamente.',
} as const;

export type AppErrorCode = keyof typeof appErrorMessages;
export type FieldErrors = Readonly<Record<string, string>>;

export interface AppErrorOptions {
  fieldErrors?: FieldErrors;
  traceId?: string | undefined;
}

export interface AppErrorResponse {
  error: {
    code: AppErrorCode;
    message: string;
    fieldErrors: FieldErrors;
  };
  traceId: string;
}

const traceIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createTraceId(): string {
  return globalThis.crypto.randomUUID();
}

function safeTraceId(value?: string): string | undefined {
  return value && traceIdPattern.test(value) ? value : undefined;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly fieldErrors: FieldErrors;
  readonly traceId: string | undefined;

  constructor(code: AppErrorCode, options: AppErrorOptions = {}) {
    super(appErrorMessages[code]);
    this.name = 'AppError';
    this.code = code;
    this.fieldErrors = Object.freeze({ ...options.fieldErrors });
    this.traceId = safeTraceId(options.traceId);
  }

  toResponse(): AppErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        fieldErrors: this.fieldErrors,
      },
      traceId: this.traceId ?? createTraceId(),
    };
  }
}

export function mapToAppError(error: unknown, options: AppErrorOptions = {}): AppError {
  if (error instanceof AppError) {
    if (error.traceId || !options.traceId) {
      return error;
    }

    return new AppError(error.code, {
      fieldErrors: error.fieldErrors,
      traceId: options.traceId,
    });
  }

  return new AppError('INTERNAL_ERROR', { traceId: options.traceId });
}
