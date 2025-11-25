import type { TaskClient } from '@sevn/task-core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { TaskComposer } from '../task-queue/TaskComposer';

describe('TaskComposer', () => {
  const mockClient: TaskClient = {
    decomposition: {
      generate: jest
        .fn()
        .mockResolvedValue({ data: { tasks: [{ title: 'Step one' }] }, error: null }),
      enqueue: jest.fn().mockResolvedValue({ data: [{ id: '1' }], error: null } as any),
    },
    tasks: {
      list: jest.fn().mockResolvedValue({ data: [], error: null } as any),
      create: jest.fn().mockResolvedValue({ data: { id: 'task-1' }, error: null } as any),
    },
  } as unknown as TaskClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('decomposes tasks and enqueues the confirmed checklist', async () => {
    const analytics = jest.fn();

    const { getByText, getByPlaceholderText } = render(
      <TaskComposer client={mockClient} ownerId="user-1" analytics={analytics} />
    );

    fireEvent.changeText(getByPlaceholderText(/describe/i), 'Ship a release');
    fireEvent.press(getByText('Plan tasks'));

    await waitFor(() => getByText('Confirm the checklist'));

    fireEvent.press(getByText('Enqueue tasks'));

    await waitFor(() =>
      expect((mockClient.decomposition.enqueue as jest.Mock).mock.calls.length).toBe(1)
    );
    expect(analytics).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'decomposition_ready' })
    );
    expect(analytics).toHaveBeenCalledWith(expect.objectContaining({ name: 'tasks_enqueued' }));
  });

  it('enqueues a single task when adding now', async () => {
    const analytics = jest.fn();

    const { getByText, getByPlaceholderText } = render(
      <TaskComposer client={mockClient} ownerId="user-1" analytics={analytics} />
    );

    fireEvent.changeText(getByPlaceholderText(/describe/i), 'Ship a release');
    fireEvent.press(getByText('Add now'));

    await waitFor(() =>
      expect((mockClient.decomposition.enqueue as jest.Mock).mock.calls.length).toBe(1)
    );
    expect((mockClient.decomposition.enqueue as jest.Mock).mock.calls[0][0]).toEqual([
      { title: 'Ship a release' },
    ]);
    expect(mockClient.tasks.create).not.toHaveBeenCalled();
    expect(analytics).toHaveBeenCalledWith(expect.objectContaining({ name: 'tasks_enqueued' }));
  });

  it('falls back to manual task creation with positions when enqueue fails', async () => {
    const analytics = jest.fn();

    (mockClient.decomposition.enqueue as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: new Error('rpc_missing'),
    });
    (mockClient.tasks.list as jest.Mock).mockResolvedValueOnce({
      data: [
        {
          id: 'existing-1',
          title: 'Existing task',
          description: null,
          state: 'todo',
          priority: 'medium',
          position: 2,
          due_at: null,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          owner_id: 'user-1',
        },
      ],
      error: null,
    } as any);

    const { getByText, getByPlaceholderText } = render(
      <TaskComposer client={mockClient} ownerId="user-1" analytics={analytics} />
    );

    fireEvent.changeText(getByPlaceholderText(/describe/i), 'Ship a release');
    fireEvent.press(getByText('Add now'));

    await waitFor(() => expect(mockClient.tasks.create).toHaveBeenCalled());

    expect(mockClient.tasks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Ship a release',
        owner_id: 'user-1',
        position: 2,
        priority: 'medium',
        state: 'todo',
      })
    );
    expect(mockClient.tasks.list).toHaveBeenCalledWith('user-1');
    expect(analytics).toHaveBeenCalledWith(expect.objectContaining({ name: 'tasks_enqueued' }));
  });
});
