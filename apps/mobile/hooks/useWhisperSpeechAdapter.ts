import { type TaskClient } from '@sevn/task-core';
import { useRef, useCallback, useMemo, useEffect } from 'react';
import { Platform } from 'react-native';

import type { SpeechAdapter, SpeechState } from '@sevn/ui';

// Platform-specific WebRTC imports
let RTCPeerConnection: typeof globalThis.RTCPeerConnection;
let mediaDevices: MediaDevices;

if (Platform.OS === 'web') {
  RTCPeerConnection = globalThis.RTCPeerConnection;
  mediaDevices = navigator.mediaDevices;
} else {
  // React Native WebRTC - imported dynamically to avoid web bundling issues
  const RNWebRTC = require('react-native-webrtc');
  RTCPeerConnection = RNWebRTC.RTCPeerConnection;
  mediaDevices = RNWebRTC.mediaDevices;
}

type StreamingState = {
  pc: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  stream: MediaStream | null;
  onText: ((transcript: string) => void) | null;
  onStateChange: ((state: SpeechState) => void) | null;
  transcriptBuffer: string;
  currentItemId: string | null;
};

/**
 * Speech adapter using OpenAI Realtime API via WebRTC.
 *
 * Features:
 * - WebRTC connection with native audio handling
 * - Streaming transcription deltas (words appear as spoken)
 * - Near-field noise reduction
 * - Server-side VAD (Voice Activity Detection)
 */
export const useWhisperSpeechAdapter = (client: TaskClient | null): SpeechAdapter => {
  const stateRef = useRef<StreamingState>({
    pc: null,
    dataChannel: null,
    stream: null,
    onText: null,
    onStateChange: null,
    transcriptBuffer: '',
    currentItemId: null,
  });

  const cleanup = useCallback(() => {
    const state = stateRef.current;

    // Stop all media tracks
    state.stream?.getTracks().forEach((track) => track.stop());

    // Close data channel
    state.dataChannel?.close();

    // Close peer connection
    state.pc?.close();

    // Reset state
    stateRef.current = {
      pc: null,
      dataChannel: null,
      stream: null,
      onText: null,
      onStateChange: null,
      transcriptBuffer: '',
      currentItemId: null,
    };
  }, []);

  const startRecording = useCallback(
    async (onText: (transcript: string) => void, onStateChange?: (state: SpeechState) => void) => {
      if (!client) {
        throw new Error('Client not available');
      }

      const state = stateRef.current;
      state.onText = onText;
      state.onStateChange = onStateChange ?? null;
      state.transcriptBuffer = '';
      state.currentItemId = null;

      try {
        // 1. Create peer connection with ICE servers for NAT traversal
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });
        state.pc = pc;

        // 2. Get microphone access
        const stream = await mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 24000,
          },
        });
        state.stream = stream;

        // Add audio track to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // 3. Create data channel for events
        const dc = pc.createDataChannel('oai-events');
        state.dataChannel = dc;

        dc.onopen = () => {
          console.log('WebRTC data channel opened');
        };

        dc.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            handleRealtimeEvent(msg, state);
          } catch (e) {
            console.error('Failed to parse WebRTC message', e);
          }
        };

        dc.onerror = (error) => {
          console.error('Data channel error:', error);
        };

        dc.onclose = () => {
          console.log('WebRTC data channel closed');
          const onStateChangeHandler = stateRef.current.onStateChange;
          cleanup();
          onStateChangeHandler?.('idle');
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
          console.log('WebRTC connection state:', pc.connectionState);
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            cleanup();
            state.onStateChange?.('idle');
          }
        };

        // 4. Create offer and wait for ICE gathering to complete
        // Set up ICE gathering promise BEFORE setLocalDescription to avoid race condition
        const iceGatheringPromise = waitForIceGathering(pc);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait for ICE gathering to complete before sending SDP
        // This ensures all ICE candidates are included in the offer
        const sdpWithCandidates = await iceGatheringPromise;

        if (!sdpWithCandidates) {
          throw new Error('Failed to gather ICE candidates');
        }

        // Exchange SDP with server
        const { data: answerSdp, error } =
          await client.voice.createRealtimeSession(sdpWithCandidates);

        if (error || !answerSdp) {
          throw error ?? new Error('Failed to get SDP answer');
        }

        // Set remote description
        await pc.setRemoteDescription({
          type: 'answer',
          sdp: answerSdp,
        });

        onStateChange?.('recording');
      } catch (error) {
        console.error('Failed to start WebRTC recording:', error);
        cleanup();
        throw error;
      }
    },
    [client, cleanup]
  );

  const stopRecording = useCallback(async () => {
    const { onStateChange } = stateRef.current;
    cleanup();
    onStateChange?.('idle');
  }, [cleanup]);

  // Cleanup on unmount to ensure recording resources are released
  useEffect(() => {
    return () => {
      cleanup();
    };
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

/**
 * Wait for ICE gathering to complete and return the SDP with all candidates.
 * This is necessary because the initial offer SDP may not contain ICE candidates,
 * which are required for the WebRTC connection to work on most networks.
 *
 * IMPORTANT: Event handlers must be attached BEFORE setLocalDescription is called
 * to avoid race conditions where ICE gathering completes synchronously.
 */
function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 5000): Promise<string | null> {
  return new Promise((resolve) => {
    // Set up event handlers immediately to catch any events that fire synchronously
    // after setLocalDescription is called

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      pc.onicegatheringstatechange = null;
      pc.onicecandidate = null;
      if (timeout) {
        clearTimeout(timeout);
      }
    };

    timeout = setTimeout(() => {
      // Timeout - return whatever we have (may have partial candidates)
      console.warn('ICE gathering timeout, proceeding with partial candidates');
      cleanup();
      resolve(pc.localDescription?.sdp ?? null);
    }, timeoutMs);

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        cleanup();
        resolve(pc.localDescription?.sdp ?? null);
      }
    };

    // Also listen for individual candidates as a fallback
    pc.onicecandidate = (event) => {
      if (event.candidate === null) {
        // null candidate means gathering is complete
        cleanup();
        resolve(pc.localDescription?.sdp ?? null);
      }
    };

    // Check if already complete (handles synchronous completion case)
    if (pc.iceGatheringState === 'complete') {
      cleanup();
      resolve(pc.localDescription?.sdp ?? null);
    }
  });
}

