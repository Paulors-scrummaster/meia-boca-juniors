// Feature 003 · US3 (Súmula Live) · T068
// Botão "Desfazer" flutuante — só ativo na janela de 30 s após o último evento
// (E-01, SC-005). O servidor também recusa fora da janela (UNDO_WINDOW_EXPIRED).

const UNDO_WINDOW_MS = 30_000;

interface UndoButtonProps {
  lastEventAtMs: number | null;
  nowMs: number;
  onUndo: () => void;
  pending?: boolean;
}

export function UndoButton({ lastEventAtMs, nowMs, onUndo, pending = false }: UndoButtonProps) {
  const remainingMs =
    lastEventAtMs === null ? 0 : Math.max(0, UNDO_WINDOW_MS - (nowMs - lastEventAtMs));
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const disabled = pending || remainingMs <= 0;

  return (
    <div className="fixed bottom-5 right-5 z-40">
      <button
        aria-label="Desfazer último evento"
        className="min-h-12 rounded-full bg-destructive px-5 font-black text-destructive-foreground shadow-lg disabled:opacity-50"
        disabled={disabled}
        onClick={onUndo}
        type="button"
      >
        Desfazer{secondsLeft > 0 ? ` (${secondsLeft}s)` : ''}
      </button>
    </div>
  );
}
