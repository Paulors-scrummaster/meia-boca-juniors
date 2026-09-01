import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { clubConfig } from '@/config/club.config';
import { env } from '@/config/env';
import { supabase } from '@/shared/adapters/supabase/client';
import type { Database } from '@/shared/types/database.generated';

interface OneSignalSdk {
  Notifications: {
    requestPermission(): Promise<boolean>;
  };
  User: {
    PushSubscription: { id?: string | null };
  };
  init(options: {
    appId: string;
    serviceWorkerParam: { scope: string };
    serviceWorkerPath: string;
  }): Promise<void>;
  login(externalId: string, identityToken: string): Promise<void>;
  logout(): Promise<void>;
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalSdk) => void | Promise<void>>;
  }
}

interface PushIdentityResponse {
  data: { externalId: string; identityToken: string };
  traceId: string;
}

export interface OneSignalBrowserBinding {
  dispose(): void;
  sync(session: Session | null): Promise<void>;
}

export type BrowserPushPermission = NotificationPermission | 'unsupported';

let activeOneSignalSdk: OneSignalSdk | null = null;

function isCanonicalProduction(appId: string | undefined): appId is string {
  return Boolean(
    appId &&
    env.VITE_APP_ENV === 'production' &&
    typeof window !== 'undefined' &&
    window.location.origin === clubConfig.links.canonicalWebsite,
  );
}

function hasBrowserNotificationSupport(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserPushPermission(): BrowserPushPermission {
  if (!hasBrowserNotificationSupport()) return 'unsupported';
  if (activeOneSignalSdk || env.VITE_APP_ENV === 'test') return Notification.permission;
  return 'unsupported';
}

export async function requestBrowserPushPermission(): Promise<BrowserPushPermission> {
  if (!hasBrowserNotificationSupport()) return 'unsupported';
  if (activeOneSignalSdk) {
    await activeOneSignalSdk.Notifications.requestPermission();
    return Notification.permission;
  }
  if (env.VITE_APP_ENV === 'test') return Notification.requestPermission();
  throw new Error('Push provider unavailable');
}

function loadSdk(): Promise<OneSignalSdk> {
  return new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred ?? [];
    window.OneSignalDeferred.push(async (oneSignal) => resolve(oneSignal));
    const existing = document.querySelector<HTMLScriptElement>('script[data-mbj-onesignal]');
    if (existing) return;
    const script = document.createElement('script');
    script.async = true;
    script.dataset.mbjOnesignal = 'true';
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.addEventListener('error', () => reject(new Error('OneSignal SDK unavailable')), {
      once: true,
    });
    document.head.append(script);
  });
}

export async function createOneSignalBrowserBinding(
  client: SupabaseClient<Database> = supabase,
  appId = import.meta.env.VITE_ONESIGNAL_APP_ID,
): Promise<OneSignalBrowserBinding | null> {
  if (!isCanonicalProduction(appId)) return null;

  const sdk = await loadSdk();
  await sdk.init({
    appId,
    serviceWorkerParam: { scope: '/push/onesignal/' },
    serviceWorkerPath: '/push/onesignal/OneSignalSDKWorker.js',
  });
  activeOneSignalSdk = sdk;
  let disposed = false;
  let boundUserId: string | null = null;

  async function sync(session: Session | null) {
    if (disposed) return;
    if (!session) {
      if (boundUserId) await sdk.logout();
      boundUserId = null;
      return;
    }
    if (boundUserId === session.user.id) return;

    const { data, error } = await client.functions.invoke<PushIdentityResponse>('push-identity', {
      body: {},
    });
    if (error || !data?.data) throw new Error('Push identity unavailable');
    if (data.data.externalId !== session.user.id) throw new Error('Push identity mismatch');
    await sdk.login(data.data.externalId, data.data.identityToken);
    boundUserId = session.user.id;

    const subscriptionId = sdk.User.PushSubscription.id;
    if (subscriptionId) {
      const now = new Date().toISOString();
      const { error: subscriptionError } = await client.from('push_subscriptions').upsert(
        {
          is_enabled: true,
          last_seen_at: now,
          provider_subscription_id: subscriptionId,
          updated_at: now,
          user_id: session.user.id,
        },
        { onConflict: 'provider_subscription_id' },
      );
      if (subscriptionError) throw subscriptionError;
    }
  }

  const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
    void sync(session).catch(() => undefined);
  });
  const { data } = await client.auth.getSession();
  await sync(data.session);

  return {
    dispose() {
      disposed = true;
      authListener.subscription.unsubscribe();
    },
    sync,
  };
}

export async function startOneSignalBrowserBinding(): Promise<OneSignalBrowserBinding | null> {
  try {
    return await createOneSignalBrowserBinding();
  } catch {
    return null;
  }
}
