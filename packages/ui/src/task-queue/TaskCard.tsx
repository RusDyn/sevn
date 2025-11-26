import type { TaskRow } from '@sevn/task-core';
import { useMemo, useRef } from 'react';
import {
  type GestureResponderEvent,
  PanResponder,
  type PanResponderGestureState,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { announce, triggerHaptic } from './feedback';
import { type Theme, useTheme } from '../theme';

export type TaskCardProps = {
  task: TaskRow;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onDeprioritize?: (taskId: string) => void;
  onPress?: (task: TaskRow) => void;
};

const SWIPE_THRESHOLD = 52;

export const TaskCard = ({
  task,
  onComplete,
  onDelete,
  onDeprioritize,
  onPress,
}: TaskCardProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const handleComplete = () => {
    onComplete?.(task.id);
    triggerHaptic('complete');
    announce(`${task.title} completed`);
  };

  const handleDelete = () => {
    onDelete?.(task.id);
    triggerHaptic('delete');
    announce(`${task.title} deleted`);
  };

  const handleDeprioritize = () => {
    onDeprioritize?.(task.id);
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

  const isPressed = useSharedValue(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const hasMoved = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (
        _: GestureResponderEvent,
        gestureState: PanResponderGestureState
      ) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 5 || Math.abs(dy) > 5;
      },
      onPanResponderGrant: () => {
        isPressed.value = true;
        hasMoved.current = false;
        startX.current = 0;
        startY.current = 0;
      },
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        hasMoved.current = true;
        translateX.value = gestureState.dx;
        translateY.value = gestureState.dy;
      },
      onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        isPressed.value = false;
        const { dx, dy } = gestureState;

        translateX.value = withSpring(0);
        translateY.value = withSpring(0);

        if (hasMoved.current) {
          handleGestureEnd(dx, dy);
        } else {
          onPress?.(task);
        }
      },
      onPanResponderTerminate: () => {
        isPressed.value = false;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      },
    })
  ).current;

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withSpring(isPressed.value ? 0.7 : 1),
    transform: [
      { translateX: translateX.value * 0.3 },
      { translateY: translateY.value * 0.3 },
      {
        scale: withSpring(
          isPressed.value
            ? 0.98
            : 1 + Math.min(Math.abs(translateX.value), Math.abs(translateY.value), 30) / 1000
        ),
      },
    ],
  }));

  return (
    <View style={styles.gestureContainer}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.card, animatedStyle]}
        accessibilityRole="button"
        accessibilityLabel={task.title}
        accessibilityHint="Swipe right to complete, left to delete, down to deprioritize"
      >
        <Text style={styles.title}>{task.title}</Text>
        {task.description ? <Text style={styles.description}>{task.description}</Text> : null}
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 16,
      borderColor: theme.border,
      borderWidth: 1,
      padding: 16,
      gap: 8,
    },
    title: {
      color: theme.text,
      fontWeight: '700',
      fontSize: 18,
    },
    description: {
      color: theme.textSecondary,
      fontSize: 14,
    },
    gestureContainer: {
      // Ensure the container doesn't collapse
    },
  });
