import { useCallback, useEffect, useMemo, useState } from 'react';
import { type RealtimePostgresChangesPayload, type Session } from '@supabase/supabase-js';

import { createTaskClient, type TaskClient, type TaskClientConfig } from './client';
import { resolveSupabaseConfig } from './config';
import {
  deriveVisibleQueue,
  normalizeQueuePositions,
  reduceQueueChange,
  reorderQueue,
} from './queue';
import type { QueueMove, TaskRow } from './types';

type QueueSubscriptionChange = RealtimePostgresChangesPayload<TaskRow>;

export const useTaskClient = (config: TaskClientConfig | null): TaskClient | null =>
  useMemo(() => (config ? createTaskClient(config) : null), [config]);

const envSupabaseConfig = resolveSupabaseConfig();

export const useEnvTaskClient = () => useTaskClient(envSupabaseConfig);

export type TaskSessionStatus =
  | 'loading'
  | 'missing-client'
  | 'unauthenticated'
  | 'invalid-session'
  | 'authenticated';

export type TaskSession = {
  client: TaskClient | null;
  session: Session | null;
  ownerId: string | null;
  status: TaskSessionStatus;
  loading: boolean;
  invalidSession: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: { message?: string } | null }>;
  signOut: () => Promise<{ error: { message?: string } | null }>;
};

const resolveSessionStatus = (
  client: TaskClient | null,
  session: Session | null,
  loading: boolean,
): TaskSessionStatus => {
  if (loading) return 'loading';
  if (!client) return 'missing-client';
  if (!session) return 'unauthenticated';
  if (!session.user?.id) return 'invalid-session';
  return 'authenticated';
};

export const useTaskSession = (client: TaskClient | null): TaskSession => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(client));

  useEffect(() => {
    let mounted = true;

    if (!client) {
      setSession(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const resolveSession = async () => {
      const { data } = await client.client.auth.getSession();
      if (!mounted) return;

      setSession(data.session ?? null);
      setLoading(false);
    };

    void resolveSession();

    const { data: authListener } = client.client.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [client]);

  const ownerId = session?.user?.id ?? null;
  const status = useMemo(() => resolveSessionStatus(client, session, loading), [client, loading, session]);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!client) return { error: new Error('No client configured') } as const;

      const { error } = await client.auth.signInWithEmail(email, password);
      return { error } as const;
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client) return { error: new Error('No client configured') } as const;

    const { error } = await client.auth.signOut();
    return { error } as const;
  }, [client]);

  return {
    client,
    session,
    ownerId,
    status,
    loading,
    invalidSession: status === 'invalid-session',
    signInWithEmail,
    signOut,
  };
};

export const useTasks = (
  client: TaskClient | null,
  options: { ownerId?: string; enabled?: boolean } = {}
) => {
  const { ownerId, enabled = true } = options;
  const [data, setData] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!client || !enabled) return;

    setLoading(true);
    const { data: tasks, error: queryError } = await client.tasks.list(ownerId);

    if (queryError) {
      setError(queryError);
    } else {
      setError(null);
      setData(tasks);
    }

    setLoading(false);
  }, [client, enabled, ownerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
};

export const useTaskQueue = (
  client: TaskClient | null,
  options: { ownerId?: string; enabled?: boolean } = {}
) => {
  const { data, loading, error, refresh } = useTasks(client, options);

  const moveTask = useCallback(
    async (move: QueueMove) => {
      if (!client) return { data: null, error: new Error('No client configured') } as const;

      const result = await client.tasks.reorder(move, { ownerId: options.ownerId });
      if (!result.error) {
        await refresh();
      }

      return result;
    },
    [client, options.ownerId, refresh]
  );

  return { data, loading, error, moveTask, refresh };
};

export const useRealtimeTaskQueue = (
  client: TaskClient | null,
  options: { ownerId?: string; enabled?: boolean } = {}
) => {
  const { ownerId, enabled = true } = options;
  const [queue, setQueue] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const data = useMemo(() => deriveVisibleQueue(queue), [queue]);

  const refresh = useCallback(async () => {
    if (!client || !enabled) return;

    setLoading(true);
    const { data: tasks, error: queryError } = await client.tasks.list(ownerId, 'position');

    if (queryError) {
      setError(queryError);
    } else {
      setError(null);
      setQueue(
        normalizeQueuePositions(
          (tasks ?? []).filter((task) => task.state !== 'done' && task.state !== 'archived')
        )
      );
    }

    setLoading(false);
  }, [client, enabled, ownerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!client || !enabled) return undefined;

    const channel = client.client
      .channel(`public:tasks-queue:${ownerId ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: ownerId ? `owner_id=eq.${ownerId}` : undefined,
        },
        (payload: QueueSubscriptionChange) => {
          setQueue((current) => reduceQueueChange(current, payload));
        }
      )
      .subscribe();

    return () => {
      void client.client.removeChannel(channel);
    };
  }, [client, enabled, ownerId]);

  const optimisticUpdate = useCallback(
    (
      updater: (tasks: TaskRow[]) => TaskRow[],
      action: () => Promise<{ error: unknown | null }>
    ) => {
      let previousQueue: TaskRow[] = [];

      setQueue((current) => {
        previousQueue = current;
        return normalizeQueuePositions(updater(current));
      });

      return action()
        .then((result) => {
          if (result.error) {
            void refresh();
          }

          return result;
        })
        .catch((caught) => {
          setQueue(previousQueue);
          void refresh();
          const normalizedError = caught instanceof Error ? caught : new Error(String(caught));
          setError(normalizedError);

          return { data: null, error: normalizedError } as const;
        });
    },
    [refresh]
  );

  const completeTask = useCallback(
    async (taskId: string) => {
      if (!client) return { data: null, error: new Error('No client configured') } as const;

      return optimisticUpdate(
        (tasks) => tasks.filter((task) => task.id !== taskId),
        () => client.tasks.complete(taskId, { ownerId })
      );
    },
    [client, optimisticUpdate, ownerId]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!client) return { data: null, error: new Error('No client configured') } as const;

      return optimisticUpdate(
        (tasks) => tasks.filter((task) => task.id !== taskId),
        () => client.tasks.remove(taskId, { ownerId })
      );
    },
    [client, optimisticUpdate, ownerId]
  );

  const deprioritizeTask = useCallback(
    async (taskId: string) => {
      if (!client) return { data: null, error: new Error('No client configured') } as const;

      const move: QueueMove = { taskId, toIndex: queue.length };

      return optimisticUpdate(
        (tasks) => reorderQueue(tasks, move),
        () => client.tasks.deprioritize(taskId, { ownerId })
      );
    },
    [client, optimisticUpdate, ownerId, queue.length]
  );

  const moveTask = useCallback(
    async (move: QueueMove) => {
      if (!client) return { data: null, error: new Error('No client configured') } as const;

      return optimisticUpdate(
        (tasks) => reorderQueue(tasks, move),
        () => client.tasks.reorder(move, { ownerId })
      );
    },
    [client, optimisticUpdate, ownerId]
  );

  return { data, loading, error, refresh, completeTask, deleteTask, deprioritizeTask, moveTask };
};
