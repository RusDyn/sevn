import type { TaskClient } from '@acme/task-core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { TaskComposer } from '../task-queue/TaskComposer';

describe('TaskComposer', () => {
  const mockClient: TaskClient = {
    decomposition: {
      generate: jest.fn().mockResolvedValue({ data: { tasks: [{ title: 'Step one' }] }, error: null }),
      enqueue: jest.fn().mockResolvedValue({ data: [{ id: '1' }], error: null } as any),
    },
    tasks: {
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

    await waitFor(() => expect((mockClient.decomposition.enqueue as jest.Mock).mock.calls.length).toBe(1));
    expect(analytics).toHaveBeenCalledWith(expect.objectContaining({ name: 'decomposition_ready' }));
    expect(analytics).toHaveBeenCalledWith(expect.objectContaining({ name: 'tasks_enqueued' }));
  });

  it('enqueues a single task when adding now', async () => {
    const analytics = jest.fn();

    const { getByText, getByPlaceholderText } = render(
      <TaskComposer client={mockClient} ownerId="user-1" analytics={analytics} />
    );

    fireEvent.changeText(getByPlaceholderText(/describe/i), 'Ship a release');
    fireEvent.press(getByText('Add now'));

    await waitFor(() => expect((mockClient.decomposition.enqueue as jest.Mock).mock.calls.length).toBe(1));
    expect((mockClient.decomposition.enqueue as jest.Mock).mock.calls[0][0]).toEqual([{ title: 'Ship a release' }]);
    expect(mockClient.tasks.create).not.toHaveBeenCalled();
    expect(analytics).toHaveBeenCalledWith(expect.objectContaining({ name: 'tasks_enqueued' }));
  });
});
