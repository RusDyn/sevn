import type { TaskRow } from '@sevn/task-core';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StreakHeader, type StreakHeaderProps } from './StreakHeader';
import { TaskCard } from './TaskCard';
import { type Theme, useTheme } from '../theme';

export type TaskQueueBoardProps = {
  tasks: TaskRow[];
  streak?: Pick<StreakHeaderProps, 'count' | 'label' | 'accessory'>;
  onPressTask?: (task: TaskRow) => void;
  onComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onDeprioritize: (taskId: string) => void;
};

export const TaskQueueBoard = ({
  tasks,
  streak,
  onPressTask,
  onComplete,
  onDelete,
  onDeprioritize,
}: TaskQueueBoardProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // If we have no tasks, we render the empty state
  if (tasks.length === 0) {
    return (
      <View style={styles.container}>
        {streak ? <StreakHeader {...streak} /> : null}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Today is clear.</Text>
          <Text style={styles.emptySubtitle}>
            Settle in, pick one meaningful task, and begin calmly.
          </Text>
        </View>
      </View>
    );
  }

  // We only render the tasks that actually exist, up to 7
  const visibleTasks = tasks.slice(0, 7);

  return (
    <View style={styles.container}>
      {streak ? <StreakHeader {...streak} /> : null}
      <View style={styles.queue} accessibilityRole="list">
        {visibleTasks.map((task) => (
          <View key={task.id} style={styles.slot}>
            <TaskCard
              position={task.position}
              task={task}
              onComplete={onComplete}
              onDelete={onDelete}
              onDeprioritize={onDeprioritize}
              onPress={onPressTask}
            />
          </View>
        ))}
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: 12,
      flex: 1, // Allow container to fill space
    },
    queue: {
      gap: 10,
    },
    slot: {
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: 8,
      backgroundColor: theme.background,
    },
    emptyContainer: {
      flex: 1, // Fill available space to center vertically
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 64,
      gap: 12,
      minHeight: 300, // Ensure minimum height for centering if content is short
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '700',
    },
    emptySubtitle: {
      color: theme.textMuted,
      fontSize: 16,
      textAlign: 'center',
      maxWidth: 300,
    },
  });
