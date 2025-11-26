import type { TaskClient } from '@sevn/task-core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { TaskComposer } from '../task-queue/TaskComposer';

describe('TaskComposer', () => {
  const mockAddTasks = jest.fn().mockResolvedValue({
    data: { tasks: [{ id: '1', title: 'Test task', position: 1 }] },
    error: null,
  });

  const mockClient: TaskClient = {
    decomposition: {
      generate: jest.fn().mockResolvedValue({
        data: { tasks: [{ title: 'Step one' }] },
        error: null,
      }),
      enqueue: jest.fn().mockResolvedValue({ data: [{ id: '1' }], error: null }),
    },
    tasks: {
      list: jest.fn().mockResolvedValue({ data: [], error: null }),
      reorder: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
    ai: {
      addTasks: mockAddTasks,
    },
  } as unknown as TaskClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens modal and shows input field', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TaskComposer client={mockClient} ownerId="user-1" />
    );

    // Click the FAB button
    fireEvent.press(getByText('+'));

    // Should show the text input (since we're in text mode after switching from voice)
    await waitFor(() => {
      expect(getByPlaceholderText(/What needs to be done/i)).toBeTruthy();
    });
  });

  it('shows positioning buttons after entering text', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TaskComposer client={mockClient} ownerId="user-1" />
    );

    // Open modal
    fireEvent.press(getByText('+'));

    // Enter text
    await waitFor(() => getByPlaceholderText(/What needs to be done/i));
    fireEvent.changeText(getByPlaceholderText(/What needs to be done/i), 'Test task');

    // Should show positioning buttons
    await waitFor(() => {
      expect(getByText('Top')).toBeTruthy();
      expect(getByText('Bottom')).toBeTruthy();
      expect(getByText('AI Decide')).toBeTruthy();
    });
  });

  it('adds task to bottom when pressing Bottom button', async () => {
    const analytics = jest.fn();

    const { getByText, getByPlaceholderText } = render(
      <TaskComposer client={mockClient} ownerId="user-1" analytics={analytics} />
    );

    // Open modal
    fireEvent.press(getByText('+'));

    // Enter text
    await waitFor(() => getByPlaceholderText(/What needs to be done/i));
    fireEvent.changeText(getByPlaceholderText(/What needs to be done/i), 'Ship a release');

    // Press Bottom
    fireEvent.press(getByText('Bottom'));

    await waitFor(() => expect(mockAddTasks).toHaveBeenCalled());

    expect(mockAddTasks).toHaveBeenCalledWith({
      newTasks: [{ title: 'Ship a release', description: undefined }],
      position: 'bottom',
    });
    expect(analytics).toHaveBeenCalledWith(expect.objectContaining({ name: 'tasks_enqueued' }));
  });

  it('adds task to top when pressing Top button', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TaskComposer client={mockClient} ownerId="user-1" />
    );

    // Open modal
    fireEvent.press(getByText('+'));

    // Enter text
    await waitFor(() => getByPlaceholderText(/What needs to be done/i));
    fireEvent.changeText(getByPlaceholderText(/What needs to be done/i), 'Urgent task');

    // Press Top
    fireEvent.press(getByText('Top'));

    await waitFor(() => expect(mockAddTasks).toHaveBeenCalled());

    expect(mockAddTasks).toHaveBeenCalledWith({
      newTasks: [{ title: 'Urgent task', description: undefined }],
      position: 'top',
    });
  });

  it('uses AI ordering when pressing AI Decide button', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TaskComposer client={mockClient} ownerId="user-1" />
    );

    // Open modal
    fireEvent.press(getByText('+'));

    // Enter text
    await waitFor(() => getByPlaceholderText(/What needs to be done/i));
    fireEvent.changeText(getByPlaceholderText(/What needs to be done/i), 'Some task');

    // Press AI Decide
    fireEvent.press(getByText('AI Decide'));

    await waitFor(() => expect(mockAddTasks).toHaveBeenCalled());

    expect(mockAddTasks).toHaveBeenCalledWith({
      newTasks: [{ title: 'Some task', description: undefined }],
      position: 'auto', // 'ai' maps to 'auto' in the API
    });
  });

  it('splits tasks using decomposition and shows review screen', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TaskComposer client={mockClient} ownerId="user-1" />
    );

    // Open modal
    fireEvent.press(getByText('+'));

    // Enter text
    await waitFor(() => getByPlaceholderText(/What needs to be done/i));
    fireEvent.changeText(
      getByPlaceholderText(/What needs to be done/i),
      'Build the entire feature'
    );

    // Press Split
    fireEvent.press(getByText(/Split/));

    // Should show review screen with decomposed tasks
    await waitFor(() => {
      expect(getByText('Review tasks')).toBeTruthy();
      expect(getByText('Step one')).toBeTruthy();
    });
  });
});
