import { createTaskClient, type TaskClient } from '@acme/task-core';
import { useMemo } from 'react';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const defaultOwnerId =
  process.env.EXPO_PUBLIC_SUPABASE_OWNER_ID ?? '00000000-0000-0000-0000-000000000000';

export const useTaskClient = (): TaskClient | null =>
  useMemo(
    () =>
      supabaseUrl && supabaseKey
        ? createTaskClient({ supabaseKey, supabaseUrl, authStorageKey: 'sevn-mobile-auth' })
        : null,
    []
  );
