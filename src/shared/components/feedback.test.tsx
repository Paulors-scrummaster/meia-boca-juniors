import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  ConfirmationDialog,
  EmptyState,
  ErrorState,
  LoadingState,
  ToastRegion,
} from '@/shared/components/feedback';

describe('feedback components', () => {
  it('expõe estados de carregamento, erro e vazio para tecnologia assistiva', () => {
    const { rerender } = render(<LoadingState label="Carregando elenco" />);
    expect(screen.getByRole('status')).toHaveTextContent('Carregando elenco');

    rerender(<ErrorState message="Falha segura" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Falha segura');

    rerender(<EmptyState title="Nenhuma partida" />);
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma partida');
  });

  it('oferece confirmação explícita com cancelar e confirmar', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open
        title="Confirmar alteração"
        description="Esta ação será registrada."
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole('alertdialog')).toHaveAccessibleName('Confirmar alteração');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('anuncia toasts sem interromper a navegação', () => {
    render(<ToastRegion toasts={[{ id: '1', message: 'Alteração salva.', tone: 'success' }]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Alteração salva.');
  });
});
