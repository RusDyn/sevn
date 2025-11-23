import { deriveFocusMessages, initialProgressSnapshot, type FocusMessage } from '@acme/task-core';
import { Paragraph } from '@acme/ui';
import { ComponentProps, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

export type SevnFocusScreenProps = ComponentProps<typeof View> & {
  title?: string;
  messages?: Partial<FocusMessage>;
};

const defaultMessages = deriveFocusMessages(initialProgressSnapshot);

export const SevnFocusScreen = ({
  title = 'Sevn Focus',
  messages,
  style,
  children,
  ...props
}: SevnFocusScreenProps) => {
  const mergedMessages = useMemo(
    () => ({ ...defaultMessages, ...messages }),
    [messages],
  );

  return (
    <View {...props} style={[styles.container, style]}>
      <Paragraph style={styles.title}>{title}</Paragraph>
      <Paragraph style={styles.subtitle}>{mergedMessages.header}</Paragraph>
      {children ? <View style={styles.slots}>{children}</View> : null}
      <Paragraph style={styles.footer}>{mergedMessages.footer}</Paragraph>
    </View>
  );
};

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
    color: '#cbd5e1',
  },
  footer: {
    marginTop: 8,
    textAlign: 'center',
    color: '#94a3b8',
  },
  slots: {
    marginTop: 16,
    width: '100%',
  },
});
