import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const ONBOARDING_KEY = '@sevn/onboarding_completed';

export type OnboardingState = {
  /** Whether onboarding should be shown */
  showOnboarding: boolean;
  /** Whether the state is still loading */
  loading: boolean;
  /** Mark onboarding as completed */
  completeOnboarding: () => Promise<void>;
  /** Reset onboarding (for testing/debugging) */
  resetOnboarding: () => Promise<void>;
};

export const useOnboardingState = (): OnboardingState => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
        setShowOnboarding(completed !== 'true');
      } catch {
        // If storage fails, show onboarding to be safe
        setShowOnboarding(true);
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      setShowOnboarding(false);
    } catch {
      // Still hide even if storage fails
      setShowOnboarding(false);
    }
  }, []);

  const resetOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      setShowOnboarding(true);
    } catch {
      // Ignore errors during reset
    }
  }, []);

  return {
    showOnboarding,
    loading,
    completeOnboarding,
    resetOnboarding,
  };
};
