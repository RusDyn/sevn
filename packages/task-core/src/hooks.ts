import { useCallback, useEffect, useMemo, useState } from 'react';
import { createTaskClient, type TaskClient, type TaskClientConfig } from './client';
import type { QueueMove, TaskRow } from './types';

export const useTaskClient = (config: TaskClientConfig | null): TaskClient | null =>
  useMemo(() => (config ? createTaskClient(config) : null), [config]);

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
