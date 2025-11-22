import { createClient, type PostgrestError, type Provider } from '@supabase/supabase-js';
import { applyPositionsToDrafts } from './decomposition';
import type {
  Database,
  QueueMove,
  TaskDecompositionRequest,
  TaskDecompositionResponse,
  TaskDraft,
  TaskInsert,
  TaskRow,
  TaskSortKey,
  TaskUpdate,
} from './types';

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

  const resolveOwnerId = async (taskId: string, scope?: { ownerId?: string }) => {
    if (scope?.ownerId) {
      return scope.ownerId;
    }

    const { data, error } = await client
      .from('tasks')
      .select('owner_id')
      .eq('id', taskId)
      .single();

    if (error) {
      throw error;
    }

    if (!data?.owner_id) {
      throw new Error(`Owner not found for task ${taskId}`);
    }

    return data.owner_id;
  };

  const deleteTask = async (id: string, scope?: { ownerId?: string }) =>
    withQueueRpcFallback(
      'delete_task_and_resequence',
      { p_task_id: id, p_owner: await resolveOwnerId(id, scope) },
      () => deleteAndResequence(id, scope),
    );

  const completeTask = async (id: string, scope?: { ownerId?: string }) =>
    withQueueRpcFallback(
      'complete_task_and_resequence',
      { p_task_id: id, p_owner: await resolveOwnerId(id, scope) },
      () => completeAndResequence(id, scope),
    );

  const deprioritizeTask = async (id: string, scope?: { ownerId?: string }) =>
    withQueueRpcFallback(
      'deprioritize_task_to_bottom',
      { p_task_id: id, p_owner: await resolveOwnerId(id, scope) },
      () => deprioritizeWithoutRpc(id, scope),
    );

  const reorderTask = async (move: QueueMove, scope?: { ownerId?: string }) =>
    withQueueRpcFallback(
      'reorder_task_queue',
      {
        p_task_id: move.taskId,
        p_to_index: move.toIndex,
        p_owner: await resolveOwnerId(move.taskId, scope),
      },
      () => reorderWithoutRpc(move, scope),
    );

  const decomposeTasks = async (input: TaskDecompositionRequest) =>
    client.functions.invoke<TaskDecompositionResponse>('decompose-tasks', { body: input });

  const enqueueDrafts = async (drafts: TaskDraft[], ownerId: string) => {
    let attempt = 0;
    let lastError: PostgrestError | null = null;

    while (attempt < 3) {
      const { data: active, error } = await fetchActiveTasks(ownerId);

      if (error || !active) {
        return { data: null, error };
      }

      const inserts = applyPositionsToDrafts(active, drafts, ownerId);

      if (inserts.length === 0) {
        return { data: [], error: null } as const;
      }

      const { data, error: insertError } = await client.from('tasks').insert(inserts).select();

      if (!insertError) {
        return { data, error: null } as const;
      }

      if (!isPositionConflictError(insertError)) {
        return { data: null, error: insertError } as const;
      }

      lastError = insertError;
      attempt += 1;
    }

    return {
      data: null,
      error:
        lastError ??
        new Error('Unable to enqueue tasks due to concurrent updates. Please try again.'),
    } as const;
  };

  const withQueueRpcFallback = async <Params extends Record<string, unknown>>(
    fnName: string,
    params: Params,
    fallback: () => Promise<{ data: TaskRow[] | null; error: unknown }>,
  ) => {
    const { data, error } = await client.rpc(fnName, params as never);

    if (error && isMissingFunctionError(error)) {
      return fallback();
    }

    return { data: (data as TaskRow[]) ?? null, error };
  };

  const fetchActiveTasks = async (ownerId: string) =>
    client
      .from('tasks')
      .select('*')
      .eq('owner_id', ownerId)
      .neq('state', 'done')
      .neq('state', 'archived')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });

  const resequenceActiveTasks = async (ownerId: string) => {
    const { data: active, error } = await fetchActiveTasks(ownerId);

    if (error || !active) {
      return { data: null, error };
    }

    await Promise.all(
      active.map((task, index) => client.from('tasks').update({ position: index + 1 }).eq('id', task.id)),
    );

    return fetchActiveTasks(ownerId);
  };

  const deleteAndResequence = async (taskId: string, scope?: { ownerId?: string }) => {
    const ownerId = await resolveOwnerId(taskId, scope);

    const { error } = await client.from('tasks').delete().eq('id', taskId);
    if (error) {
      return { data: null, error };
    }

    return resequenceActiveTasks(ownerId);
  };

  const completeAndResequence = async (taskId: string, scope?: { ownerId?: string }) => {
    const ownerId = await resolveOwnerId(taskId, scope);

    const { error } = await client.from('tasks').update({ state: 'done' }).eq('id', taskId);
    if (error) {
      return { data: null, error };
    }

    return resequenceActiveTasks(ownerId);
  };

  const deprioritizeWithoutRpc = async (taskId: string, scope?: { ownerId?: string }) => {
    const ownerId = await resolveOwnerId(taskId, scope);

    const { data: active, error } = await fetchActiveTasks(ownerId);
    if (error || !active) {
      return { data: null, error };
    }

    const lastPosition = active.length + 1;
    const { error: updateError } = await client.from('tasks').update({ position: lastPosition }).eq('id', taskId);
    if (updateError) {
      return { data: null, error: updateError };
    }

    return resequenceActiveTasks(ownerId);
  };

  const reorderWithoutRpc = async (move: QueueMove, scope?: { ownerId?: string }) => {
    const ownerId = await resolveOwnerId(move.taskId, scope);
    const { data: active, error } = await fetchActiveTasks(ownerId);

    if (error || !active) {
      return { data: null, error };
    }

    const remaining = active.filter((task) => task.id !== move.taskId);
    const destination = Math.min(Math.max(move.toIndex, 0), Math.max(remaining.length, 0));
    const target = active.find((task) => task.id === move.taskId);

    if (target) {
      remaining.splice(destination, 0, target);
    }

    await Promise.all(
      remaining.map((task, index) => client.from('tasks').update({ position: index + 1 }).eq('id', task.id)),
    );

    return fetchActiveTasks(ownerId);
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
      complete: completeTask,
      deprioritize: deprioritizeTask,
      reorder: reorderTask,
    },
    decomposition: {
      generate: decomposeTasks,
      enqueue: enqueueDrafts,
    },
  };
};

const isMissingFunctionError = (error: { message?: string }) =>
  Boolean(error.message?.toLowerCase().includes('function') && error.message?.toLowerCase().includes('does not exist'));

const isPositionConflictError = (error: PostgrestError) => error.code === '23505';
