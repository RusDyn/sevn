import React from 'react';
import { View } from 'react-native-web';

export * from 'react-native-web';
export { default } from 'react-native-web';

export const TurboModuleRegistry = {
  getEnforcing: (name: string) => {
    throw new Error(`TurboModule ${name} is not available in the web build.`);
  },
};

// react-native-web doesn't export useColorScheme, provide a fallback
export const useColorScheme = () => 'dark' as const;

// Type stubs for PanResponder (not available in react-native-web)
export type GestureResponderEvent = {
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
};

export type PanResponderGestureState = {
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
};

type PanResponderConfig = {
  onStartShouldSetPanResponder?: () => boolean;
  onMoveShouldSetPanResponder?: (
    e: GestureResponderEvent,
    gestureState: PanResponderGestureState
  ) => boolean;
  onPanResponderGrant?: () => void;
  onPanResponderMove?: (e: GestureResponderEvent, gestureState: PanResponderGestureState) => void;
  onPanResponderRelease?: (
    e: GestureResponderEvent,
    gestureState: PanResponderGestureState
  ) => void;
  onPanResponderTerminate?: () => void;
};

export const PanResponder = {
  create: (_config: PanResponderConfig) => ({
    panHandlers: {},
  }),
};

// Modal stub for web - provide a simple div-based implementation
type ModalProps = {
  visible?: boolean;
  animationType?: 'none' | 'slide' | 'fade';
  presentationStyle?: string;
  onRequestClose?: () => void;
  children?: React.ReactNode;
};

export const Modal = ({ visible, children }: ModalProps) => {
  if (!visible) return null;
  return React.createElement(
    'div',
    {
      style: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          width: '100%',
          maxWidth: 500,
          maxHeight: '90vh',
          overflow: 'auto',
        },
      },
      children
    )
  );
};

// SafeAreaView stub (web doesn't need safe areas)
export const SafeAreaView = View;
