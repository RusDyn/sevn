import type { TaskRow } from '@sevn/task-core';
import { ReactNode, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { announce, triggerHaptic } from './feedback';

export type TaskCardProps = {
  position: number;
  task: TaskRow;
  accessory?: ReactNode;
  onComplete?: (task: TaskRow) => void;
  onDelete?: (task: TaskRow) => void;
  onDeprioritize?: (task: TaskRow) => void;
  onPress?: (task: TaskRow) => void;
};

const SWIPE_THRESHOLD = 52;

export const TaskCard = ({
  position,
  task,
  accessory,
  onComplete,
  onDelete,
  onDeprioritize,
  onPress,
}: TaskCardProps) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const handleComplete = () => {
    onComplete?.(task);
    triggerHaptic('complete');
    announce(`${task.title} completed`);
  };

  const handleDelete = () => {
    onDelete?.(task);
    triggerHaptic('delete');
    announce(`${task.title} deleted`);
  };

  const handleDeprioritize = () => {
    onDeprioritize?.(task);
    triggerHaptic('deprioritize');
    announce(`${task.title} moved to a lower priority`);
  };

  const handleGestureEnd = (x: number, y: number) => {
    const absX = Math.abs(x);
    const absY = Math.abs(y);

    if (absX > absY && absX > SWIPE_THRESHOLD) {
      if (x > 0) {
        handleComplete();
      } else {
        handleDelete();
      }
    } else if (absY > absX && absY > SWIPE_THRESHOLD && y > 0) {
      handleDeprioritize();
    }
  };

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(8)
        .onUpdate((event) => {
          translateX.value = event.translationX;
          translateY.value = event.translationY;
        })
        .onEnd((event) => {
          translateX.value = withSpring(0);
          translateY.value = withSpring(0);
          runOnJS(handleGestureEnd)(event.translationX, event.translationY);
        }),
    [handleGestureEnd, translateX, translateY]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value * 0.3 },
      { translateY: translateY.value * 0.3 },
      { scale: 1 + Math.min(Math.abs(translateX.value), Math.abs(translateY.value), 30) / 1000 },
    ],
  }));

  const content = (
    <Animated.View
      style={[styles.card, animatedStyle]}
      accessibilityRole="button"
      accessibilityLabel={`${task.title} at position ${position}`}
      accessibilityHint="Swipe right to complete, left to delete, down to deprioritize"
    >
      <View style={styles.header}>
        <Text style={styles.position}>#{position}</Text>
        <Text style={styles.priority}>{task.priority.toUpperCase()}</Text>
      </View>
      <Text style={styles.title}>{task.title}</Text>
      {task.description ? <Text style={styles.description}>{task.description}</Text> : null}
      <View style={styles.footer}>
        <Text style={styles.state}>{task.state.replace('_', ' ')}</Text>
        {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      </View>
    </Animated.View>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <Pressable onPress={() => onPress?.(task)} accessibilityRole="button">
          {content}
        </Pressable>
        <View style={styles.actions} accessibilityRole="toolbar">
          <Pressable style={[styles.action, styles.complete]} onPress={handleComplete}>
            <Text style={styles.actionLabel}>Complete</Text>
          </Pressable>
          <Pressable style={[styles.action, styles.deprioritize]} onPress={handleDeprioritize}>
            <Text style={styles.actionLabel}>Later</Text>
          </Pressable>
          <Pressable style={[styles.action, styles.delete]} onPress={handleDelete}>
            <Text style={styles.actionLabel}>Delete</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <GestureDetector gesture={panGesture}>
      <Pressable onPress={() => onPress?.(task)}>{content}</Pressable>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    borderColor: '#1f2937',
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  position: {
    color: '#cbd5e1',
    fontWeight: '800',
    fontSize: 16,
  },
  priority: {
    color: '#0ea5e9',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  title: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 18,
  },
  description: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  state: {
    color: '#a5b4fc',
    fontWeight: '600',
  },
  accessory: {
    flex: 1,
    alignItems: 'flex-end',
  },
  webContainer: {
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  action: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionLabel: {
    color: '#0b1021',
    fontWeight: '700',
  },
  complete: {
    backgroundColor: '#a3e635',
  },
  deprioritize: {
    backgroundColor: '#fbbf24',
  },
  delete: {
    backgroundColor: '#f87171',
  },
});
