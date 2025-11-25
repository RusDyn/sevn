import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export type GestureDirection = 'right' | 'left' | 'down';

export type GestureHintProps = {
  direction: GestureDirection;
  label: string;
  color: string;
  delay?: number;
};

const ARROW_SYMBOLS: Record<GestureDirection, string> = {
  right: '\u2192', // →
  left: '\u2190', // ←
  down: '\u2193', // ↓
};

const getTranslation = (direction: GestureDirection) => {
  switch (direction) {
    case 'right':
      return { x: 20, y: 0 };
    case 'left':
      return { x: -20, y: 0 };
    case 'down':
      return { x: 0, y: 20 };
  }
};

export const GestureHint = ({ direction, label, color, delay = 0 }: GestureHintProps) => {
  const styles = useMemo(() => createStyles(color), [color]);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  const translation = getTranslation(direction);

  useEffect(() => {
    // Fade in after delay
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));

    // Start animation loop after fade in
    const animationDelay = delay + 300;

    translateX.value = withDelay(
      animationDelay,
      withRepeat(
        withSequence(
          withTiming(translation.x, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) }),
          withTiming(0, { duration: 500 }) // Pause
        ),
        -1, // Infinite
        false
      )
    );

    translateY.value = withDelay(
      animationDelay,
      withRepeat(
        withSequence(
          withTiming(translation.y, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) }),
          withTiming(0, { duration: 500 }) // Pause
        ),
        -1,
        false
      )
    );
  }, [delay, opacity, translateX, translateY, translation.x, translation.y]);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: opacity.value,
      transform: [{ translateX: translateX.value }, { translateY: translateY.value }] as const,
    };
  });

  const isHorizontal = direction === 'left' || direction === 'right';

  return (
    <Animated.View
      style={[styles.container, isHorizontal ? styles.horizontal : styles.vertical, animatedStyle]}
    >
      <View style={styles.arrowContainer}>
        <Text style={styles.arrow}>{ARROW_SYMBOLS[direction]}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </Animated.View>
  );
};

const createStyles = (color: string) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      gap: 8,
    },
    horizontal: {
      flexDirection: 'row',
    },
    vertical: {
      flexDirection: 'column',
    },
    arrowContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrow: {
      fontSize: 24,
      color: '#0b1021',
      fontWeight: '700',
    },
    label: {
      color: '#f8fafc',
      fontSize: 16,
      fontWeight: '600',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
  });
