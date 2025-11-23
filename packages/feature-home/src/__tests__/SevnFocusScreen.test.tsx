import { render, screen } from '@testing-library/react-native';
import { useEnvTaskClient, useRealtimeTaskQueue, useTaskSession } from '@acme/task-core';

import { SevnFocusScreen } from '../SevnFocusScreen';

jest.mock('@acme/task-core', () => {
  const actual = jest.requireActual('@acme/task-core');
  return {
    ...actual,
    useEnvTaskClient: jest.fn(),
    useRealtimeTaskQueue: jest.fn(),
    useTaskSession: jest.fn(),
  };
});

const mockUseEnvTaskClient = useEnvTaskClient as jest.MockedFunction<typeof useEnvTaskClient>;
const mockUseRealtimeTaskQueue = useRealtimeTaskQueue as jest.MockedFunction<typeof useRealtimeTaskQueue>;
const mockUseTaskSession = useTaskSession as jest.MockedFunction<typeof useTaskSession>;
const stubClient = { client: {} } as never;

beforeEach(() => {
  mockUseEnvTaskClient.mockReturnValue(stubClient);
  mockUseRealtimeTaskQueue.mockReturnValue({
    data: [],
    loading: false,
    error: null,
    refresh: jest.fn(),
    completeTask: jest.fn(),
    deleteTask: jest.fn(),
    deprioritizeTask: jest.fn(),
  });
  mockUseTaskSession.mockReturnValue({
    client: stubClient,
    session: { user: { id: 'owner-123' } } as never,
    ownerId: 'owner-123',
    status: 'authenticated',
    loading: false,
    invalidSession: false,
    signInWithEmail: jest.fn(),
    signOut: jest.fn(),
  });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('SevnFocusScreen', () => {
  it('shows calm header and footer messages by default', () => {
    render(<SevnFocusScreen />);

    expect(screen.getByText(/Settle in/i)).toBeTruthy();
    expect(screen.getByText(/breath/i)).toBeTruthy();
    expect(screen.getByText(/Focus queue/i)).toBeTruthy();
    expect(screen.getAllByLabelText(/Empty queue slot/i)).toHaveLength(7);
  });

  it('applies custom focus messages', () => {
    render(
      <SevnFocusScreen messages={{ header: 'Custom header', footer: 'Custom footer' }}>
        <></>
      </SevnFocusScreen>,
    );

    expect(screen.getByText('Custom header')).toBeTruthy();
    expect(screen.getByText('Custom footer')).toBeTruthy();
  });
});
