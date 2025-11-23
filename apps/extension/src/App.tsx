import { Paragraph, Strong, TaskComposer, TaskQueueBoard } from '@acme/ui';
import type { TaskAnalyticsEvent } from '@acme/task-core';
import { StyleSheet, View } from 'react-native';

import { defaultOwnerId, taskClient } from './taskClient';

const logAnalytics = (event: TaskAnalyticsEvent) => {
  console.info('[extension-analytics]', event.name, event.properties ?? {});
};

function App() {
  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Paragraph style={styles.title}>
          <Strong>Sevn Focus</Strong>
        </Paragraph>
        <Paragraph style={styles.helper}>
          Manage tasks with swipes or the toolbar buttons beneath each card.
        </Paragraph>
      </View>
      <View style={styles.card}>
        <TaskQueueBoard client={taskClient} ownerId={defaultOwnerId} />
      </View>
      <View style={styles.card}>
        <TaskComposer client={taskClient} ownerId={defaultOwnerId} analytics={logAnalytics} />
      </View>
    </View>
  );
}

export default App;

const styles = StyleSheet.create({
  page: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    padding: 12,
    gap: 12,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  header: {
    gap: 4,
  },
  title: {
    color: '#e5e7eb',
    fontSize: 18,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  helper: {
    color: '#e5e7eb',
    lineHeight: 20,
  },
});
