import { AccessibilityInfo, Platform } from 'react-native';

type HapticKind = 'complete' | 'delete' | 'deprioritize';

export const announce = (message: string) => {
  AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
    if (enabled && AccessibilityInfo.announceForAccessibility) {
      AccessibilityInfo.announceForAccessibility(message);
    }
  });
};

export const triggerHaptic = async (kind: HapticKind) => {
  if (Platform.OS === 'web') return;

  const Haptics = await import('expo-haptics').catch(() => null);

  if (!Haptics) return;

  const style =
    kind === 'delete'
      ? Haptics.ImpactStyle.Heavy
      : kind === 'deprioritize'
        ? Haptics.ImpactStyle.Medium
        : Haptics.ImpactStyle.Light;

  await Haptics.impactAsync(style);
};
