/* eslint-disable react-refresh/only-export-components -- provider module exposes its typed context and testable JWT helper */
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { supabase } from '@/shared/adapters/supabase/client';
import { AppError, mapToAppError } from '@/shared/lib/app-error';
import type { Database } from '@/shared/types/database.generated';

type AppRole = Database['public']['Enums']['app_role'];
type Profile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'account_status' | 'id' | 'must_change_password'
>;

export type AuthStatus =
  'initializing' | 'unauthenticated' | 'authenticated' | 'disabled' | 'error';

export interface AuthContextValue {
  error: AppError | null;
  isAal2: boolean;
  profile: Profile | null;
  refresh: () => Promise<void>;
  roles: AppRole[];
  session: Session | null;
  status: AuthStatus;
  user: User | null;
}

const initialAuthValue: AuthContextValue = {
  error: null,
  isAal2: false,
  profile: null,
  refresh: async () => undefined,
  roles: [],
  session: null,
  status: 'initializing',
  user: null,
};

export const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwtPayload(accessToken: string): Record<string, unknown> | null {
  try {
    const encodedPayload = accessToken.split('.')[1];
    if (!encodedPayload) return null;
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readSessionAssuranceLevel(session: Session | null): 'aal1' | 'aal2' {
  return decodeJwtPayload(session?.access_token ?? '')?.aal === 'aal2' ? 'aal2' : 'aal1';
}

interface AuthProviderProps extends PropsWithChildren {
  client?: SupabaseClient<Database>;
}

export function AuthProvider({ children, client = supabase }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<AuthContextValue>(initialAuthValue);
  const previousUserId = useRef<string | null | undefined>(undefined);
  const resolutionId = useRef(0);

  const resolveSession = useCallback(
    async (session: Session | null) => {
      const currentResolution = ++resolutionId.current;
      const nextUserId = session?.user.id ?? null;

      if (previousUserId.current !== undefined && previousUserId.current !== nextUserId) {
        await queryClient.cancelQueries();
        queryClient.clear();
      }
      previousUserId.current = nextUserId;

      if (!session) {
        if (currentResolution === resolutionId.current) {
          setValue({ ...initialAuthValue, status: 'unauthenticated' });
        }
        return;
      }

      try {
        const [profileResult, rolesResult] = await Promise.all([
          client
            .from('profiles')
            .select('id, account_status, must_change_password')
            .eq('id', session.user.id)
            .maybeSingle(),
          client.from('user_roles').select('role').eq('user_id', session.user.id),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (rolesResult.error) throw rolesResult.error;

        if (currentResolution !== resolutionId.current) return;

        if (!profileResult.data) {
          setValue({
            ...initialAuthValue,
            session,
            status: 'unauthenticated',
            user: session.user,
          });
          return;
        }

        if (profileResult.data.account_status === 'DISABLED') {
          setValue({
            ...initialAuthValue,
            error: new AppError('ACCOUNT_DISABLED'),
            profile: profileResult.data,
            session,
            status: 'disabled',
            user: session.user,
          });
          return;
        }

        setValue({
          error: null,
          isAal2: readSessionAssuranceLevel(session) === 'aal2',
          profile: profileResult.data,
          refresh: initialAuthValue.refresh,
          roles: (rolesResult.data ?? []).map(({ role }) => role),
          session,
          status: 'authenticated',
          user: session.user,
        });
      } catch (error) {
        if (currentResolution === resolutionId.current) {
          setValue({
            ...initialAuthValue,
            error: mapToAppError(error),
            session,
            status: 'error',
            user: session.user,
          });
        }
      }
    },
    [client, queryClient],
  );

  useEffect(() => {
    let active = true;

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setValue({ ...initialAuthValue, error: mapToAppError(error), status: 'error' });
        return;
      }
      void resolveSession(data.session);
    });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (active) void resolveSession(session);
    });

    return () => {
      active = false;
      resolutionId.current += 1;
      data.subscription.unsubscribe();
    };
  }, [client, resolveSession]);

  const contextValue = useMemo(
    () => ({ ...value, refresh: async () => resolveSession(value.session) }),
    [resolveSession, value],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider não foi configurado.');
  return context;
}
