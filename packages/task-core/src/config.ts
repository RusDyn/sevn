// @ts-ignore - process may not be defined in all environments
const env = typeof process !== 'undefined' ? process.env ?? {} : {};

const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;

export const SEVN_AUTH_STORAGE_KEY = 'sevn-auth';

export const resolveSupabaseConfig = () =>
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_ANON_KEY, authStorageKey: SEVN_AUTH_STORAGE_KEY }
    : null;

export const getSupabaseEnv = () => ({
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_ANON_KEY,
});
