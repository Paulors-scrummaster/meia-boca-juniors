import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAppQueryClient } from '@/app/providers/QueryProvider';
import type {
  AttendanceService,
  PresenceSummary,
} from '@/features/attendance/api/attendance.service';
import { PresenceResponsePanel } from '@/features/attendance/components/PresenceResponsePanel';
import { RefusalReasonModal } from '@/features/attendance/components/RefusalReasonModal';
import { AttendanceDashboardPage } from '@/features/attendance/pages/AttendanceDashboardPage';
import {
  resetConnectivityForTests,
  setConnectivityForTests,
} from '@/shared/hooks/use-connectivity';

const presence: PresenceSummary = {
  applicable_deadline: '2026-08-28T18:00:00.000Z',
  athlete_id: '00000000-0000-4000-8000-000000010101',
  athlete_name: 'Atleta Teste',
  call_revision: 1,
  call_status: 'CALLED',
  individual_deadline: null,
  is_exceptional_call: false,
  match_id: '00000000-0000-4000-8000-000000010201',
  presence_id: '00000000-0000-4000-8000-000000010301',
  presence_status: 'PENDING',
  reason: null,
  responded_at: null,
};

function service(overrides: Partial<AttendanceService> = {}): AttendanceService {
  return {
    adminSetPresence: vi.fn().mockResolvedValue(presence),
    createExceptionalCall: vi.fn(),
    getMyPresence: vi.fn().mockResolvedValue(presence),
    listStaffAttendance: vi.fn().mockResolvedValue([presence]),
    respondToCall: vi.fn().mockResolvedValue({ ...presence, presence_status: 'CONFIRMED' }),
    setMatchCallups: vi.fn(),
    ...overrides,
  };
}

function renderAttendance(node: React.ReactNode, isOnline = true) {
  setConnectivityForTests(isOnline);
  return render(<QueryClientProvider client={createAppQueryClient()}>{node}</QueryClientProvider>);
}

describe('attendance', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetConnectivityForTests();
  });
  it('renders the authoritative applicable deadline in São Paulo time', async () => {
    renderAttendance(<PresenceResponsePanel matchId={presence.match_id} service={service()} />);
    expect(await screen.findByText(/Prazo para responder:/)).toHaveTextContent('28/08/2026');
  });

  it('requires and normalizes a refusal reason before submission', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderAttendance(
      <RefusalReasonModal
        open
        onClose={vi.fn()}
        onSubmit={onSubmit}
        presenceId={presence.presence_id}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar recusa' }));
    expect(await screen.findByText('Informe o motivo da recusa.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Motivo da recusa'), '  Compromisso   familiar  ');
    await user.click(screen.getByRole('button', { name: 'Confirmar recusa' }));
    expect(onSubmit).toHaveBeenCalledWith('Compromisso familiar');
  });

  it('denies writes in the UI while offline without queueing a mutation', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    const respondToCall = vi.fn();
    renderAttendance(
      <PresenceResponsePanel matchId={presence.match_id} service={service({ respondToCall })} />,
      false,
    );
    expect(await screen.findByRole('button', { name: 'Confirmar presença' })).toBeDisabled();
    expect(screen.getByText('Reconecte-se à internet para responder à convocação.')).toBeVisible();
    expect(respondToCall).not.toHaveBeenCalled();
  });

  it('updates staff state after an administrative override', async () => {
    const user = userEvent.setup();
    const adminSetPresence = vi.fn().mockResolvedValue({
      ...presence,
      presence_status: 'CONFIRMED',
    });
    renderAttendance(
      <AttendanceDashboardPage
        matchId={presence.match_id}
        service={service({ adminSetPresence })}
      />,
    );
    expect(await screen.findByText('Atleta Teste')).toBeVisible();
    await user.selectOptions(screen.getByLabelText('Estado de Atleta Teste'), 'CONFIRMED');
    await user.type(
      screen.getByLabelText('Explicação da alteração de Atleta Teste'),
      'Contato por telefone',
    );
    await user.click(screen.getByRole('button', { name: 'Salvar presença de Atleta Teste' }));
    expect(adminSetPresence).toHaveBeenCalledWith({
      athleteId: presence.athlete_id,
      explanation: 'Contato por telefone',
      matchId: presence.match_id,
      reason: null,
      status: 'CONFIRMED',
    });
  });
});
