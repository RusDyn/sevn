import type { TaskRow } from '@sevn/task-core';
import { ReactNode, useMemo, useRef } from 'react';
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
  position: number;
  task: TaskRow;
  accessory?: ReactNode;
  onComplete?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onDeprioritize?: (taskId: string) => void;
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
      color: theme.position,
      fontWeight: '800',
      fontSize: 16,
    },
    priority: {
      color: theme.priority,
      fontWeight: '700',
      fontSize: 12,
      letterSpacing: 1,
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
    state: {
      color: theme.state,
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
      color: theme.background,
      fontWeight: '700',
    },
    complete: {
      backgroundColor: theme.success,
    },
    deprioritize: {
      backgroundColor: theme.warning,
    },
    delete: {
      backgroundColor: theme.error,
    },
    gestureContainer: {
      // Ensure the container doesn't collapse
    },
  });
