import { createClient, type PostgrestError, type Provider } from '@supabase/supabase-js';
import { SEVN_AUTH_STORAGE_KEY } from './config';

import { applyPositionsToDrafts } from './decomposition';
import type {
  AutoOrderRequest,
  AutoOrderResponse,
  Database,
  QueueMove,
  TaskDecompositionRequest,
  TaskDecompositionResponse,
  TaskDraft,
  TaskInsert,
  TaskRow,
  TaskSortKey,
  TaskUpdate,
  TranscriptionResponse,
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
  authStorageKey = SEVN_AUTH_STORAGE_KEY,
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

  const signUpWithEmail = (email: string, password: string) =>
    client.auth.signUp({ email, password });

  const resetPasswordForEmail = (email: string) => client.auth.resetPasswordForEmail(email);

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

  const createTask = (payload: TaskInsert) =>
    client
      .from('tasks')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(payload as any)
      .select()
      .single();

  const updateTask = (id: string, payload: TaskUpdate) =>
    client
      .from('tasks')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(payload as any)
      .eq('id', id)
      .select()
      .single();

  const resolveOwnerId = async (taskId: string, scope?: { ownerId?: string }) => {
    if (scope?.ownerId) {
      return scope.ownerId;
    }

    const { data, error } = await client.from('tasks').select('owner_id').eq('id', taskId).single();

    if (error) {
      throw error;
    }

    if (!data?.owner_id) {
      throw new Error(`Owner not found for task ${taskId}`);
    }

    return (data as Pick<TaskRow, 'owner_id'>).owner_id;
  };

  const deleteTask = async (id: string, scope?: { ownerId?: string }) =>
    withQueueRpcFallback(
      'delete_task_and_resequence',
      { p_task_id: id, p_owner: await resolveOwnerId(id, scope) },
      () => deleteAndResequence(id, scope)
    );

  const completeTask = async (id: string, scope?: { ownerId?: string }) =>
    withQueueRpcFallback(
      'complete_task_and_resequence',
      { p_task_id: id, p_owner: await resolveOwnerId(id, scope) },
      () => completeAndResequence(id, scope)
    );

  const deprioritizeTask = async (id: string, scope?: { ownerId?: string }) =>
    withQueueRpcFallback(
      'deprioritize_task_to_bottom',
      { p_task_id: id, p_owner: await resolveOwnerId(id, scope) },
      () => deprioritizeWithoutRpc(id, scope)
    );

  const reorderTask = async (move: QueueMove, scope?: { ownerId?: string }) =>
    withQueueRpcFallback(
      'reorder_task_queue',
      {
        p_task_id: move.taskId,
        p_to_index: move.toIndex,
        p_owner: await resolveOwnerId(move.taskId, scope),
      },
      () => reorderWithoutRpc(move, scope)
    );

  const decomposeTasks = async (input: TaskDecompositionRequest) =>
    client.functions.invoke<TaskDecompositionResponse>('decompose-tasks', { body: input });

  const transcribeAudio = async (audioBlob: Blob, language?: string) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.m4a');
    if (language) {
      formData.append('language', language);
    }

    const { data: sessionData } = await client.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const authToken = accessToken ?? supabaseKey;

    const response = await fetch(`${supabaseUrl}/functions/v1/transcribe-voice`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { data: null, error: new Error(errorData.error ?? 'Transcription failed') };
    }

    const data: TranscriptionResponse = await response.json();
    return { data, error: null };
  };

  const autoOrderTask = async (request: AutoOrderRequest) =>
    client.functions.invoke<AutoOrderResponse>('auto-order-task', { body: request });

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

      const { data, error: insertError } = await client
        .from('tasks')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(inserts as any)
        .select();

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

  type RpcFunctionName = keyof Database['public']['Functions'];

  const withQueueRpcFallback = async <Params extends Record<string, unknown>>(
    fnName: RpcFunctionName,
    params: Params,
    fallback: () => Promise<{ data: TaskRow[] | null; error: unknown }>
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await client.rpc(fnName, params as any);

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
      active.map((task, index) =>
        client
          .from('tasks')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ position: index + 1 } as any)
          .eq('id', (task as TaskRow).id)
      )
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

    const { error } = await client
      .from('tasks')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ state: 'done' } as any)
      .eq('id', taskId);
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
    const { error: updateError } = await client
      .from('tasks')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ position: lastPosition } as any)
      .eq('id', taskId);
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

    const remaining = active.filter((task) => (task as TaskRow).id !== move.taskId);
    const destination = Math.min(Math.max(move.toIndex, 0), Math.max(remaining.length, 0));
    const target = active.find((task) => (task as TaskRow).id === move.taskId);

    if (target) {
      remaining.splice(destination, 0, target);
    }

    await Promise.all(
      remaining.map((task, index) =>
        client
          .from('tasks')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ position: index + 1 } as any)
          .eq('id', (task as TaskRow).id)
      )
    );

    return fetchActiveTasks(ownerId);
  };

  return {
    client,
    auth: {
      signInWithEmail,
      signInWithOAuth,
      signUpWithEmail,
      resetPasswordForEmail,
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
    voice: {
      transcribe: transcribeAudio,
    },
    ai: {
      autoOrder: autoOrderTask,
    },
  };
};

const isMissingFunctionError = (error: { message?: string }) =>
  Boolean(
    error.message?.toLowerCase().includes('function') &&
      error.message?.toLowerCase().includes('does not exist')
  );

const isPositionConflictError = (error: PostgrestError) => error.code === '23505';
