import { SevnFocusScreen } from '@acme/feature-home';
import { TaskComposer } from '@acme/ui';
import type { TaskAnalyticsEvent } from '@acme/task-core';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AuthGate } from '@/components/auth-gate';
import ParallaxScrollView from '@/components/parallax-scroll-view';
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
    <AuthGate client={client}>
      {({ ownerId, signOut, client: authedClient }) => (
        <ParallaxScrollView
          headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
          headerImage={
            <Image
              source={require('../../../example/assets/images/partial-react-logo.png')}
              style={styles.reactLogo}
            />
          }
        >
          <ThemedView style={styles.titleContainer}>
            <ThemedText type="title">Sevn Focus</ThemedText>
            <ThemedText>Keep your attention anchored to what matters most.</ThemedText>
          </ThemedView>
          <ThemedView style={styles.signOutRow}>
            <Pressable accessibilityRole="button" onPress={signOut}>
              <ThemedText type="link">Sign out</ThemedText>
            </Pressable>
          </ThemedView>
          <ThemedView style={styles.stepContainer}>
            <SevnFocusScreen style={styles.focusCard} ownerId={ownerId} client={authedClient}>
              <ThemedText>
                Pin this focus screen in the Sevn browser extension to stay present while you work.
              </ThemedText>
              <ThemedText style={styles.caption}>
                The same shared UI powers both the mobile app and the extension view.
              </ThemedText>
              <Link href="/modal">
                <Link.Trigger>
                  <ThemedText type="link">Open quick actions</ThemedText>
                </Link.Trigger>
              </Link>
              <TaskComposer
                client={authedClient}
                ownerId={ownerId}
                speechAdapter={speechAdapter}
                analytics={logAnalytics}
              />
            </SevnFocusScreen>
          </ThemedView>
        </ParallaxScrollView>
      )}
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  signOutRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 12,
  },
  focusCard: {
    alignItems: 'flex-start',
    gap: 12,
  },
  caption: {
    fontSize: 16,
    opacity: 0.8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
