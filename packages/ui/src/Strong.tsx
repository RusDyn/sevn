import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

export const Strong = ({ children, style, ...props }: TextProps) => (
  <Text {...props} style={[styles.strong, style as TextStyle]}>
    {children}
  </Text>
);

const styles = StyleSheet.create({
  strong: {
    fontWeight: 'bold',
  },
});
