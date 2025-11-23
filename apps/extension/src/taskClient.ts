import { createTaskClient, type TaskClient } from '@acme/task-core';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const defaultOwnerId =
  (import.meta.env.VITE_SUPABASE_OWNER_ID as string | undefined) ||
  '00000000-0000-0000-0000-000000000000';

export const taskClient: TaskClient | null =
  supabaseUrl && supabaseKey
    ? createTaskClient({ supabaseKey, supabaseUrl, authStorageKey: 'sevn-extension-auth' })
    : null;
