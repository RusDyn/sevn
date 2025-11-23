import type { TaskClient, TaskRow } from '@sevn/task-core';
import { useRealtimeTaskQueue } from '@sevn/task-core';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyQueueState } from './EmptyQueueState';
import { StreakHeader, type StreakHeaderProps } from './StreakHeader';
import { TaskCard } from './TaskCard';

export type TaskQueueBoardProps = {
  client: TaskClient | null;
  ownerId?: string;
  streak?: Pick<StreakHeaderProps, 'count' | 'label' | 'accessory'>;
  onPressTask?: (task: TaskRow) => void;
};

const VISIBLE_POSITIONS = Array.from({ length: 7 }).map((_, index) => index + 1);

export const TaskQueueBoard = ({ client, ownerId, streak, onPressTask }: TaskQueueBoardProps) => {
  const enabled = Boolean(ownerId);

  const { data, loading, completeTask, deleteTask, deprioritizeTask } = useRealtimeTaskQueue(client, {
    ownerId,
    enabled,
  });

  const queue = enabled ? data : [];
  const isLoading = enabled && loading;

  const tasksByPosition = useMemo(
    () =>
      queue.reduce<Record<number, TaskRow>>((positions, task) => {
        positions[task.position] = task;
        return positions;
      }, {}),
    [queue]
  );

  return (
    <View style={styles.container}>
      {streak ? <StreakHeader {...streak} /> : null}
      <Text style={styles.queueLabel} accessibilityRole="header">
        Focus queue
      </Text>
      <View style={styles.queue} accessibilityRole="list">
        {VISIBLE_POSITIONS.map((position) => (
          <View key={position} style={styles.slot} accessibilityRole="listitem">
            {tasksByPosition[position] ? (
              <TaskCard
                position={position}
                task={tasksByPosition[position]}
                onComplete={() => completeTask(tasksByPosition[position].id)}
                onDelete={() => deleteTask(tasksByPosition[position].id)}
                onDeprioritize={() => deprioritizeTask(tasksByPosition[position].id)}
                onPress={onPressTask}
              />
            ) : isLoading ? (
              <EmptyQueueState position={position} message="Loading task..." />
            ) : (
              <EmptyQueueState position={position} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  queueLabel: {
    color: '#e2e8f0',
    fontWeight: '800',
    fontSize: 18,
    paddingHorizontal: 12,
  },
  queue: {
    gap: 10,
  },
  slot: {
    borderColor: '#0f172a',
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    backgroundColor: '#0b1021',
  },
});
