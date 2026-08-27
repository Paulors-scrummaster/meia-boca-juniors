import type { Session } from '@supabase/supabase-js';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider, readSessionAssuranceLevel, useAuth } from '@/app/providers/AuthProvider';
import { createAppQueryClient } from '@/app/providers/QueryProvider';
import type { Database } from '@/shared/types/database.generated';
import type { SupabaseClient } from '@supabase/supabase-js';

const userId = '00000000-0000-4000-8000-000000000101';

function tokenWithAal(aal: 'aal1' | 'aal2'): string {
  return `header.${btoa(JSON.stringify({ aal }))}.signature`;
}

function session(aal: 'aal1' | 'aal2' = 'aal1'): Session {
  return {
    access_token: tokenWithAal(aal),
    expires_at: 1_900_000_000,
    expires_in: 3600,
    refresh_token: 'local-test-refresh',
    token_type: 'bearer',
    user: {
      app_metadata: {},
      aud: 'authenticated',
      created_at: '2026-08-25T00:00:00.000Z',
      id: userId,
      user_metadata: {},
    },
  };
}

describe('AuthProvider', () => {
  it('lê o nível AAL da sessão sem confiar no cliente para papéis', () => {
    expect(readSessionAssuranceLevel(session('aal2'))).toBe('aal2');
    expect(readSessionAssuranceLevel(null)).toBe('aal1');
  });

  it('resolve perfil e união de papéis e limpa server-state no logout', async () => {
    let authCallback: ((event: string, nextSession: Session | null) => void) | undefined;
    const activeSession = session('aal2');
    const profileQuery = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { account_status: 'ACTIVE', id: userId, must_change_password: false },
        error: null,
      }),
      select: vi.fn().mockReturnThis(),
    };
    const rolesQuery = {
      eq: vi.fn().mockResolvedValue({
        data: [{ role: 'ATHLETE' }, { role: 'COACH' }],
        error: null,
      }),
      select: vi.fn().mockReturnThis(),
    };
    const authClient = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: activeSession }, error: null }),
        onAuthStateChange: vi.fn().mockImplementation((callback) => {
          authCallback = callback;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
      },
      from: vi.fn((table: string) => (table === 'profiles' ? profileQuery : rolesQuery)),
    } as unknown as SupabaseClient<Database>;
    const queryClient = createAppQueryClient();
    queryClient.setQueryData(['private', 'previous-user'], 'não pode atravessar logout');

    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={queryClient}>
          <AuthProvider client={authClient}>{children}</AuthProvider>
        </QueryClientProvider>
      );
    }

    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.roles).toEqual(['ATHLETE', 'COACH']);
    expect(result.current.isAal2).toBe(true);

    await act(async () => {
      authCallback?.('SIGNED_OUT', null);
    });

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(queryClient.getQueryData(['private', 'previous-user'])).toBeUndefined();
  });
});
