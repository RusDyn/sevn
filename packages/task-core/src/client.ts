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
    client.from('tasks').insert(payload).select().single();

  const updateTask = (id: string, payload: TaskUpdate) =>
    client.from('tasks').update(payload).eq('id', id).select().single();

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

  const deleteTask = async (id: string) => {
    const { error } = await client.from('tasks').delete().eq('id', id);
    return { data: null, error };
  };

  const completeTask = async (id: string) => {
    const { error } = await client.from('tasks').delete().eq('id', id);
    return { data: null, error };
  };

  const deprioritizeTask = async (id: string, scope?: { ownerId?: string }) => {
    const ownerId = await resolveOwnerId(id, scope);
    const { data: active } = await fetchActiveTasks(ownerId);
    const maxPosition = active?.length ?? 0;

    const update: TaskUpdate = { position: maxPosition + 1 };
    const { error } = await client.from('tasks').update(update).eq('id', id);
    return { data: null, error };
  };

  const reorderTask = async (move: QueueMove, scope?: { ownerId?: string }) => {
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
      remaining.map((task, index) => {
        const update: TaskUpdate = { position: index + 1 };
        return client.from('tasks').update(update).eq('id', task.id);
      })
    );

    return { data: null, error: null };
  };

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

  /**
   * Creates a WebRTC realtime session by exchanging SDP offers.
   * @param offerSdp - The SDP offer from the client's RTCPeerConnection
   * @returns The SDP answer to set as remote description
   */
  const createRealtimeSession = async (offerSdp: string) => {
    const { data: sessionData } = await client.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const authToken = accessToken ?? supabaseKey;

    const response = await fetch(`${supabaseUrl}/functions/v1/realtime-session`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/sdp',
      },
      body: offerSdp,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { data: null, error: new Error(errorData.error ?? 'Failed to create session') };
    }

    const answerSdp = await response.text();
    return { data: answerSdp, error: null };
  };

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

  const fetchActiveTasks = async (ownerId: string) =>
    client
      .from('tasks')
      .select('*')
      .eq('owner_id', ownerId)
      .neq('state', 'done')
      .neq('state', 'archived')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });

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
      createRealtimeSession,
    },
    ai: {
      autoOrder: autoOrderTask,
    },
  };
};

const isPositionConflictError = (error: PostgrestError) => error.code === '23505';
