import { describe, expect, it } from 'vitest';

import { AppError, mapToAppError } from '@/shared/lib/app-error';

describe('AppError', () => {
  it('expõe código, mensagem portuguesa, erros de campo e trace ID seguros', () => {
    const error = new AppError('VALIDATION_ERROR', {
      fieldErrors: { shirtNumber: 'Informe um número entre 1 e 99.' },
      traceId: '00000000-0000-4000-8000-000000000001',
    });

    expect(error.toResponse()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Revise os campos informados.',
        fieldErrors: { shirtNumber: 'Informe um número entre 1 e 99.' },
      },
      traceId: '00000000-0000-4000-8000-000000000001',
    });
  });

  it('mapeia falhas desconhecidas sem vazar detalhes internos', () => {
    const error = mapToAppError(new Error('password=segredo; stack interna'), {
      traceId: '00000000-0000-4000-8000-000000000002',
    });

    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('Não foi possível concluir a operação. Tente novamente.');
    expect(JSON.stringify(error.toResponse())).not.toContain('segredo');
  });

  it('preserva erros estáveis e adiciona um trace ID válido quando necessário', () => {
    const original = new AppError('RATE_LIMITED');
    const mapped = mapToAppError(original, {
      traceId: '00000000-0000-4000-8000-000000000003',
    });

    expect(mapped.code).toBe('RATE_LIMITED');
    expect(mapped.traceId).toBe('00000000-0000-4000-8000-000000000003');
  });
});
