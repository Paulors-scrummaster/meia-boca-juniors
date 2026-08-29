/* eslint-disable react-refresh/only-export-components -- provider module exposes its typed context and testable JWT helper */
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
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
import { env } from '@/config/env';
import { isConnectivityFailure } from '@/shared/hooks/use-connectivity';
import { AppError, mapToAppError } from '@/shared/lib/app-error';
import { purgeRegisteredOfflineState } from '@/shared/lib/offline-cache';
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

function readStoredOfflineSession(): Session | null {
  if (typeof window === 'undefined' || navigator.onLine) return null;
  try {
    const raw = window.localStorage.getItem(`mbj:auth:${env.VITE_CLUB_DEPLOYMENT_ID}`);
    if (!raw) return null;
    const candidate = JSON.parse(raw) as Partial<Session>;
    if (
      typeof candidate.access_token !== 'string' ||
      typeof candidate.refresh_token !== 'string' ||
      typeof candidate.expires_at !== 'number' ||
      candidate.expires_at <= Date.now() / 1000 ||
      typeof candidate.user?.id !== 'string'
    ) {
      return null;
    }
    return candidate as Session;
  } catch {
    return null;
  }
}

async function getInitialSession(client: SupabaseClient<Database>) {
  const stored = readStoredOfflineSession();
  if (!stored) return client.auth.getSession();

  return Promise.race([
    client.auth.getSession(),
    new Promise<{ data: { session: Session }; error: null }>((resolve) => {
      window.setTimeout(() => resolve({ data: { session: stored }, error: null }), 250);
    }),
  ]);
}

interface AuthProviderProps extends PropsWithChildren {
  client?: SupabaseClient<Database>;
}

export function AuthProvider({ children, client = supabase }: AuthProviderProps) {
  const [value, setValue] = useState<AuthContextValue>(initialAuthValue);
  const previousUserId = useRef<string | null | undefined>(undefined);
  const resolutionId = useRef(0);

  const resolveSession = useCallback(
    async (session: Session | null) => {
      const currentResolution = ++resolutionId.current;
      const nextUserId = session?.user.id ?? null;

      if (previousUserId.current !== undefined && previousUserId.current !== nextUserId) {
        setValue(initialAuthValue);
        const departedUserId = previousUserId.current;
        if (departedUserId) {
          await purgeRegisteredOfflineState(departedUserId);
          if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('mbj:auth-lifecycle:v1');
            channel.postMessage({ type: 'PURGE_USER', userId: departedUserId });
            channel.close();
          }
        }
      }
      previousUserId.current = nextUserId;

      if (!session) {
        if (currentResolution === resolutionId.current) {
          setValue({ ...initialAuthValue, status: 'unauthenticated' });
        }
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (currentResolution === resolutionId.current) {
          setValue({
            ...initialAuthValue,
            session,
            status: 'authenticated',
            user: session.user,
          });
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
          if (isConnectivityFailure(error)) {
            setValue({
              ...initialAuthValue,
              session,
              status: 'authenticated',
              user: session.user,
            });
            return;
          }
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
    [client],
  );

  useEffect(() => {
    let active = true;

    void getInitialSession(client).then(({ data, error }) => {
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

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('mbj:auth-lifecycle:v1');
    channel.addEventListener('message', (event: MessageEvent<unknown>) => {
      const payload = event.data;
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'type' in payload &&
        payload.type === 'PURGE_USER' &&
        'userId' in payload &&
        typeof payload.userId === 'string'
      ) {
        void purgeRegisteredOfflineState(payload.userId);
      }
    });
    return () => channel.close();
  }, []);

  const contextValue = useMemo(
    () => ({
      ...value,
      refresh: async () => {
        const { data, error } = await client.auth.getSession();
        if (error) throw mapToAppError(error);
        await resolveSession(data.session);
      },
    }),
    [client, resolveSession, value],
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider não foi configurado.');
  return context;
}
