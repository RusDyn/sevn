import { type TaskClient } from '@sevn/task-core';
import { useRef, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

import type { SpeechAdapter } from '@sevn/ui';

type RecordingState = {
  recording: Audio.Recording | null;
  onText: ((transcript: string) => void) | null;
  onStateChange: ((state: 'recording' | 'transcribing' | 'idle') => void) | null;
};

export const useWhisperSpeechAdapter = (client: TaskClient | null): SpeechAdapter => {
  const stateRef = useRef<RecordingState>({
    recording: null,
    onText: null,
    onStateChange: null,
  });

  const requestPermissions = useCallback(async () => {
    if (Platform.OS === 'web') {
      return true;
    }
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  }, []);

  const startRecording = useCallback(
    async (
      onText: (transcript: string) => void,
      onStateChange?: (state: 'recording' | 'transcribing' | 'idle') => void
    ) => {
      if (!client) {
        throw new Error('Client not available');
      }

      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission denied');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      stateRef.current = {
        recording,
        onText,
        onStateChange: onStateChange ?? null,
      };

      onStateChange?.('recording');
    },
    [client, requestPermissions]
  );

  const stopRecording = useCallback(async () => {
    const { recording, onText, onStateChange } = stateRef.current;

    if (!recording) {
      return;
    }

    try {
      onStateChange?.('transcribing');

      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      if (!uri) {
        throw new Error('No recording URI available');
      }

      // Fetch the audio file and create a blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Send to Whisper API
      const { data, error } = await client!.voice.transcribe(blob);

      if (error || !data) {
        throw error ?? new Error('Transcription failed');
      }

      onText?.(data.text);
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    } finally {
      stateRef.current = {
        recording: null,
        onText: null,
        onStateChange: null,
      };
      onStateChange?.('idle');
    }
  }, [client]);

  return useMemo(
    () => ({
      supported: client !== null,
      label: 'Record',
      start: startRecording,
      stop: stopRecording,
    }),
    [client, startRecording, stopRecording]
  );
};
