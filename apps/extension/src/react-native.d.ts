// Type declarations to augment react-native module for web builds
// These types are not exported by react-native-web but are used by shared UI components

import type { ViewProps as RNWViewProps } from 'react-native-web';
import type { ReactNode, ComponentType } from 'react';

declare module 'react-native' {
  export * from 'react-native-web';

  // useColorScheme is not exported by react-native-web
  export function useColorScheme(): 'light' | 'dark' | null;

  // PanResponder types
  export interface GestureResponderEvent {
    nativeEvent: {
      changedTouches: unknown[];
      identifier: number;
      locationX: number;
      locationY: number;
      pageX: number;
      pageY: number;
      target: number;
      timestamp: number;
      touches: unknown[];
    };
  }

  export interface PanResponderGestureState {
    stateID: number;
    moveX: number;
    moveY: number;
    x0: number;
    y0: number;
    dx: number;
    dy: number;
    vx: number;
    vy: number;
    numberActiveTouches: number;
  }

  export interface PanResponderCallbacks {
    onStartShouldSetPanResponder?: () => boolean;
    onMoveShouldSetPanResponder?: (
      e: GestureResponderEvent,
      gestureState: PanResponderGestureState
    ) => boolean;
    onPanResponderGrant?: () => void;
    onPanResponderMove?: (
      e: GestureResponderEvent,
      gestureState: PanResponderGestureState
    ) => void;
    onPanResponderRelease?: (
      e: GestureResponderEvent,
      gestureState: PanResponderGestureState
    ) => void;
    onPanResponderTerminate?: () => void;
  }

  export interface PanResponderInstance {
    panHandlers: Record<string, unknown>;
  }

  export const PanResponder: {
    create(config: PanResponderCallbacks): PanResponderInstance;
  };

  // Modal types
  export interface ModalProps {
    visible?: boolean;
    animationType?: 'none' | 'slide' | 'fade';
    presentationStyle?: 'fullScreen' | 'pageSheet' | 'formSheet' | 'overFullScreen';
    onRequestClose?: () => void;
    children?: ReactNode;
  }

  export const Modal: ComponentType<ModalProps>;

  // SafeAreaView
  export const SafeAreaView: ComponentType<RNWViewProps>;
}
