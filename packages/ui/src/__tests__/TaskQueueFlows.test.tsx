import type { QueueMove, TaskClient, TaskDraft, TaskRow } from '@sevn/task-core';
import { deriveVisibleQueue, normalizeQueuePositions, reorderQueue, useRealtimeTaskQueue } from '@sevn/task-core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { TaskComposer } from '../task-queue/TaskComposer';
import { TaskQueueBoard } from '../task-queue/TaskQueueBoard';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: ({ children }: { children: JSX.Element }) => children,
  Gesture: {
    Pan: () => ({
      minDistance: () => ({
        onUpdate: () => ({
          onEnd: () => ({}) as unknown,
        }),
      }),
    }),
  },
}));

jest.mock('@sevn/task-core', () => {
  const actual = jest.requireActual('@sevn/task-core');
  return { ...actual, useRealtimeTaskQueue: jest.fn() };
});

const queueStore = (() => {
  let queue: TaskRow[] = [];
  const listeners = new Set<(next: TaskRow[]) => void>();

  return {
    get: () => queue,
    set: (next: TaskRow[]) => {
      queue = normalizeQueuePositions(next);
      listeners.forEach((listener) => listener(queue));
    },
    subscribe: (listener: (next: TaskRow[]) => void) => {
      listeners.add(listener);
      listener(queue);
      return () => listeners.delete(listener);
    },
  };
})();

const useRealtimeTaskQueueMock = useRealtimeTaskQueue as jest.MockedFunction<typeof useRealtimeTaskQueue>;

const createTask = (overrides: Partial<TaskRow> = {}): TaskRow => ({
  id: `task-${Math.random().toString(36).slice(2, 8)}`,
  title: 'Task title',
  description: null,
  state: 'todo',
  priority: 'medium',
  position: queueStore.get().length + 1,
  due_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  owner_id: 'user-1',
  ...overrides,
});

const createMockClient = (): TaskClient => ({
  decomposition: {
    generate: jest.fn(),
    enqueue: jest.fn(async (drafts: TaskDraft[], ownerId: string) => {
      const created = drafts.map((draft, index) =>
        createTask({
          title: draft.title,
          position: queueStore.get().length + index + 1,
          owner_id: ownerId,
        })
      );
      queueStore.set([...queueStore.get(), ...created]);
      return { data: created, error: null } as const;
    }),
  },
  tasks: {
    list: jest.fn(async () => ({ data: queueStore.get(), error: null } as const)),
    create: jest.fn(async (insert) => {
      const created = createTask({ ...insert, id: `manual-${Date.now()}` });
      queueStore.set([...queueStore.get(), created]);
      return { data: created, error: null } as const;
    }),
    complete: jest.fn(async (taskId: string) => {
      queueStore.set(queueStore.get().filter((task) => task.id !== taskId));
      return { data: null, error: null } as const;
    }),
    remove: jest.fn(async (taskId: string) => {
      queueStore.set(queueStore.get().filter((task) => task.id !== taskId));
      return { data: null, error: null } as const;
    }),
    deprioritize: jest.fn(async (taskId: string) => {
      queueStore.set(reorderQueue(queueStore.get(), { taskId, toIndex: queueStore.get().length }));
      return { data: null, error: null } as const;
    }),
    reorder: jest.fn(async (move) => {
      queueStore.set(reorderQueue(queueStore.get(), move));
      return { data: null, error: null } as const;
    }),
  },
  client: {
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: () => undefined,
  },
  auth: {
    signInWithEmail: jest.fn(),
    signOut: jest.fn(),
  },
} as unknown as TaskClient;

beforeAll(() => {
  jest.spyOn(Platform, 'OS', 'get').mockReturnValue('web');
});

afterEach(() => {
  jest.clearAllMocks();
  queueStore.set([]);
});

useRealtimeTaskQueueMock.mockImplementation(() => {
  const [queue, setQueue] = useState<TaskRow[]>(queueStore.get());

  useEffect(() => queueStore.subscribe(setQueue), []);

  const data = useMemo(() => deriveVisibleQueue(queue), [queue]);
  const error = null;
  const refresh = jest.fn(async () => {
    setQueue(queueStore.get());
  });
  const completeTask = jest.fn(async (taskId: string) => {
    queueStore.set(queueStore.get().filter((task) => task.id !== taskId));
    return { data: null, error: null } as const;
  });
  const deleteTask = jest.fn(async (taskId: string) => {
    queueStore.set(queueStore.get().filter((task) => task.id !== taskId));
    return { data: null, error: null } as const;
  });
  const deprioritizeTask = jest.fn(async (taskId: string) => {
    queueStore.set(reorderQueue(queueStore.get(), { taskId, toIndex: queueStore.get().length }));
    return { data: null, error: null } as const;
  });
  const moveTask = jest.fn(async (move: QueueMove) => {
    queueStore.set(reorderQueue(queueStore.get(), move));
    return { data: null, error: null } as const;
  });

  return { data, loading: false, error, refresh, completeTask, deleteTask, deprioritizeTask, moveTask };
});

describe('Task queue flows', () => {
  it('adds a task from the composer into the visible queue', async () => {
    queueStore.set([createTask({ id: 'existing', title: 'Existing task', position: 1 })]);
    const client = createMockClient();

    const { getByPlaceholderText, getByText, queryByText, getByA11yLabel } = render(
      <>
        <TaskComposer client={client} ownerId="user-1" />
        <TaskQueueBoard client={client} ownerId="user-1" />
      </>
    );

    expect(getByA11yLabel('Existing task at position 1')).toBeTruthy();

    fireEvent.changeText(getByPlaceholderText(/describe/i), 'Write integration tests');
    fireEvent.press(getByText('Add now'));

    await waitFor(() => expect(getByA11yLabel('Write integration tests at position 2')).toBeTruthy());
    expect(queryByText('Existing task')).toBeTruthy();
  });

  it('updates the queue when completing, deleting, and deprioritizing tasks', async () => {
    queueStore.set([
      createTask({ id: 'alpha', title: 'Task Alpha', position: 1 }),
      createTask({ id: 'beta', title: 'Task Beta', position: 2 }),
      createTask({ id: 'gamma', title: 'Task Gamma', position: 3 }),
    ]);
    const client = createMockClient();

    const { getAllByText, getByA11yLabel, queryByA11yLabel } = render(
      <TaskQueueBoard client={client} ownerId="user-1" />
    );

    fireEvent.press(getAllByText('Later')[0]);
    await waitFor(() => expect(getByA11yLabel('Task Alpha at position 3')).toBeTruthy());
    expect(getByA11yLabel('Task Beta at position 1')).toBeTruthy();

    fireEvent.press(getAllByText('Complete')[0]);
    await waitFor(() => expect(queryByA11yLabel('Task Beta at position 1')).toBeNull());
    expect(getByA11yLabel('Task Gamma at position 1')).toBeTruthy();

    fireEvent.press(getAllByText('Delete')[1]);
    await waitFor(() => expect(queryByA11yLabel('Task Alpha at position 2')).toBeNull());
    expect(getByA11yLabel('Task Gamma at position 1')).toBeTruthy();
  });
});
