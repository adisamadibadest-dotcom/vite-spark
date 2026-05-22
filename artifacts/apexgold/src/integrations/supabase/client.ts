import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = (import.meta.env.EXPO_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL) as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;

function createSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.warn("[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Auth features are disabled.");
    return null;
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

let _supabase: ReturnType<typeof createClient<Database>> | null | undefined;

function getSupabase() {
  if (_supabase === undefined) _supabase = createSupabaseClient();
  return _supabase;
}

type SupabaseClient = NonNullable<ReturnType<typeof createSupabaseClient>>;

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop, receiver) {
    const client = getSupabase();
    if (!client) {
      if (prop === "auth") {
        return {
          getSession: async () => ({ data: { session: null }, error: null }),
          onAuthStateChange: (_event: unknown, _cb: unknown) => ({ data: { subscription: { unsubscribe: () => {} } } }),
          signInWithPassword: async () => ({ error: new Error("Supabase not configured") }),
          signUp: async () => ({ error: new Error("Supabase not configured") }),
          signOut: async () => ({ error: null }),
          resetPasswordForEmail: async () => ({ error: new Error("Supabase not configured") }),
          setSession: async () => ({ error: new Error("Supabase not configured") }),
        };
      }
      return () => ({ data: null, error: new Error("Supabase not configured") });
    }
    return Reflect.get(client, prop, receiver);
  },
});

export const isSupabaseConfigured = !!(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
