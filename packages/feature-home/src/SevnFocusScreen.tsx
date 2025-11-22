import { Paragraph, Strong } from '@acme/ui';
import { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

export type SevnFocusScreenProps = ComponentProps<typeof View> & {
  title?: string;
};

export const SevnFocusScreen = ({ title = 'Sevn Focus', style, children, ...props }: SevnFocusScreenProps) => (
  <View {...props} style={[styles.container, style]}>
    <Paragraph style={styles.title}>{title}</Paragraph>
    <Paragraph style={styles.subtitle}>
      Stay present and centered with <Strong>Sevn</Strong>.
    </Paragraph>
    {children ? <View style={styles.slots}>{children}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
  },
  slots: {
    marginTop: 12,
    width: '100%',
  },
});
