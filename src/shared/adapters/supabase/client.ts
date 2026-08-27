import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env, type PublicEnv } from '@/config/env';
import type { Database } from '@/shared/types/database.generated';

type BrowserSupabaseConfig = Pick<
  PublicEnv,
  'VITE_CLUB_DEPLOYMENT_ID' | 'VITE_SUPABASE_PUBLISHABLE_KEY' | 'VITE_SUPABASE_URL'
>;

export function createBrowserSupabaseClient(
  config: BrowserSupabaseConfig = env,
): SupabaseClient<Database> {
  return createClient<Database>(config.VITE_SUPABASE_URL, config.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
      storageKey: `mbj:auth:${config.VITE_CLUB_DEPLOYMENT_ID}`,
    },
    global: {
      headers: {
        'X-Client-Info': 'mbj-web',
      },
    },
  });
}

export const supabase = createBrowserSupabaseClient();
