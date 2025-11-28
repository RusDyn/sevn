// For Expo/Metro: EXPO_PUBLIC_* must be accessed directly via process.env for static inlining
// For Vite: import.meta.env is used
const getSupabaseUrl = (): string | undefined => {
  // Direct access required for Metro to inline EXPO_PUBLIC_* at build time
  if (process.env.EXPO_PUBLIC_SUPABASE_URL) {
    return process.env.EXPO_PUBLIC_SUPABASE_URL;
  }
  /* eslint-disable @typescript-eslint/no-explicit-any */
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) {
    return (import.meta as any).env.VITE_SUPABASE_URL;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return undefined;
};

const getSupabaseAnonKey = (): string | undefined => {
  if (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  }
  /* eslint-disable @typescript-eslint/no-explicit-any */
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) {
    return (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return undefined;
};

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();

export const SEVN_AUTH_STORAGE_KEY = 'sevn-auth';

export const resolveSupabaseConfig = () =>
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? {
        supabaseUrl: SUPABASE_URL,
        supabaseKey: SUPABASE_ANON_KEY,
        authStorageKey: SEVN_AUTH_STORAGE_KEY,
      }
    : null;

export const getSupabaseEnv = () => ({
  supabaseUrl: SUPABASE_URL,
  supabaseKey: SUPABASE_ANON_KEY,
});
