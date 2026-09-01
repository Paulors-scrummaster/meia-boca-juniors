import { Component, type ReactNode, useState } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import { captureMonitoringException } from '@/shared/adapters/monitoring/sentry';

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  failed: boolean;
  traceId?: string | undefined;
}

function SafeErrorView({ traceId }: { traceId: string }) {
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <section className="rounded-2xl border bg-card p-6" role="alert">
        <h1 className="text-2xl font-black">Não foi possível exibir esta página</h1>
        <p className="mt-3 text-muted-foreground">
          Tente novamente. Se o problema continuar, informe o identificador técnico abaixo.
        </p>
        <p className="mt-4 break-all rounded-lg bg-muted p-3 font-mono text-sm">{traceId}</p>
        <button
          className="mt-5 min-h-12 rounded-xl bg-primary px-5 font-bold text-primary-foreground"
          onClick={() => globalThis.location.reload()}
          type="button"
        >
          Recarregar página
        </button>
      </section>
    </main>
  );
}

export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.setState({ traceId: captureMonitoringException(error) });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <SafeErrorView traceId={this.state.traceId ?? 'registrando-ocorrencia'} />;
  }
}

export function RouteErrorBoundary() {
  const routeError = useRouteError();
  const [traceId] = useState(() =>
    captureMonitoringException(
      isRouteErrorResponse(routeError) ? new Error(`Route error ${routeError.status}`) : routeError,
    ),
  );
  return <SafeErrorView traceId={traceId} />;
}
