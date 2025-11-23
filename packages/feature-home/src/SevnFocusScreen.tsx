import {
  deriveFocusMessages,
  initialProgressSnapshot,
  useTaskClient,
  type FocusMessage,
} from '@acme/task-core';
import { Paragraph, TaskQueueBoard } from '@acme/ui';
import { ComponentProps, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

export type SevnFocusScreenProps = ComponentProps<typeof View> & {
  title?: string;
  messages?: Partial<FocusMessage>;
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
  const client = useTaskClient(
    supabaseUrl && supabaseKey
      ? { supabaseKey, supabaseUrl, authStorageKey: 'sevn-focus-auth' }
      : null,
  );
  const [ownerId, setOwnerId] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;

    const syncOwnerId = async () => {
      if (!client) {
        setOwnerId(undefined);
        return;
      }

      const { data } = await client.client.auth.getUser();
      if (mounted) {
        setOwnerId(data.user?.id ?? undefined);
      }
    };

    void syncOwnerId();

    if (!client) return undefined;

    const { data: listener } = client.client.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setOwnerId(session?.user?.id ?? undefined);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [client]);

  return (
    <View {...props} style={[styles.container, style]}>
      <Paragraph style={styles.title}>{title}</Paragraph>
      <Paragraph style={styles.subtitle}>{mergedMessages.header}</Paragraph>
      <TaskQueueBoard client={client} ownerId={ownerId} />
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
