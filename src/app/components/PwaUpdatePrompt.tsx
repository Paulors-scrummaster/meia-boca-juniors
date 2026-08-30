import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;

  return (
    <aside
      aria-live="polite"
      className="fixed bottom-24 right-4 z-50 max-w-sm rounded-2xl border bg-card p-4 shadow-xl md:bottom-4"
      role="status"
    >
      <p className="font-black">
        {needRefresh
          ? 'Uma nova versão do MBJ está disponível.'
          : 'O MBJ está pronto para uso offline.'}
      </p>
      {needRefresh ? (
        <div className="mt-3 flex gap-2">
          <button
            className="min-h-11 rounded-lg bg-primary px-4 font-bold text-primary-foreground"
            onClick={() => void updateServiceWorker(true)}
            type="button"
          >
            Atualizar agora
          </button>
          <button
            className="min-h-11 rounded-lg border px-4 font-bold"
            onClick={() => setNeedRefresh(false)}
            type="button"
          >
            Depois
          </button>
        </div>
      ) : (
        <button
          className="mt-3 min-h-11 rounded-lg border px-4 font-bold"
          onClick={() => setOfflineReady(false)}
          type="button"
        >
          Entendi
        </button>
      )}
    </aside>
  );
}
