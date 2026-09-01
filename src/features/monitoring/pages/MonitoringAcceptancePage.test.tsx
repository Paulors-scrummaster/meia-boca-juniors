import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MonitoringAcceptancePage } from '@/features/monitoring/pages/MonitoringAcceptancePage';
import { captureMonitoringException } from '@/shared/adapters/monitoring/sentry';

vi.mock('@/shared/adapters/monitoring/sentry', () => ({
  captureMonitoringException: vi.fn(() => 'synthetic-trace-id'),
}));

describe('MonitoringAcceptancePage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emits only the controlled staging error after an explicit click', async () => {
    const user = userEvent.setup();
    render(<MonitoringAcceptancePage />);

    expect(captureMonitoringException).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Emitir erro controlado' }));

    expect(captureMonitoringException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'T175 controlled staging monitoring check' }),
      { role: 'PRESIDENT' },
    );
    expect(screen.getByRole('status')).toHaveTextContent('synthetic-trace-id');
  });
});
