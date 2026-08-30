import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from '@/app/providers/ErrorBoundary';

vi.mock('@/shared/adapters/monitoring/sentry', () => ({
  captureMonitoringException: vi.fn(() => '00000000-0000-4000-8000-000000000777'),
}));

function BrokenComponent(): never {
  throw new Error('player@example.test token=secret');
}

describe('ErrorBoundary', () => {
  it('mostra uma falha segura com identificador técnico estável', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível exibir esta página');
    expect(screen.getByText(/00000000-0000-4000-8000-000000000777/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('player@example.test');
    expect(document.body.textContent).not.toContain('token=secret');
  });
});
