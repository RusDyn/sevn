import { type TaskClient } from '@sevn/task-core';
import { useRef, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { AudioContext } from 'react-native-audio-api';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

import type { SpeechAdapter, SpeechState } from '@sevn/ui';

type StreamingState = {
  ws: WebSocket | null;
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  stream: MediaStream | null;
  recording: Audio.Recording | null;
  animationFrame: number | null;
  onText: ((transcript: string) => void) | null;
  onStateChange: ((state: SpeechState) => void) | null;
  transcriptBuffer: string;
};

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const encodeBase64 = (bytes: Uint8Array): string => {
  let result = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const byte1 = bytes[i];
    const byte2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const byte3 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    const combined = (byte1 << 16) | (byte2 << 8) | byte3;

    result += BASE64_CHARS[(combined >> 18) & 0x3f];
    result += BASE64_CHARS[(combined >> 12) & 0x3f];
    result += i + 1 < bytes.length ? BASE64_CHARS[(combined >> 6) & 0x3f] : '=';
    result += i + 2 < bytes.length ? BASE64_CHARS[combined & 0x3f] : '=';
  }

  return result;
};

// Convert Float32Array to 16-bit PCM and base64
const float32ToPcm16Base64 = (float32Array: Float32Array): string => {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm16.buffer);

  // Prefer native encoders when available, otherwise fall back to a portable implementation
  if (typeof btoa !== 'undefined') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  return encodeBase64(bytes);
};

// Resample audio from source rate to 24kHz
const resample = (audioData: Float32Array, fromRate: number, toRate: number): Float32Array => {
  if (fromRate === toRate) return audioData;
  const ratio = fromRate / toRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
    const t = srcIndex - srcIndexFloor;
    result[i] = audioData[srcIndexFloor] * (1 - t) + audioData[srcIndexCeil] * t;
  }
  return result;
};

