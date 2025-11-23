import { AccessibilityInfo, Platform } from 'react-native';

type HapticKind = 'complete' | 'delete' | 'deprioritize';

export const announce = (message: string) => {
  AccessibilityInfo.isScreenReaderEnabled().then((enabled: boolean) => {
    if (enabled && (AccessibilityInfo as any).announceForAccessibility) {
      (AccessibilityInfo as any).announceForAccessibility(message);
    }
  });
};

export const triggerHaptic = async (kind: HapticKind) => {
  if (Platform.OS === 'web') return;

  const Haptics = (await import('expo-haptics').catch(() => null)) as any;

  if (!Haptics) return;

  const ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle || Haptics.ImpactStyle;

  const style =
    kind === 'delete'
      ? ImpactFeedbackStyle.Heavy
      : kind === 'deprioritize'
        ? ImpactFeedbackStyle.Medium
        : ImpactFeedbackStyle.Light;

  await Haptics.impactAsync(style);
};
