import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { Paragraph } from './Paragraph';

export type ToastType = 'error' | 'success' | 'info';

export type ToastProps = {
  message: string;
  type?: ToastType;
  visible: boolean;
  duration?: number;
  onHide: () => void;
};

const typeColors: Record<ToastType, { background: string; text: string }> = {
  error: { background: '#7f1d1d', text: '#fecaca' },
  success: { background: '#14532d', text: '#bbf7d0' },
  info: { background: '#1e3a5f', text: '#bfdbfe' },
};

export const Toast = ({ message, type = 'info', visible, duration = 3000, onHide }: ToastProps) => {
  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);
  const colors = typeColors[type];

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 200 });
      opacity.value = withTiming(1, { duration: 200 });

      const timer = setTimeout(() => {
        translateY.value = withTiming(100, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 }, () => {
          runOnJS(onHide)();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      translateY.value = 100;
      opacity.value = 0;
    }
  }, [visible, duration, onHide, translateY, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible && opacity.value === 0) {
    return null;
  }

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={[styles.toast, { backgroundColor: colors.background }]}>
        <Paragraph style={[styles.message, { color: colors.text }]}>{message}</Paragraph>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    maxWidth: 400,
    width: '100%',
  },
  message: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});
