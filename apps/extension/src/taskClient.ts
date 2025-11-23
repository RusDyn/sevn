import { createTaskClient, resolveSupabaseConfig, type TaskClient } from '@sevn/task-core';

const supabaseConfig = resolveSupabaseConfig();

export const taskClient: TaskClient | null = supabaseConfig
  ? createTaskClient(supabaseConfig)
  : null;
