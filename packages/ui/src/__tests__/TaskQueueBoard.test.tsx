import type { TaskRow } from '@sevn/task-core';
import { useRealtimeTaskQueue } from '@sevn/task-core';
import { cleanup, render } from '@testing-library/react-native';

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
jest.mock('@sevn/task-core', () => ({
  useRealtimeTaskQueue: jest.fn(),
}));

const mockTask: TaskRow = {
  id: 'task-1',
  title: 'Write focus log',
  description: 'Capture what moved the needle today',
  state: 'in_progress',
  priority: 'high',
  position: 1,
  due_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  owner_id: 'user-1',
};

afterEach(cleanup);

it('renders the queue board with a streak header and task card snapshot', () => {
  (useRealtimeTaskQueue as jest.Mock).mockReturnValue({
    data: [mockTask],
    loading: false,
    completeTask: jest.fn(),
    deleteTask: jest.fn(),
    deprioritizeTask: jest.fn(),
  });

  const tree = render(
    <TaskQueueBoard client={null} ownerId="user-1" streak={{ count: 3, label: 'Days' }} />
  );

  expect(tree.toJSON()).toMatchSnapshot();
});

it('shows loading placeholders when queue is fetching', () => {
  (useRealtimeTaskQueue as jest.Mock).mockReturnValue({
    data: [],
    loading: true,
    completeTask: jest.fn(),
    deleteTask: jest.fn(),
    deprioritizeTask: jest.fn(),
  });

  const { getAllByText } = render(<TaskQueueBoard client={null} ownerId="user-1" />);

  expect(getAllByText('Loading task...').length).toBeGreaterThan(0);
});
