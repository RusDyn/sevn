import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { GestureHint } from './GestureHint';

export type OnboardingOverlayProps = {
  visible: boolean;
  onDismiss: () => void;
};

// Colors matching theme action colors
const COLORS = {
  complete: '#a3e635', // success/lime
  delete: '#f87171', // error/red
  deprioritize: '#fbbf24', // warning/amber
};

export const OnboardingOverlay = ({ visible, onDismiss }: OnboardingOverlayProps) => {
  const styles = useMemo(() => createStyles(), []);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
  }, [visible, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: opacity.value,
    };
  });

  if (!visible) {
    return null;
  }

  return (
    <Animated.View style={[styles.overlay, animatedStyle]}>
      <View style={styles.content}>
        <Text style={styles.title}>How to use Sevn</Text>
        <Text style={styles.subtitle}>Swipe tasks to take action</Text>

        <View style={styles.hintsContainer}>
          {/* Right swipe - Complete */}
          <View style={styles.hintRow}>
            <GestureHint direction="right" label="Complete" color={COLORS.complete} delay={200} />
          </View>

          {/* Left swipe - Delete */}
          <View style={styles.hintRow}>
            <GestureHint direction="left" label="Delete" color={COLORS.delete} delay={600} />
          </View>

          {/* Down swipe - Deprioritize */}
          <View style={styles.hintRow}>
            <GestureHint
              direction="down"
              label="Deprioritize"
              color={COLORS.deprioritize}
              delay={1000}
            />
          </View>
        </View>

        <Pressable
          style={styles.dismissButton}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss onboarding"
        >
          <Text style={styles.dismissText}>Got it</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(11, 16, 33, 0.92)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    content: {
      alignItems: 'center',
      paddingHorizontal: 32,
      gap: 24,
    },
    title: {
      color: '#f8fafc',
      fontSize: 28,
      fontWeight: '700',
      textAlign: 'center',
    },
    subtitle: {
      color: '#94a3b8',
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 16,
    },
    hintsContainer: {
      gap: 32,
      alignItems: 'center',
    },
    hintRow: {
      alignItems: 'center',
    },
    dismissButton: {
      marginTop: 32,
      paddingHorizontal: 48,
      paddingVertical: 16,
      backgroundColor: '#0ea5e9',
      borderRadius: 12,
    },
    dismissText: {
      color: '#f8fafc',
      fontSize: 18,
      fontWeight: '700',
    },
  });
