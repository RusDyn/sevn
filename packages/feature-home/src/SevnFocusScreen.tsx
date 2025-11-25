import {
  deriveFocusMessages,
  initialProgressSnapshot,
  type TaskClient,
  useEnvTaskClient,
  useTaskSession,
  type FocusMessage,
} from '@sevn/task-core';
import { Paragraph, TaskQueueBoard, useTheme, type Theme } from '@sevn/ui';
import { ComponentProps, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { type TaskRow } from '@sevn/task-core';

export type SevnFocusScreenProps = ComponentProps<typeof View> & {
  title?: string;
  messages?: Partial<FocusMessage>;
  client?: TaskClient | null;
  ownerId?: string;
  userEmail?: string;
  onSignOut?: () => void;
  tasks: TaskRow[];
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onDeprioritize: (id: string) => void;
  onPressTask?: (task: TaskRow) => void;
};

const defaultMessages = deriveFocusMessages(initialProgressSnapshot);

export const SevnFocusScreen = ({
  title = 'Sevn',
  messages,
  client,
  ownerId,
  userEmail,
  onSignOut,
  style,
  children,
  tasks,
  onComplete,
  onDelete,
  onDeprioritize,
  onPressTask,
  ...props
}: SevnFocusScreenProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mergedMessages = useMemo(() => ({ ...defaultMessages, ...messages }), [messages]);
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
      {userEmail && onSignOut ? (
        <View style={styles.accountRow}>
          <Paragraph style={styles.accountEmail} numberOfLines={1}>
            {userEmail}
          </Paragraph>
          <Paragraph style={styles.accountDot}>•</Paragraph>
          <Pressable onPress={onSignOut} accessibilityRole="button" accessibilityLabel="Sign out">
            <Paragraph style={styles.signOutLink}>Sign out</Paragraph>
          </Pressable>
        </View>
      ) : null}
      <Paragraph style={styles.subtitle}>{mergedMessages.header}</Paragraph>
      <TaskQueueBoard
        tasks={tasks}
        onComplete={onComplete}
        onDelete={onDelete}
        onDeprioritize={onDeprioritize}
        onPressTask={onPressTask}
      />
      {children ? <View style={styles.slots}>{children}</View> : null}
      <Paragraph style={styles.footer}>{mergedMessages.footer ?? null}</Paragraph>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      width: '100%',
      maxWidth: 1024,
      alignSelf: 'center',
      alignItems: 'center',
      gap: 8,
      padding: 16,
      paddingBottom: 96,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      textAlign: 'center',
      width: '100%',
    },
    accountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-end',
      gap: 6,
      marginBottom: 4,
    },
    accountEmail: {
      color: theme.textMuted,
      fontSize: 13,
      maxWidth: 180,
    },
    accountDot: {
      color: theme.textMuted,
      fontSize: 13,
    },
    signOutLink: {
      color: theme.link,
      fontSize: 13,
    },
    subtitle: {
      textAlign: 'center',
      color: theme.textSecondary,
      width: '100%',
    },
    footer: {
      marginTop: 'auto',
      paddingTop: 16,
      textAlign: 'center',
      color: theme.textMuted,
      width: '100%',
    },
    slots: {
      width: '100%',
    },
  });
