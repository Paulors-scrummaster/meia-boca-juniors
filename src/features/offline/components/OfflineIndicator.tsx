import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';

import { useAuth } from '@/app/providers/AuthProvider';
import { useConnectivity } from '@/shared/hooks/use-connectivity';
import { formatSaoPauloDateTime } from '@/shared/lib/date-time';

interface OfflineIndicatorProps {
  cachedAt?: string | null;
  hasCachedContent?: boolean;
}

function subscribeDeferred(subscribe: (notify: () => void) => () => void, notify: () => void) {
  let active = true;
  let queued = false;
  const unsubscribe = subscribe(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (active) notify();
    });
  });
  return () => {
    active = false;
    unsubscribe();
  };
}

export function OfflineIndicator({
  cachedAt: explicitCachedAt,
  hasCachedContent: explicitHasCachedContent,
}: OfflineIndicatorProps = {}) {
  const { isOnline } = useConnectivity();
  if (explicitCachedAt !== undefined || explicitHasCachedContent !== undefined) {
    return (
      <OfflineStatus
        cachedAt={explicitCachedAt ?? null}
        hasCachedContent={explicitHasCachedContent ?? false}
        isOnline={isOnline}
      />
    );
  }
  return <ConnectedOfflineStatus isOnline={isOnline} />;
}

function ConnectedOfflineStatus({ isOnline }: { isOnline: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();
  const subscribeToCache = useCallback(
    (notify: () => void) => subscribeDeferred((listener) => cache.subscribe(listener), notify),
    [cache],
  );
  const revision = useSyncExternalStore(
    subscribeToCache,
    () =>
      cache
        .getAll()
        .map((query) => query.state.dataUpdatedAt)
        .join(':'),
    () => '',
  );
  void revision;

  const snapshots = user
    ? cache
        .getAll()
        .filter((query) => query.queryKey[0] === 'offline' && query.queryKey[1] === user.id)
        .map((query) => query.state.data)
        .filter(
          (data): data is { cachedAt: string } =>
            typeof data === 'object' &&
            data !== null &&
            'cachedAt' in data &&
            typeof data.cachedAt === 'string',
        )
    : [];
  const cachedAt =
    snapshots.map(({ cachedAt: value }) => value).sort((a, b) => b.localeCompare(a))[0] ?? null;
  return (
    <OfflineStatus
      cachedAt={cachedAt}
      hasCachedContent={snapshots.length > 0}
      isOnline={isOnline}
    />
  );
}

function OfflineStatus({
  cachedAt,
  hasCachedContent,
  isOnline,
}: {
  cachedAt: string | null;
  hasCachedContent: boolean;
  isOnline: boolean;
}) {
  if (isOnline) return null;

  return (
    <aside
      aria-live="polite"
      className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <p className="font-black">Modo Offline</p>
      {hasCachedContent && cachedAt ? (
        <p>Última atualização: {formatSaoPauloDateTime(cachedAt)}</p>
      ) : (
        <p>
          Nenhum conteúdo offline está armazenado para este usuário. Reconecte-se para carregar.
        </p>
      )}
    </aside>
  );
}
