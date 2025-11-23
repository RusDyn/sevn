import type { TaskClient } from '@acme/task-core';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export type AuthGateProps = {
  client: TaskClient | null;
  children: (context: {
    session: Session;
    ownerId: string;
    signOut: () => Promise<void>;
    client: TaskClient;
  }) => ReactNode;
};

export const AuthGate = ({ client, children }: AuthGateProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      setSession(null);
      setLoading(false);
      return undefined;
    }

    let mounted = true;
    setLoading(true);

    const resolveSession = async () => {
      const { data } = await client.client.auth.getSession();
      if (mounted) {
        setSession(data.session ?? null);
        setLoading(false);
      }
    };

    void resolveSession();

    const { data: authListener } = client.client.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [client]);

  if (!client) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="title">Connect to Supabase</ThemedText>
        <ThemedText>Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to sign in.</ThemedText>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
        <ThemedText style={styles.helper}>Restoring your session…</ThemedText>
      </ThemedView>
    );
  }

  if (!session?.user?.id) {
    return <SignInPanel client={client} />;
  }

  return <>{children({ session, ownerId: session.user.id, signOut: client.auth.signOut, client })}</>;
};

const SignInPanel = ({ client }: { client: TaskClient }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await client.auth.signInWithEmail(email.trim(), password);
    if (signInError) {
      setError(signInError.message ?? 'Unable to sign in.');
    }
    setSubmitting(false);
  };

  return (
    <ThemedView style={styles.panel}>
      <ThemedText type="title">Sign in</ThemedText>
      <ThemedText style={styles.helper}>Use your Supabase email and password to continue.</ThemedText>
      <View style={styles.fieldRow}>
        <ThemedText style={styles.label}>Email</ThemedText>
        <TextInput
          value={email}
          onChangeText={setEmail}
          inputMode="email"
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />
      </View>
      <View style={styles.fieldRow}>
        <ThemedText style={styles.label}>Password</ThemedText>
        <TextInput
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />
      </View>
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
      <Pressable
        accessibilityRole="button"
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={handleSubmit}
      >
        <ThemedText style={styles.buttonText}>{submitting ? 'Signing in…' : 'Sign in'}</ThemedText>
      </Pressable>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  helper: {
    textAlign: 'center',
  },
  panel: {
    flex: 1,
    padding: 24,
    gap: 12,
    width: '100%',
  },
  fieldRow: {
    gap: 8,
  },
  label: {
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e2e8f0',
  },
  button: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontWeight: '700',
  },
  error: {
    color: '#ef4444',
  },
});
