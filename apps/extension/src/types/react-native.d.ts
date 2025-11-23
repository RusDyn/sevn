// Type declarations for react-native (mapped to react-native-web in tsconfig)
// react-native-web uses Flow types, so we declare the commonly used exports here
declare module 'react-native' {
  import * as React from 'react';

  export interface ViewStyle {
    [key: string]: any;
  }

  export interface TextStyle {
    [key: string]: any;
  }

  export interface ImageStyle {
    [key: string]: any;
  }

  export type StyleProp<T> = T | T[] | null | undefined;

  export interface ViewProps {
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface TextProps {
    style?: StyleProp<TextStyle>;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface TextInputProps {
    style?: StyleProp<TextStyle>;
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    [key: string]: any;
  }

  export interface PressableProps {
    style?: StyleProp<ViewStyle> | ((state: any) => StyleProp<ViewStyle>);
    onPress?: () => void;
    children?: React.ReactNode | ((state: any) => React.ReactNode);
    [key: string]: any;
  }

  export const View: React.ComponentType<ViewProps>;
  export const Text: React.ComponentType<TextProps>;
  export const TextInput: React.ComponentType<TextInputProps>;
  export const Pressable: React.ComponentType<PressableProps>;
  export const ScrollView: React.ComponentType<any>;
  export const TouchableOpacity: React.ComponentType<any>;
  export const Image: React.ComponentType<any>;

  export const StyleSheet: {
    create<T extends { [key: string]: ViewStyle | TextStyle | ImageStyle }>(styles: T): T;
    flatten<T>(style: StyleProp<T>): T;
    [key: string]: any;
  };

  export const Platform: {
    OS: 'web' | 'ios' | 'android' | 'windows' | 'macos';
    select<T>(specifics: { web?: T; ios?: T; android?: T; default?: T }): T;
    [key: string]: any;
  };

  export const AccessibilityInfo: {
    isReduceMotionEnabled: () => Promise<boolean>;
    isScreenReaderEnabled: () => Promise<boolean>;
    [key: string]: any;
  };
}
