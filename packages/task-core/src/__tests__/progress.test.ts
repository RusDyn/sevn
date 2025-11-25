import {
  applyCompletionToProgress,
  deriveFocusMessages,
  dispatchProgressEvents,
  initialProgressSnapshot,
} from '../progress';

describe('progress tracking', () => {
  it('extends and resets streaks across days', () => {
    const first = applyCompletionToProgress(
      { taskId: 'a', completedAt: '2024-01-01T10:00:00Z' },
      initialProgressSnapshot
    );

    expect(first.snapshot.currentStreak).toBe(1);
    expect(first.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'streak_extended', properties: expect.any(Object) }),
      ])
    );

    const afterGap = applyCompletionToProgress(
      { taskId: 'b', completedAt: '2024-01-03T09:00:00Z' },
      first.snapshot
    );

    expect(afterGap.snapshot.currentStreak).toBe(1);
    expect(afterGap.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'streak_reset' }),
        expect.objectContaining({ name: 'streak_extended' }),
      ])
    );
  });

  it('emits micro-moments when three completions occur inside the window', () => {
    const first = applyCompletionToProgress(
      { taskId: 'a', completedAt: '2024-01-02T10:00:00Z' },
      initialProgressSnapshot,
      { microMomentWindowMinutes: 60 }
    );

    const second = applyCompletionToProgress(
      { taskId: 'b', completedAt: '2024-01-02T10:20:00Z' },
      first.snapshot,
      { microMomentWindowMinutes: 60 }
    );

    const third = applyCompletionToProgress(
      { taskId: 'c', completedAt: '2024-01-02T10:40:00Z' },
      second.snapshot,
      { microMomentWindowMinutes: 60 }
    );

    expect(third.snapshot.consecutiveCompletions).toBe(3);
    expect(third.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'micro_moment_three_in_a_row' })])
    );
  });

  it('derives calm focus messages from progress events', () => {
    const streakEvent = applyCompletionToProgress(
      { taskId: 'a', completedAt: '2024-01-05T11:00:00Z' },
      initialProgressSnapshot
    );

    const messages = deriveFocusMessages(streakEvent.snapshot, streakEvent.events);

    expect(messages.header).toContain('Streak');
    expect(messages.footer).toContain('breath');
  });

  it('routes progress events to telemetry sinks with feature flags', async () => {
    const posthog = { capture: jest.fn() };
    const insert = jest.fn().mockResolvedValue({ data: null, error: null });
    const supabase = { from: () => ({ insert }) } as any;

    const result = await dispatchProgressEvents(
      [
        {
          name: 'streak_extended',
          properties: { streak: 2 },
        },
      ],
      { posthog, supabase, featureFlags: { notifications: true } }
    );

    expect(posthog.capture).toHaveBeenCalledWith({
      event: 'streak_extended',
      properties: { streak: 2 },
    });
    expect(insert).toHaveBeenCalled();
    expect(result.notificationsQueued).toBe(1);
  });
});
