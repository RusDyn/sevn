import { createTaskClient, type TaskClient } from '@acme/task-core';
import { useMemo } from 'react';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const useTaskClient = (): TaskClient | null =>
  useMemo(
    () =>
      supabaseUrl && supabaseKey
        ? createTaskClient({ supabaseKey, supabaseUrl, authStorageKey: 'sevn-mobile-auth' })
        : null,
    []
  );
