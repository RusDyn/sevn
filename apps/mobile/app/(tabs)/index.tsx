import { SevnFocusScreen } from '@sevn/feature-home';
import { AuthGate, TaskComposer } from '@sevn/ui';
import type { TaskAnalyticsEvent } from '@sevn/task-core';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTaskClient } from '@/hooks/useTaskClient';
import { useSpeechAdapter } from '@/hooks/useSpeechAdapter';

export default function HomeScreen() {
  const client = useTaskClient();
  const speechAdapter = useSpeechAdapter();
  const logAnalytics = useCallback(
    (event: TaskAnalyticsEvent) => console.info('[mobile-analytics]', event.name, event.properties ?? {}),
    []
  );

  return (
    <AuthGate
      client={client}
      style={styles.authPanel}
      missingClientHint="Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to sign in."
    >
      {({ ownerId, signOut, client: authedClient }) => (
        <ThemedView style={styles.screen}>
          <ScrollView
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
          >
            <ThemedView style={styles.headerRow}>
              <ThemedText type="title">Sevn Focus</ThemedText>
              <Pressable accessibilityRole="button" onPress={signOut}>
                <ThemedText type="link">Sign out</ThemedText>
              </Pressable>
            </ThemedView>

            <SevnFocusScreen style={styles.focusCard} ownerId={ownerId} client={authedClient} />

            <ThemedView style={styles.composerCard}>
              <TaskComposer
                client={authedClient}
                ownerId={ownerId}
                speechAdapter={speechAdapter}
                analytics={logAnalytics}
              />
            </ThemedView>
          </ScrollView>
        </ThemedView>
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
  composerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0f172a',
    padding: 12,
    backgroundColor: '#0b1021',
  },
  authPanel: {
    flex: 1,
    padding: 16,
  },
});