// Unified streaming adapter using OpenAI Realtime API
export const useWhisperSpeechAdapter = (client: TaskClient | null): SpeechAdapter => {
  const stateRef = useRef<StreamingState>({
    ws: null,
    audioContext: null,
    analyser: null,
    stream: null,
    recording: null,
    animationFrame: null,
    onText: null,
    onStateChange: null,
    transcriptBuffer: '',
  });

  const cleanup = useCallback(() => {
    const state = stateRef.current;
    if (state.animationFrame) {
      cancelAnimationFrame(state.animationFrame);
    }
    state.analyser?.disconnect();
    state.audioContext?.close();
    state.stream?.getTracks().forEach((t) => t.stop());
    if (state.recording) {
      try {
        state.recording.stopAndUnloadAsync();
      } catch (error) {
        console.warn('Failed to stop recording', error);
      }
    }
    state.ws?.close();
    stateRef.current = {
      ws: null,
      audioContext: null,
      analyser: null,
      stream: null,
      recording: null,
      animationFrame: null,
      onText: null,
      onStateChange: null,
      transcriptBuffer: '',
    };
  }, []);

  const startRecording = useCallback(
    async (onText: (transcript: string) => void, onStateChange?: (state: SpeechState) => void) => {
      if (!client) {
        throw new Error('Client not available');
      }

      // Get ephemeral token
      const { data: sessionData, error: sessionError } = await client.voice.getRealtimeSession();
      if (sessionError || !sessionData) {
        throw sessionError ?? new Error('Failed to get realtime session');
      }

      // Connect to OpenAI Realtime API
      const ws = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        ['realtime', `openai-insecure-api-key.${sessionData.token}`, 'openai-beta.realtime-v1']
      );

      stateRef.current.ws = ws;
      stateRef.current.onText = onText;
      stateRef.current.onStateChange = onStateChange ?? null;
      stateRef.current.transcriptBuffer = '';

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => {
          // Configure session for transcription
          ws.send(
            JSON.stringify({
              type: 'session.update',
              session: {
                modalities: ['text'],
                input_audio_format: 'pcm16',
                input_audio_transcription: {
                  model: 'whisper-1',
                },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500,
                },
              },
            })
          );
          resolve();
        };
        ws.onerror = () => reject(new Error('WebSocket connection failed'));
        setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000);
      });

      ws.onmessage = (event) => {
        try {
          const data = typeof event.data === 'string' ? event.data : '';
          const msg = JSON.parse(data);

          if (msg.type === 'conversation.item.input_audio_transcription.completed') {
            const transcript = msg.transcript?.trim();
            if (transcript) {
              stateRef.current.transcriptBuffer = transcript;
              stateRef.current.onText?.(transcript);
            }
          } else if (msg.type === 'input_audio_buffer.speech_started') {
            stateRef.current.onStateChange?.('recording');
          } else if (msg.type === 'input_audio_buffer.speech_stopped') {
            stateRef.current.onStateChange?.('transcribing');
          } else if (msg.type === 'error') {
            console.error('Realtime API error:', msg.error);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };

      ws.onerror = () => {
        console.error('WebSocket error');
        cleanup();
        stateRef.current.onStateChange?.('idle');
      };

      ws.onclose = () => {
        stateRef.current.onStateChange?.('idle');
      };

      // Native runtimes do not implement navigator.mediaDevices; use expo-av recording instead
      if (Platform.OS !== 'web') {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          throw new Error('Microphone permission not granted');
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        const recording = new Audio.Recording();
        await recording.prepareToRecordAsync({
          isMeteringEnabled: false,
          android: {
            extension: '.wav',
            outputFormat: Audio.AndroidOutputFormat.WEBM,
            audioEncoder: Audio.AndroidAudioEncoder.OPUS,
            sampleRate: 24000,
            numberOfChannels: 1,
          },
          ios: {
            extension: '.wav',
            outputFormat: Audio.IOSOutputFormat.LINEARPCM,
            audioQuality: Audio.IOSAudioQuality.MAX,
            sampleRate: 24000,
            numberOfChannels: 1,
            bitRateStrategy: Audio.IOSBitRateStrategyConstant,
          },
          web: {},
        });
        await recording.startAsync();

        stateRef.current.recording = recording;
        onStateChange?.('recording');
        return;
      }

      // Web audio capture path
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.getUserMedia) {
        throw new Error('Browser does not support audio capture');
      }

      const stream = await mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Use platform-appropriate AudioContext
      const AC = Platform.OS === 'web' ? window.AudioContext : AudioContext;
      const audioContext = new AC({ sampleRate: 24000 });
      const source = audioContext.createMediaStreamSource(stream);

      // Use ScriptProcessor for audio streaming (works on both platforms)
      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (stateRef.current.ws?.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const resampled = resample(inputData, audioContext.sampleRate, 24000);
        const base64Audio = float32ToPcm16Base64(resampled);

        stateRef.current.ws.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: base64Audio,
          })
        );
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      stateRef.current.audioContext = audioContext;
      stateRef.current.stream = stream;

      onStateChange?.('recording');
    },
    [client, cleanup]
  );

  const stopRecording = useCallback(async () => {
    const { ws, onStateChange, recording } = stateRef.current;

    if (Platform.OS !== 'web' && recording && ws?.readyState === WebSocket.OPEN) {
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (uri) {
          const base64Wav = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const wavBytes = Buffer.from(base64Wav, 'base64');

          // Strip WAV header if present (first 44 bytes)
          const pcmBytes = wavBytes.byteLength > 44 ? wavBytes.slice(44) : wavBytes;

          ws.send(
            JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: Buffer.from(pcmBytes).toString('base64'),
            })
          );
          ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));

          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error('Failed to finalize native recording', error);
      }
    } else if (ws?.readyState === WebSocket.OPEN) {
      // Commit the audio buffer to finalize transcription
      ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));

      // Wait briefly for final transcription
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    cleanup();
    onStateChange?.('idle');
  }, [cleanup]);

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
