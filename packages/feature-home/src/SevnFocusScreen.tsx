import {
  deriveFocusMessages,
  initialProgressSnapshot,
  type TaskClient,
  useEnvTaskClient,
  useTaskSession,
  type FocusMessage,
} from '@acme/task-core';
import { Paragraph, TaskQueueBoard } from '@acme/ui';
import { ComponentProps, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

export type SevnFocusScreenProps = ComponentProps<typeof View> & {
  title?: string;
  messages?: Partial<FocusMessage>;
  client?: TaskClient | null;
  ownerId?: string;
};

const defaultMessages = deriveFocusMessages(initialProgressSnapshot);

export const SevnFocusScreen = ({
  title = 'Sevn Focus',
  messages,
  client,
  ownerId,
  style,
  children,
  ...props
}: SevnFocusScreenProps) => {
  const mergedMessages = useMemo(
    () => ({ ...defaultMessages, ...messages }),
    [messages],
  );
  const derivedClient = useEnvTaskClient();
  const resolvedClient = client ?? derivedClient;
  const { ownerId: sessionOwnerId, status, loading } = useTaskSession(resolvedClient);
  const resolvedOwnerId = ownerId ?? sessionOwnerId ?? undefined;

  if (!resolvedClient || status === 'missing-client') {
    return (
      <View {...props} style={[styles.container, style]}>
        <Paragraph style={styles.title}>{title}</Paragraph>
        <Paragraph style={styles.subtitle}>Connect to Supabase to view your focus queue.</Paragraph>
      </View>
    );
  }

  if (loading) {
    return (
      <View {...props} style={[styles.container, style]}>
        <Paragraph style={styles.title}>{title}</Paragraph>
        <Paragraph style={styles.subtitle}>Restoring your session…</Paragraph>
      </View>
    );
  }

  if (!resolvedOwnerId || status === 'invalid-session') {
    return (
      <View {...props} style={[styles.container, style]}>
        <Paragraph style={styles.title}>{title}</Paragraph>
        <Paragraph style={styles.subtitle}>Sign in to load your latest tasks.</Paragraph>
      </View>
    );
  }

  return (
    <View {...props} style={[styles.container, style]}>
      <Paragraph style={styles.title}>{title}</Paragraph>
      <Paragraph style={styles.subtitle}>{mergedMessages.header}</Paragraph>
      <TaskQueueBoard client={resolvedClient} ownerId={resolvedOwnerId} />
      {children ? <View style={styles.slots}>{children}</View> : null}
      <Paragraph style={styles.footer}>{mergedMessages.footer ?? null}</Paragraph>
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
    width: '100%',
  },
});
