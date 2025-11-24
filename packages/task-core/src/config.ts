const env = (() => {
  const maybeProcessEnv =
    typeof globalThis === 'object'
      ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      : undefined;

  if (maybeProcessEnv) return maybeProcessEnv;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) return (import.meta as any).env;
  return {};
})();

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
