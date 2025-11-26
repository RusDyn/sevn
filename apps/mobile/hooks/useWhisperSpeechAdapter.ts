import { type TaskClient } from '@sevn/task-core';
import { useRef, useCallback, useMemo, useEffect } from 'react';
import { Platform } from 'react-native';

import type { SpeechAdapter, SpeechState } from '@sevn/ui';

/**
 * Check if we're running on mobile web (iOS Safari, Chrome Android, etc.)
 */
const isMobileWeb = (): boolean => {
  if (Platform.OS !== 'web') return false;
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod|android|mobile/i.test(ua);
};

/**
 * Get platform-specific WebRTC APIs.
 * Must be called at runtime (not module load time) to ensure browser APIs are available.
 */
const getWebRTCApis = (): {
  RTCPeerConnection: typeof globalThis.RTCPeerConnection;
  mediaDevices: MediaDevices;
} | null => {
  if (Platform.OS === 'web') {
    // Check for secure context (required for getUserMedia on most browsers)
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      console.warn(
        'WebRTC requires a secure context (HTTPS or localhost). ' + 'Current context is not secure.'
      );
      // Still try to proceed - some browsers may allow it
    }

    // On web, use browser's native WebRTC APIs
    const rtcPC = globalThis.RTCPeerConnection;
    const md = navigator?.mediaDevices;

    if (!rtcPC) {
      console.warn('RTCPeerConnection not available');
      return null;
    }

    if (!md) {
      console.warn('navigator.mediaDevices not available');
      return null;
    }

    if (typeof md.getUserMedia !== 'function') {
      console.warn('getUserMedia not available on mediaDevices');
      return null;
    }

    console.log('WebRTC APIs available');
    return { RTCPeerConnection: rtcPC, mediaDevices: md };
  } else {
    // React Native WebRTC - imported dynamically to avoid web bundling issues
    try {
      const RNWebRTC = require('react-native-webrtc');
      return {
        RTCPeerConnection: RNWebRTC.RTCPeerConnection,
        mediaDevices: RNWebRTC.mediaDevices,
      };
    } catch (e) {
      console.warn('react-native-webrtc not available:', e);
      return null;
    }
  }
};

/**
 * Check if the current context supports WebRTC
 */
const isWebRTCSupported = (): boolean => {
  return getWebRTCApis() !== null;
};

