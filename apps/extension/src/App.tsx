import { SevnFocusScreen } from '@acme/feature-home';
import type { TaskAnalyticsEvent } from '@acme/task-core';
import { Paragraph, Strong, TaskComposer, TaskQueueBoard } from '@acme/ui';
import { StyleSheet, View } from 'react-native';

import { defaultOwnerId, taskClient } from './taskClient';
import { useSpeechAdapter } from './useSpeechAdapter';

const logAnalytics = (event: TaskAnalyticsEvent) => {
  console.info('[extension-analytics]', event.name, event.properties ?? {});
};

function App() {
  const speechAdapter = useSpeechAdapter();
  const supabaseUnavailable = !taskClient;

  return (
    <View style={styles.page}>
      <SevnFocusScreen title="Focus queue" style={styles.focusCard}>
        <View style={styles.queueSection}>
          <TaskQueueBoard client={taskClient} ownerId={defaultOwnerId} />
          <Paragraph style={styles.helper}>
            {supabaseUnavailable ? (
              <>
                Provide your Supabase keys in <Strong>VITE_SUPABASE_URL</Strong> and{' '}
                <Strong>VITE_SUPABASE_ANON_KEY</Strong> to sync tasks.
              </>
            ) : (
              <>
                Swipe when supported or use the inline controls to complete, move later, or delete
                tasks.
              </>
            )}
          </Paragraph>
        </View>
        <TaskComposer
          client={taskClient}
          ownerId={defaultOwnerId}
          speechAdapter={speechAdapter}
          analytics={logAnalytics}
        />
      </SevnFocusScreen>
    </View>
  );
}

export default App;

const styles = StyleSheet.create({
  page: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    padding: 16,
    alignItems: 'center',
  },
  focusCard: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 16,
    width: '100%',
    maxWidth: 560,
  },
  queueSection: {
    width: '100%',
    gap: 8,
  },
  helper: {
    color: '#cbd5e1',
    paddingHorizontal: 4,
  },
});
