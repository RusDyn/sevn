import { SevnFocusScreen } from '@sevn/feature-home';
import { AuthGate, OnboardingOverlay, TaskComposer, TaskEditModal, Toast } from '@sevn/ui';
import {
  type TaskAnalyticsEvent,
  type TaskClient,
  type TaskRow,
  useRealtimeTaskQueue,
} from '@sevn/task-core';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useTaskClient } from '@/hooks/useTaskClient';
import { useWhisperSpeechAdapter } from '@/hooks/useWhisperSpeechAdapter';
import { useOnboardingState } from '@/hooks/useOnboardingState';
import type { SpeechAdapter } from '@sevn/ui';

type AuthenticatedContentProps = {
  ownerId: string;
  userEmail: string | null;
  client: TaskClient;
  speechAdapter?: SpeechAdapter;
  logAnalytics: (event: TaskAnalyticsEvent) => void;
  onSignOut: () => void;
  showOnboarding: boolean;
  onDismissOnboarding: () => void;
};

function AuthenticatedContent({
  ownerId,
  userEmail,
  client,
  speechAdapter,
  logAnalytics,
  onSignOut,
  showOnboarding,
  onDismissOnboarding,
}: AuthenticatedContentProps) {
  const {
    data: tasks,
    error,
    refresh,
    completeTask,
    deleteTask,
    deprioritizeTask,
  } = useRealtimeTaskQueue(client, {
    ownerId,
    enabled: Boolean(ownerId),
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);

  useEffect(() => {
    if (error) {
      setToastMessage(error.message || 'Something went wrong');
    }
  }, [error]);

  const handleHideToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const handlePressTask = useCallback((task: TaskRow) => {
    setEditingTask(task);
  }, []);

  const handleSaveEdit = useCallback(
    async (taskId: string, updates: { title: string; description?: string | null }) => {
      await client.tasks.update(taskId, updates);
      setEditingTask(null);
    },
    [client]
  );

  const handleCloseEdit = useCallback(() => {
    setEditingTask(null);
  }, []);

  return (
    <ThemedView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <SevnFocusScreen
          style={styles.focusCard}
          ownerId={ownerId}
          client={client}
          tasks={tasks}
          userEmail={userEmail ?? undefined}
          onSignOut={onSignOut}
          onComplete={completeTask}
          onDelete={deleteTask}
          onDeprioritize={deprioritizeTask}
          onPressTask={handlePressTask}
        />
      </ScrollView>

      <TaskComposer
        client={client}
        ownerId={ownerId}
        speechAdapter={speechAdapter}
        analytics={logAnalytics}
        onTaskAdded={refresh}
        existingTasks={tasks}
      />

      <Toast
        message={toastMessage ?? ''}
        type="error"
        visible={toastMessage !== null}
        onHide={handleHideToast}
      />

      <OnboardingOverlay visible={showOnboarding} onDismiss={onDismissOnboarding} />

      <TaskEditModal
        task={editingTask}
        visible={editingTask !== null}
        onSave={handleSaveEdit}
        onClose={handleCloseEdit}
      />
    </ThemedView>
  );
}

export default function HomeScreen() {
  const client = useTaskClient();
  const speechAdapter = useWhisperSpeechAdapter(client);
  const { showOnboarding, completeOnboarding, loading: onboardingLoading } = useOnboardingState();
  const logAnalytics = useCallback(
    (event: TaskAnalyticsEvent) =>
      console.info('[mobile-analytics]', event.name, event.properties ?? {}),
    []
  );

  return (
    <AuthGate
      client={client}
      style={styles.authPanel}
      missingClientHint="Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to sign in."
    >
      {({ ownerId, userEmail, client: authedClient, signOut }) => (
        <AuthenticatedContent
          ownerId={ownerId}
          userEmail={userEmail}
          client={authedClient}
          speechAdapter={speechAdapter}
          logAnalytics={logAnalytics}
          onSignOut={signOut}
          showOnboarding={!onboardingLoading && showOnboarding}
          onDismissOnboarding={completeOnboarding}
        />
      )}
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 16,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  focusCard: {
    alignItems: 'flex-start',
    gap: 12,
  },
  authPanel: {
    flex: 1,
    padding: 16,
  },
});
