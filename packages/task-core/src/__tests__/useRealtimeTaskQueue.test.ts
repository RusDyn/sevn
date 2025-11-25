import { act, renderHook } from '@testing-library/react';

// Mock config.ts to avoid import.meta issues in Jest
jest.mock('../config', () => ({
  SEVN_AUTH_STORAGE_KEY: 'sevn-auth-test',
  resolveSupabaseConfig: () => null,
  getSupabaseEnv: () => ({ supabaseUrl: undefined, supabaseKey: undefined }),
}));

import type { TaskClient } from '../client';
import type { TaskRow } from '../types';
import { useRealtimeTaskQueue } from '../hooks';

const createQueue = (overrides: Partial<TaskRow>[] = []): TaskRow[] =>
  overrides.map((task, index) => ({
    id: `task-${index + 1}`,
    title: `Task ${index + 1}`,
    description: null,
    state: 'todo',
    priority: 'medium',
    position: index + 1,
    due_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    owner_id: 'owner-1',
    ...task,
  }));

type QueueOperation = (queue: TaskRow[]) => TaskRow[];

const createMockClient = (initialQueue: TaskRow[]): TaskClient => {
  let queue = [...initialQueue];
  const mutate = (update: QueueOperation) => {
    queue = update(queue);
    return queue;
  };

  return {
    decomposition: { generate: jest.fn(), enqueue: jest.fn() },
    tasks: {
      list: jest.fn(async () => ({ data: queue, error: null }) as const),
      complete: jest.fn(async (taskId: string) => {
        mutate((current) => current.filter((task) => task.id !== taskId));
        return { data: null, error: null } as const;
      }),
      remove: jest.fn(async (taskId: string) => {
        mutate((current) => current.filter((task) => task.id !== taskId));
        return { data: null, error: null } as const;
      }),
      deprioritize: jest.fn(async (taskId: string) => {
        mutate((current) => {
          const remaining = current.filter((task) => task.id !== taskId);
          const target = current.find((task) => task.id === taskId);
          return target ? [...remaining, target] : current;
        });
        return { data: null, error: null } as const;
      }),
      reorder: jest.fn(async () => ({ data: null, error: null }) as const),
    },
    client: {
      channel: () => ({
        on: () => ({ subscribe: () => ({ subscription: { unsubscribe: jest.fn() } }) }),
      }),
      removeChannel: jest.fn(),
    },
    auth: {
      signInWithEmail: jest.fn(),
      signUpWithEmail: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      signOut: jest.fn(),
    },
  } as unknown as TaskClient;
};

describe('useRealtimeTaskQueue', () => {
  const hydrate = async () => {
    await act(async () => {
      await Promise.resolve();
    });
  };

  it('removes tasks when completing or deleting', async () => {
    const client = createMockClient(
      createQueue([
        { id: 'alpha', title: 'Alpha' },
        { id: 'beta', title: 'Beta' },
      ])
    );
    const { result } = renderHook(() => useRealtimeTaskQueue(client, { ownerId: 'owner-1' }));

    await hydrate();
    expect(result.current.data.map((task) => task.id)).toEqual(['alpha', 'beta']);

    await act(async () => {
      await result.current.completeTask('alpha');
    });

    expect(result.current.data.map((task) => task.id)).toEqual(['beta']);
    expect(result.current.data[0].position).toBe(1);

    await act(async () => {
      await result.current.deleteTask('beta');
    });

    expect(result.current.data).toHaveLength(0);
  });

  it('moves tasks to the bottom when deprioritized and resequences positions', async () => {
    const client = createMockClient(
      createQueue([
        { id: 'first', title: 'First' },
        { id: 'second', title: 'Second' },
        { id: 'third', title: 'Third' },
      ])
    );
    const { result } = renderHook(() => useRealtimeTaskQueue(client, { ownerId: 'owner-1' }));

    await hydrate();
    expect(result.current.data.map((task) => task.id)).toEqual(['first', 'second', 'third']);

    await act(async () => {
      await result.current.deprioritizeTask('first');
    });

    expect(result.current.data.map((task) => `${task.id}:${task.position}`)).toEqual([
      'second:1',
      'third:2',
      'first:3',
    ]);
  });
});
