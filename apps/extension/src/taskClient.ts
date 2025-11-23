import { createTaskClient, resolveSupabaseConfig, type TaskClient } from '@acme/task-core';

const supabaseConfig = resolveSupabaseConfig();

export const taskClient: TaskClient | null = supabaseConfig ? createTaskClient(supabaseConfig) : null;