type StreamingState = {
  pc: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  stream: MediaStream | null;
  onText: ((transcript: string) => void) | null;
  onStateChange: ((state: SpeechState) => void) | null;
  transcriptBuffer: string;
  currentItemId: string | null;
  abortController: AbortController | null;
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
    abortController: null,
  });

  const cleanup = useCallback(() => {
    const state = stateRef.current;

    // Abort any in-flight async operations FIRST
    state.abortController?.abort();

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
      abortController: null,
    };
  }, []);

  const startRecording = useCallback(
    async (
      onText: (transcript: string) => void,
      onStateChange?: (state: SpeechState) => void,
      initialText?: string
    ) => {
      if (!client) {
        throw new Error('Client not available');
      }

      const state = stateRef.current;

      // Create abort controller for this session
      const abortController = new AbortController();
      const { signal } = abortController;

      // Abort any previous in-flight operation
      state.abortController?.abort();
      state.abortController = abortController;

      state.onText = onText;
      state.onStateChange = onStateChange ?? null;
      // Preserve existing text (from keyboard input) in transcript buffer
      state.transcriptBuffer = initialText ?? '';
      state.currentItemId = null;

      try {
        // Get WebRTC APIs (must be done at runtime, not module load time)
        const webrtcApis = getWebRTCApis();
        if (!webrtcApis) {
          throw new Error('WebRTC is not supported in this browser');
        }

        const { RTCPeerConnection, mediaDevices } = webrtcApis;

        // 1. Create peer connection with ICE servers for NAT traversal
        // Mobile browsers need multiple STUN servers for better connectivity
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
          ],
          // Required for proper ICE candidate gathering on mobile
          iceCandidatePoolSize: 10,
        });
        state.pc = pc;

        // 2. Get microphone access with mobile-compatible constraints
        // Note: sampleRate is not widely supported in getUserMedia constraints
        // (especially on iOS Safari and older Chrome). The browser will use its
        // default sample rate and WebRTC will handle resampling if needed.
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };

        // Only add sampleRate on native platforms where react-native-webrtc supports it
        if (Platform.OS !== 'web') {
          (audioConstraints as Record<string, unknown>).sampleRate = 24000;
        }

        let stream: MediaStream;
        try {
          stream = await mediaDevices.getUserMedia({ audio: audioConstraints });
        } catch (mediaError) {
          // Fallback to basic audio constraints if advanced ones fail
          console.warn('Advanced audio constraints failed, trying basic constraints:', mediaError);
          try {
            stream = await mediaDevices.getUserMedia({ audio: true });
          } catch (fallbackError) {
            // Provide helpful error message based on error type
            const err = fallbackError as Error;
            if (err.name === 'NotFoundError') {
              throw new Error('No microphone found. Please connect a microphone and try again.');
            } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              throw new Error(
                'Microphone access denied. Please allow microphone access in your browser settings.'
              );
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
              throw new Error(
                'Microphone is in use by another application. Please close other apps using the microphone.'
              );
            }
            throw new Error(`Could not access microphone: ${err.message}`);
          }
        }

        // Check if aborted during getUserMedia (user switched modes)
        if (signal.aborted) {
          stream.getTracks().forEach((track) => track.stop());
          console.log('Recording start aborted during microphone access');
          return;
        }

        state.stream = stream;

        // Add audio track to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // 3. Create data channel for events
        const dc = pc.createDataChannel('oai-events');
        state.dataChannel = dc;

        dc.onopen = () => {
          console.log('WebRTC data channel opened - transcription session ready');
        };

        dc.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            console.log('WebRTC event received:', msg.type, msg);
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

        // Monitor ICE connection state (important for mobile where network can be unreliable)
        pc.oniceconnectionstatechange = () => {
          console.log('ICE connection state:', pc.iceConnectionState);
          if (pc.iceConnectionState === 'failed') {
            console.error('ICE connection failed - network may be blocking WebRTC');
            cleanup();
            state.onStateChange?.('idle');
          } else if (pc.iceConnectionState === 'disconnected') {
            // On mobile, disconnected can be temporary (e.g., switching networks)
            // Give it some time before cleaning up
            setTimeout(() => {
              if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                console.warn('ICE connection did not recover');
                cleanup();
                state.onStateChange?.('idle');
              }
            }, 5000);
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

        // Check if aborted during ICE gathering (user switched modes)
        if (signal.aborted) {
          console.log('Recording start aborted during ICE gathering');
          return;
        }

        if (!sdpWithCandidates) {
          throw new Error('Failed to gather ICE candidates');
        }

        // Exchange SDP with server
        const { data: answerSdp, error } =
          await client.voice.createRealtimeSession(sdpWithCandidates);

        // Check if aborted during server exchange (user switched modes)
        if (signal.aborted) {
          console.log('Recording start aborted during server exchange');
          return;
        }

        if (error || !answerSdp) {
          throw error ?? new Error('Failed to get SDP answer');
        }

        // Check if connection was closed (user switched modes) - defense in depth
        if (pc.signalingState === 'closed') {
          console.log('WebRTC connection closed during setup, aborting');
          return;
        }

        // Set remote description
        await pc.setRemoteDescription({
          type: 'answer',
          sdp: answerSdp,
        });

        onStateChange?.('recording');
      } catch (error) {
        // Check if this was an intentional abort (user switched modes)
        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log('Recording start aborted by user');
          return; // Don't cleanup again, don't rethrow
        }

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

  const supported = useMemo(() => client !== null && isWebRTCSupported(), [client]);

  return useMemo(
    () => ({
      supported,
      label: 'Record',
      start: startRecording,
      stop: stopRecording,
    }),
    [supported, startRecording, stopRecording]
  );
};

