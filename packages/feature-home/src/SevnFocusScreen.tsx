import {
  deriveFocusMessages,
  initialProgressSnapshot,
  type TaskClient,
  useTaskClient,
  type FocusMessage,
} from '@acme/task-core';
import { Paragraph, TaskQueueBoard } from '@acme/ui';
import { ComponentProps, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export type SevnFocusScreenProps = ComponentProps<typeof View> & {
  title?: string;
  messages?: Partial<FocusMessage>;
  client?: TaskClient | null;
  ownerId?: string;
};

const defaultMessages = deriveFocusMessages(initialProgressSnapshot);
const resolveSupabaseUrl = () => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  }

  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL;
  }

  return undefined;
};

const resolveSupabaseKey = () => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  }

  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY;
  }

  return undefined;
};

export const SevnFocusScreen = ({
  title = 'Sevn Focus',
  messages,
  client,
  ownerId,
  style,
  children,
  ...props
}: SevnFocusScreenProps) => {
  const supabaseUrl = resolveSupabaseUrl();
  const supabaseKey = resolveSupabaseKey();
  const mergedMessages = useMemo(
    () => ({ ...defaultMessages, ...messages }),
    [messages],
  );
  const clientConfig = useMemo(
    () =>
      client || !supabaseUrl || !supabaseKey
        ? null
        : { supabaseKey, supabaseUrl, authStorageKey: 'sevn-focus-auth' },
    [client, supabaseKey, supabaseUrl],
  );
  const derivedClient = useTaskClient(clientConfig);
  const resolvedClient = client ?? derivedClient;
  const [resolvedOwnerId, setResolvedOwnerId] = useState<string | undefined>(ownerId);

  useEffect(() => {
    let mounted = true;

    const syncOwnerId = async () => {
      if (ownerId !== undefined) {
        setResolvedOwnerId(ownerId);
        return;
      }

      if (!resolvedClient) {
        setResolvedOwnerId(undefined);
        return;
      }

      const { data } = await resolvedClient.client.auth.getUser();
      if (mounted) {
        setResolvedOwnerId(data.user?.id ?? undefined);
      }
    };

    void syncOwnerId();

    if (!resolvedClient || ownerId !== undefined) return undefined;

    const { data: listener } = resolvedClient.client.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setResolvedOwnerId(session?.user?.id ?? undefined);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [ownerId, resolvedClient]);

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
