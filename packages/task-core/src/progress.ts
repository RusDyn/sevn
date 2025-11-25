import type { SupabaseClient } from '@supabase/supabase-js';

export type CompletionRecord = {
  taskId: string;
  completedAt: string;
};

export type ProgressSnapshot = {
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate?: string;
  lastCompletedAt?: string;
  consecutiveCompletions: number;
};

export type ProgressEventName = 'streak_extended' | 'streak_reset' | 'micro_moment_three_in_a_row';

export type ProgressEvent = {
  name: ProgressEventName;
  properties: Record<string, unknown>;
};

export type FocusMessage = {
  header: string;
  footer: string;
};

export type TelemetryFeatureFlags = {
  notifications?: boolean;
};

export type PostHogLike = {
  capture: (options: { event: string; properties?: Record<string, unknown> }) => void;
};

export type SupabaseUsageClient = Pick<SupabaseClient, 'from' | 'functions'>;

export type ProgressTelemetry = {
  posthog?: PostHogLike;
  supabase?: SupabaseUsageClient;
  featureFlags?: TelemetryFeatureFlags;
};

export const initialProgressSnapshot: ProgressSnapshot = {
  currentStreak: 0,
  longestStreak: 0,
  consecutiveCompletions: 0,
};

const dayFromIso = (isoString: string) => new Date(isoString).toISOString().slice(0, 10);

const daysBetween = (lhs: string, rhs: string) => {
  const lhsDate = new Date(lhs);
  const rhsDate = new Date(rhs);

  lhsDate.setUTCHours(0, 0, 0, 0);
  rhsDate.setUTCHours(0, 0, 0, 0);

  return Math.round((rhsDate.getTime() - lhsDate.getTime()) / (1000 * 60 * 60 * 24));
};

export const applyCompletionToProgress = (
  completion: CompletionRecord,
  snapshot: ProgressSnapshot = initialProgressSnapshot,
  options: { microMomentWindowMinutes?: number } = {}
) => {
  const events: ProgressEvent[] = [];
  const completedAt = new Date(completion.completedAt);
  const completionDay = dayFromIso(completion.completedAt);
  const microMomentWindowMs = (options.microMomentWindowMinutes ?? 45) * 60 * 1000;

  const daysSinceLast = snapshot.lastCompletionDate
    ? daysBetween(snapshot.lastCompletionDate, completionDay)
    : null;

  const nextSnapshot: ProgressSnapshot = {
    ...snapshot,
    lastCompletedAt: completedAt.toISOString(),
    lastCompletionDate: completionDay,
  };

  if (daysSinceLast === null) {
    nextSnapshot.currentStreak = 1;
    events.push({
      name: 'streak_extended',
      properties: {
        streak: nextSnapshot.currentStreak,
        longestStreak: nextSnapshot.longestStreak || 1,
      },
    });
  } else if (daysSinceLast === 0) {
    nextSnapshot.currentStreak = Math.max(snapshot.currentStreak, 1);
  } else if (daysSinceLast === 1) {
    nextSnapshot.currentStreak = snapshot.currentStreak + 1;
    events.push({
      name: 'streak_extended',
      properties: {
        streak: nextSnapshot.currentStreak,
        longestStreak: Math.max(snapshot.longestStreak, nextSnapshot.currentStreak),
      },
    });
  } else {
    events.push({
      name: 'streak_reset',
      properties: { previousStreak: snapshot.currentStreak, resumedOn: completionDay },
    });
    nextSnapshot.currentStreak = 1;
    events.push({
      name: 'streak_extended',
      properties: {
        streak: nextSnapshot.currentStreak,
        longestStreak: Math.max(snapshot.longestStreak, nextSnapshot.currentStreak),
      },
    });
  }

  nextSnapshot.longestStreak = Math.max(snapshot.longestStreak, nextSnapshot.currentStreak);

  const withinWindow = snapshot.lastCompletedAt
    ? completedAt.getTime() - new Date(snapshot.lastCompletedAt).getTime() <= microMomentWindowMs
    : false;

  nextSnapshot.consecutiveCompletions = withinWindow ? snapshot.consecutiveCompletions + 1 : 1;

  if (nextSnapshot.consecutiveCompletions >= 3 && nextSnapshot.consecutiveCompletions % 3 === 0) {
    events.push({
      name: 'micro_moment_three_in_a_row',
      properties: {
        count: nextSnapshot.consecutiveCompletions,
        windowMinutes: microMomentWindowMs / 60000,
      },
    });
  }

  return { snapshot: nextSnapshot, events } as const;
};

export const deriveFocusMessages = (
  snapshot: ProgressSnapshot,
  events: ProgressEvent[] = []
): FocusMessage => {
  let header =
    snapshot.currentStreak > 0
      ? `Keep the ${snapshot.currentStreak}-day streak steady. Take the next clear step.`
      : 'Settle in, pick one meaningful task, and begin calmly.';

  let footer = 'Pause for a breath after each completion to stay grounded.';

  for (const event of events) {
    if (event.name === 'streak_reset') {
      header = 'New day, gentle restart. One calm action keeps the rhythm going.';
    }

    if (event.name === 'streak_extended') {
      const streak = event.properties.streak as number;
      header = `Streak at ${streak} day${streak === 1 ? '' : 's'}. Keep the cadence light.`;
    }

    if (event.name === 'micro_moment_three_in_a_row') {
      footer = 'Three tasks in a row—take a sip of water, then choose the next small move.';
    }
  }

  return { header, footer };
};

export const dispatchProgressEvents = async (
  events: ProgressEvent[],
  telemetry?: ProgressTelemetry
) => {
  let delivered = 0;

  for (const event of events) {
    if (telemetry?.posthog) {
      telemetry.posthog.capture({ event: event.name, properties: event.properties });
    }

    if (telemetry?.supabase?.from) {
      try {
        await telemetry.supabase.from('task_usage_events').insert({
          name: event.name,
          properties: event.properties,
        });
      } catch (error) {
        console.warn('Supabase telemetry failed', error);
      }
    }

    delivered += 1;
  }

  const notificationsQueued = telemetry?.featureFlags?.notifications ? events.length : 0;

  return { delivered, notificationsQueued } as const;
};
