import type { SpeechAdapter } from '@sevn/ui';
import { useMemo } from 'react';

const unsupportedAdapter: SpeechAdapter = {
  supported: false,
  start: async () => Promise.resolve(),
};

export const useSpeechAdapter = (): SpeechAdapter =>
  useMemo(() => {
    if (typeof window === 'undefined') {
      return unsupportedAdapter;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return unsupportedAdapter;
    }

    let recognizer: InstanceType<typeof SpeechRecognition> | null = null;

    return {
      supported: true,
      label: 'Record',
      start: (onText) =>
        new Promise((resolve, reject) => {
          recognizer = new SpeechRecognition();
          recognizer.lang = 'en-US';
          recognizer.continuous = false;
          recognizer.interimResults = false;
          recognizer.onresult = (event) => {
            const transcript = event.results?.[0]?.[0]?.transcript;
            if (transcript) {
              onText(transcript);
            }
            resolve();
          };
          recognizer.onerror = (event) => {
            reject(new Error(event.error ?? 'speech_error'));
          };
          recognizer.onend = () => resolve();
          recognizer.start();
        }),
      stop: async () => {
        recognizer?.stop?.();
      },
    };
  }, []);
