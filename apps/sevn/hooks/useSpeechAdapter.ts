import { useMemo } from 'react';
import { Platform } from 'react-native';
import { EventEmitter, NativeModulesProxy } from 'expo-modules-core';

import type { SpeechAdapter } from '@acme/ui';

const createWebAdapter = (): SpeechAdapter => {
  if (Platform.OS !== 'web') return { supported: false, start: async () => Promise.resolve() };

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return { supported: false, start: async () => Promise.resolve() };
  }

  let activeRecognizer: any = null;

  return {
    supported: true,
    label: 'Record',
    start: (onText) =>
      new Promise((resolve, reject) => {
        activeRecognizer = new SpeechRecognition();
        activeRecognizer.lang = 'en-US';
        activeRecognizer.onresult = (event) => {
          const transcript = event.results?.[0]?.[0]?.transcript;
          if (transcript) {
            onText(transcript);
          }
          resolve();
        };
        activeRecognizer.onerror = (event: { error?: string }) => reject(event.error ?? 'speech_error');
        activeRecognizer.onend = () => resolve();
        activeRecognizer.start();
      }),
    stop: async () => {
      activeRecognizer?.stop();
    },
  };
};

const createNativeAdapter = (): SpeechAdapter => {
  const nativeModule = (NativeModulesProxy as Record<string, unknown>).ExponentSpeechRecognition as
    | undefined
    | null
    | { startAsync?: () => Promise<void>; stopAsync?: () => Promise<void> };

  if (!nativeModule?.startAsync) {
    return { supported: false, start: async () => Promise.resolve() };
  }

  const emitter = new EventEmitter(nativeModule as object);

  return {
    supported: true,
    label: 'Record',
    start: async (onText) => {
      const subscription = emitter.addListener('onResult', (event: { transcript?: string }) => {
        if (event.transcript) {
          onText(event.transcript);
        }
      });

      try {
        await nativeModule.startAsync();
      } finally {
        subscription.remove();
      }
    },
    stop: async () => nativeModule.stopAsync?.(),
  };
};

export const useSpeechAdapter = (): SpeechAdapter =>
  useMemo(() => (Platform.OS === 'web' ? createWebAdapter() : createNativeAdapter()), []);
