/* eslint-disable react-refresh/only-export-components -- provider module exposes the query-client factory for deterministic tests */
import { QueryCache, QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query';
import { PersistQueryClientProvider, type Persister } from '@tanstack/react-query-persist-client';
import { useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { AuthContext } from '@/app/providers/AuthProvider';
import { clubConfig } from '@/config/club.config';
import { env } from '@/config/env';
import { AppError } from '@/shared/lib/app-error';
import { reportRequestFailure, reportRequestSuccess } from '@/shared/hooks/use-connectivity';
import {
  OFFLINE_CACHE_MAX_AGE,
  createOfflineBuster,
  createOfflinePersister,
  registerOfflineCleanup,
  shouldDehydrateOfflineMutation,
  shouldPersistOfflineQuery,
} from '@/shared/lib/offline-cache';

const NON_RETRYABLE_CODES = new Set([
  'UNAUTHENTICATED',
  'MFA_REQUIRED',
  'FORBIDDEN',
  'ACCOUNT_DISABLED',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'CONFLICT',
  'DEADLINE_CLOSED',
  'MATCH_LOCKED',
  'OFFLINE',
  'RATE_LIMITED',
]);

function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof AppError && NON_RETRYABLE_CODES.has(error.code)) {
    return false;
  }

  return failureCount < 2;
}

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: reportRequestFailure,
      onSuccess: () => reportRequestSuccess(),
    }),
    defaultOptions: {
      queries: {
        gcTime: 30 * 60 * 1000,
        networkMode: 'online',
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        retry: shouldRetry,
        staleTime: 30 * 1000,
      },
      mutations: {
        networkMode: 'always',
        retry: false,
      },
    },
  });
}

interface QueryProviderProps extends PropsWithChildren {
  client?: QueryClient;
}

interface GuardedPersister extends Persister {
  block: () => void;
  unblock: () => void;
}

export function QueryProvider({ children, client }: QueryProviderProps) {
  const auth = useContext(AuthContext);
  const userId = auth?.status === 'authenticated' ? auth.user?.id : undefined;

  return (
    <QueryBoundary {...(client ? { client } : {})} key={userId ?? 'public'} userId={userId}>
      {children}
    </QueryBoundary>
  );
}

function QueryBoundary({
  children,
  client,
  userId,
}: QueryProviderProps & { userId: string | undefined }) {
  const [queryClient] = useState(() => client ?? createAppQueryClient());
  const basePersister = useMemo(
    () =>
      userId
        ? createOfflinePersister({
            clubId: clubConfig.identity.deploymentId,
            deploymentId: env.VITE_CLUB_DEPLOYMENT_ID,
            userId,
          })
        : null,
    [userId],
  );
  const persister = useMemo<GuardedPersister | null>(() => {
    if (!basePersister) return null;
    let blocked = false;
    return {
      block: () => {
        blocked = true;
      },
      persistClient: (persistedClient) =>
        blocked ? Promise.resolve() : basePersister.persistClient(persistedClient),
      removeClient: () => basePersister.removeClient(),
      restoreClient: () => basePersister.restoreClient(),
      unblock: () => {
        blocked = false;
      },
    };
  }, [basePersister]);

  useEffect(() => {
    if (!userId || !persister) return;
    persister.unblock();
    return registerOfflineCleanup(userId, async () => {
      persister.block();
      await queryClient.cancelQueries();
      queryClient.clear();
      await persister.removeClient();
    });
  }, [persister, queryClient, userId]);

  if (!userId || !persister) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        buster: createOfflineBuster({
          clubId: clubConfig.identity.deploymentId,
          deploymentId: env.VITE_CLUB_DEPLOYMENT_ID,
          userId,
        }),
        dehydrateOptions: {
          shouldDehydrateMutation: shouldDehydrateOfflineMutation,
          shouldDehydrateQuery: (query) => shouldPersistOfflineQuery(query, userId),
        },
        maxAge: OFFLINE_CACHE_MAX_AGE,
        persister,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

export type AppQueryKey = QueryKey;
