import { SevnFocusScreen } from '@acme/feature-home';
import { Paragraph, Strong, TaskComposer } from '@acme/ui';
import type { TaskAnalyticsEvent } from '@acme/task-core';
import { StyleSheet, View } from 'react-native';

import { defaultOwnerId, taskClient } from './taskClient';

const logAnalytics = (event: TaskAnalyticsEvent) => {
  console.info('[extension-analytics]', event.name, event.properties ?? {});
};

function App() {
  return (
    <View style={styles.page}>
      <SevnFocusScreen style={styles.focusCard}>
        <Paragraph style={styles.helper}>
          Pin this view inside your browser extension to keep a <Strong>Sevn</Strong> reminder within reach.
        </Paragraph>
        <Paragraph style={styles.helper}>Custom widgets can be slotted in here next.</Paragraph>
        <TaskComposer client={taskClient} ownerId={defaultOwnerId} analytics={logAnalytics} />
      </SevnFocusScreen>
    </View>
  );
}

export default App;

const styles = StyleSheet.create({
  page: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    padding: 24,
  },
  focusCard: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 16,
  },
  helper: {
    color: '#e5e7eb',
  },
});
