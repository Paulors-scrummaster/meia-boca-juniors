import { useId, type ReactNode } from 'react';

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = 'Carregando…' }: LoadingStateProps) {
  return (
    <div
      className="flex min-h-32 items-center justify-center gap-3 text-muted-foreground"
      role="status"
    >
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent"
      />
      <span>{label}</span>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  title?: string;
}

export function ErrorState({ message, onRetry, title = 'Algo deu errado' }: ErrorStateProps) {
  return (
    <section className="rounded-xl border border-destructive/40 bg-card p-5" role="alert">
      <h2 className="font-bold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <button
          className="mt-4 min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground"
          onClick={onRetry}
          type="button"
        >
          Tentar novamente
        </button>
      ) : null}
    </section>
  );
}

interface EmptyStateProps {
  description?: string;
  icon?: ReactNode;
  title: string;
}

export function EmptyState({ description, icon, title }: EmptyStateProps) {
  return (
    <section className="rounded-xl border border-dashed bg-card p-8 text-center" role="status">
      {icon ? <div aria-hidden="true">{icon}</div> : null}
      <h2 className="font-bold text-foreground">{title}</h2>
      {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
    </section>
  );
}

interface ConfirmationDialogProps {
  confirmLabel?: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}

export function ConfirmationDialog({
  confirmLabel = 'Confirmar',
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 p-4">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl"
        role="alertdialog"
      >
        <h2 id={titleId} className="text-xl font-black">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-muted-foreground">
          {description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="min-h-11 rounded-lg border bg-card px-4 font-semibold"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            autoFocus
            className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground"
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export interface ToastMessage {
  id: string;
  message: string;
  tone: 'error' | 'info' | 'success';
}

interface ToastRegionProps {
  onDismiss?: (id: string) => void;
  toasts: readonly ToastMessage[];
}

export function ToastRegion({ onDismiss, toasts }: ToastRegionProps) {
  return (
    <div
      aria-live="polite"
      aria-relevant="additions removals"
      className="fixed inset-x-4 bottom-4 z-50 ml-auto flex max-w-sm flex-col gap-2"
      role="status"
    >
      {toasts.map((toast) => (
        <div className="rounded-xl border bg-card p-4 shadow-lg" key={toast.id}>
          <p className={toast.tone === 'error' ? 'text-destructive' : 'text-foreground'}>
            {toast.message}
          </p>
          {onDismiss ? (
            <button
              aria-label="Fechar aviso"
              className="mt-2 min-h-11 text-sm font-semibold text-primary"
              onClick={() => onDismiss(toast.id)}
              type="button"
            >
              Fechar
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