/**
 * Handle incoming events from the OpenAI Realtime API via data channel.
 */
function handleRealtimeEvent(msg: RealtimeEvent, state: StreamingState) {
  switch (msg.type) {
    case 'conversation.item.input_audio_transcription.delta': {
      // Streaming delta - append to buffer for current item
      const deltaMsg = msg as TranscriptionDeltaEvent;
      if (deltaMsg.item_id !== state.currentItemId) {
        // New transcription item, reset buffer
        state.currentItemId = deltaMsg.item_id;
        state.transcriptBuffer = deltaMsg.delta ?? '';
      } else {
        state.transcriptBuffer += deltaMsg.delta ?? '';
      }
      state.onText?.(state.transcriptBuffer);
      break;
    }

    case 'conversation.item.input_audio_transcription.completed': {
      // Final transcript for this item
      const completedMsg = msg as TranscriptionCompletedEvent;
      state.transcriptBuffer = completedMsg.transcript ?? '';
      state.currentItemId = null;
      state.onText?.(state.transcriptBuffer);
      break;
    }

    case 'input_audio_buffer.speech_started':
      state.onStateChange?.('recording');
      break;

    case 'input_audio_buffer.speech_stopped':
      state.onStateChange?.('transcribing');
      break;

    case 'input_audio_buffer.committed':
      // Audio buffer committed, transcription will follow
      break;

    case 'error':
      console.error('Realtime API error:', (msg as ErrorEvent).error);
      break;

    default:
      // Log unknown events for debugging
      if (msg.type) {
        console.debug('Unhandled realtime event:', msg.type);
      }
  }
}

// Type definitions for OpenAI Realtime API events
type TranscriptionDeltaEvent = {
  type: 'conversation.item.input_audio_transcription.delta';
  event_id: string;
  item_id: string;
  content_index: number;
  delta: string;
};

type TranscriptionCompletedEvent = {
  type: 'conversation.item.input_audio_transcription.completed';
  event_id: string;
  item_id: string;
  content_index: number;
  transcript: string;
};

type ErrorEvent = {
  type: 'error';
  event_id: string;
  error: {
    type: string;
    code: string;
    message: string;
    param?: string;
  };
};

type RealtimeEvent =
  | TranscriptionDeltaEvent
  | TranscriptionCompletedEvent
  | {
      type: 'input_audio_buffer.speech_started';
      event_id: string;
      audio_start_ms: number;
      item_id: string;
    }
  | {
      type: 'input_audio_buffer.speech_stopped';
      event_id: string;
      audio_end_ms: number;
      item_id: string;
    }
  | {
      type: 'input_audio_buffer.committed';
      event_id: string;
      previous_item_id: string;
      item_id: string;
    }
  | ErrorEvent
  | {
      type: string;
      [key: string]: unknown;
    };
