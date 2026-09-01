import { useState } from 'react';

import { captureMonitoringException } from '@/shared/adapters/monitoring/sentry';

export function MonitoringAcceptancePage() {
  const [traceId, setTraceId] = useState<string>();

  function captureControlledError() {
    const nextTraceId = captureMonitoringException(
      new Error('T175 controlled staging monitoring check'),
      { role: 'PRESIDENT' },
    );
    setTraceId(nextTraceId);
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Staging</p>
        <h1 className="text-2xl font-bold">Validação de monitoramento</h1>
        <p className="text-muted-foreground">
          Envia um erro exclusivamente sintético para validar ambiente, release e remoção de dados
          sensíveis.
        </p>
      </div>

      <button
        className="min-h-12 rounded-xl bg-primary px-5 font-bold text-primary-foreground"
        type="button"
        onClick={captureControlledError}
      >
        Emitir erro controlado
      </button>

      {traceId ? (
        <p role="status" className="text-sm text-muted-foreground">
          Evento solicitado. Trace ID: <code>{traceId}</code>
        </p>
      ) : null}
    </section>
  );
}
