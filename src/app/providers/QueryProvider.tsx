/* eslint-disable react-refresh/only-export-components -- provider module exposes the query-client factory for deterministic tests */
import { QueryCache, QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';

import { AppError } from '@/shared/lib/app-error';
import { reportRequestFailure, reportRequestSuccess } from '@/shared/hooks/use-connectivity';

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

export function QueryProvider({ children, client }: QueryProviderProps) {
  const [queryClient] = useState(() => client ?? createAppQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export type AppQueryKey = QueryKey;
