import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QueryProvider, createAppQueryClient } from '@/app/providers/QueryProvider';
import { AppError } from '@/shared/lib/app-error';

describe('QueryProvider', () => {
  it('não repete falhas de autorização e limita falhas transitórias', () => {
    const client = createAppQueryClient();
    const retry = client.getDefaultOptions().queries?.retry;

    expect(typeof retry).toBe('function');
    expect((retry as (count: number, error: Error) => boolean)(0, new AppError('FORBIDDEN'))).toBe(
      false,
    );
    expect((retry as (count: number, error: Error) => boolean)(0, new Error('transient'))).toBe(
      true,
    );
    expect((retry as (count: number, error: Error) => boolean)(2, new Error('transient'))).toBe(
      false,
    );
  });

  it('configura mutações sem retry e sem pausa offline', () => {
    const options = createAppQueryClient().getDefaultOptions().mutations;

    expect(options?.retry).toBe(false);
    expect(options?.networkMode).toBe('always');
  });

  it('fornece o cliente aos descendentes', () => {
    render(
      <QueryProvider>
        <span>conteúdo consultável</span>
      </QueryProvider>,
    );

    expect(screen.getByText('conteúdo consultável')).toBeInTheDocument();
  });
});