/**
 * Wait for ICE gathering to complete and return the SDP with all candidates.
 * This is necessary because the initial offer SDP may not contain ICE candidates,
 * which are required for the WebRTC connection to work on most networks.
 *
 * IMPORTANT: Event handlers must be attached BEFORE setLocalDescription is called
 * to avoid race conditions where ICE gathering completes synchronously.
 *
 * Mobile browsers often have slower ICE gathering due to cellular NAT traversal,
 * so we use a longer timeout and ensure we have at least one candidate before
 * proceeding on timeout.
 */
function waitForIceGathering(pc: RTCPeerConnection, timeoutMs?: number): Promise<string | null> {
  // Mobile web browsers need more time for ICE gathering due to cellular networks
  const effectiveTimeout = timeoutMs ?? (isMobileWeb() ? 10000 : 5000);

  return new Promise((resolve) => {
    // Set up event handlers immediately to catch any events that fire synchronously
    // after setLocalDescription is called

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let resolved = false;
    let candidateCount = 0;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      pc.onicegatheringstatechange = null;
      pc.onicecandidate = null;
      if (timeout) {
        clearTimeout(timeout);
      }
    };

    const resolveWithSdp = () => {
      cleanup();
      const sdp = pc.localDescription?.sdp ?? null;
      if (sdp) {
        console.log(`ICE gathering complete with ${candidateCount} candidate(s)`);
      }
      resolve(sdp);
    };

    timeout = setTimeout(() => {
      // Timeout - return whatever we have (may have partial candidates)
      if (candidateCount > 0) {
        console.warn(
          `ICE gathering timeout after ${effectiveTimeout}ms, proceeding with ${candidateCount} candidate(s)`
        );
      } else {
        console.warn('ICE gathering timeout with no candidates - connection may fail');
      }
      resolveWithSdp();
    }, effectiveTimeout);

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        resolveWithSdp();
      }
    };

    // Also listen for individual candidates as a fallback
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        candidateCount++;
        // On mobile, if we have at least one valid candidate and have waited a bit,
        // we can proceed since gathering can be slow
        if (isMobileWeb() && candidateCount >= 2) {
          // Give a little more time for additional candidates but don't wait forever
          if (timeout) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              console.log('Mobile: proceeding with gathered candidates');
              resolveWithSdp();
            }, 2000);
          }
        }
      } else if (event.candidate === null) {
        // null candidate means gathering is complete
        resolveWithSdp();
      }
    };

    // Check if already complete (handles synchronous completion case)
    if (pc.iceGatheringState === 'complete') {
      resolveWithSdp();
    }
  });
}

/**
 * Handle incoming events from the OpenAI Realtime API via data channel.
 */
function handleRealtimeEvent(msg: RealtimeEvent, state: StreamingState) {
  switch (msg.type) {
    case 'conversation.item.input_audio_transcription.delta': {
      // Streaming delta - append to buffer
      const deltaMsg = msg as TranscriptionDeltaEvent;
      if (deltaMsg.item_id !== state.currentItemId) {
        // New transcription item (new speech segment after pause, or first speech after text input)
        // Add newline separator if we have previous content
        if (state.transcriptBuffer) {
          state.transcriptBuffer += '\n';
        }
        state.currentItemId = deltaMsg.item_id;
      }
      state.transcriptBuffer += deltaMsg.delta ?? '';
      state.onText?.(state.transcriptBuffer);
      break;
    }

    case 'conversation.item.input_audio_transcription.completed': {
      // Final transcript for this item - just update the current item ID
      // The buffer already has the full text from deltas
      state.currentItemId = null;
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
