import { createClient } from '@supabase/supabase-js';

import { prefs } from '@/lib/storage';

/**
 * Supabase project credentials. The publishable key is safe to embed: every
 * table is locked down by row-level security, so it grants nothing beyond
 * "may attempt to sign in".
 */
const SUPABASE_URL = 'https://acteuihluhkmbpxoddio.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ME9KHK1Lb4OnO-rVrNziJw_PkPJt78S';

/** Auth session persistence over MMKV (synchronous, but the async shape is fine). */
const authStorage = {
  getItem: (key: string) => prefs.getString(key) ?? null,
  setItem: (key: string, value: string) => {
    prefs.set(key, value);
  },
  removeItem: (key: string) => {
    prefs.remove(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/** The signed-in user id, or null. */
export async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
