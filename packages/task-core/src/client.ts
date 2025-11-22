import { createClient, type Provider } from '@supabase/supabase-js';
import { buildPositionUpdates } from './queue';
import type { Database, QueueMove, TaskInsert, TaskRow, TaskSortKey, TaskUpdate } from './types';

export type TaskClientConfig = {
  supabaseUrl: string;
  supabaseKey: string;
  authStorageKey?: string;
};

export type TaskClient = ReturnType<typeof createTaskClient>;

export const createTaskClient = ({
  supabaseKey,
  supabaseUrl,
  authStorageKey = 'task-core-auth',
}: TaskClientConfig) => {
  const client = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      storageKey: authStorageKey,
      autoRefreshToken: true,
      persistSession: true,
    },
  });

  const signInWithEmail = (email: string, password: string) =>
    client.auth.signInWithPassword({ email, password });

  const signInWithOAuth = (provider: Provider, redirectTo?: string) =>
    client.auth.signInWithOAuth({ provider, options: redirectTo ? { redirectTo } : undefined });

  const signOut = () => client.auth.signOut();

  const listTasks = async (ownerId?: string, sort: TaskSortKey = 'position') => {
    let query = client.from('tasks').select('*');

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query.order(sort, { ascending: true });
    return { data: data ?? [], error } as { data: TaskRow[]; error: typeof error };
  };

  const getTask = (id: string) => client.from('tasks').select('*').eq('id', id).single();

  const createTask = (payload: TaskInsert) => client.from('tasks').insert(payload).select().single();

  const updateTask = (id: string, payload: TaskUpdate) =>
    client.from('tasks').update(payload).eq('id', id).select().single();

  const deleteTask = (id: string) => client.from('tasks').delete().eq('id', id);

  const reorderTask = async (move: QueueMove, scope?: { ownerId?: string }) => {
    const { data: existingTasks, error } = await listTasks(scope?.ownerId, 'position');

    if (error) return { data: null, error } as const;

    const updates = buildPositionUpdates(existingTasks, move);

    for (const update of updates) {
      const { error: updateError } = await client
        .from('tasks')
        .update({ position: update.position })
        .eq('id', update.id);

      if (updateError) return { data: null, error: updateError } as const;
    }

    return { data: updates, error: null } as const;
  };

  return {
    client,
    auth: {
      signInWithEmail,
      signInWithOAuth,
      signOut,
    },
    tasks: {
      list: listTasks,
      get: getTask,
      create: createTask,
      update: updateTask,
      remove: deleteTask,
      reorder: reorderTask,
    },
  };
};
