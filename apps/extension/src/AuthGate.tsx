import type { TaskClient } from '@acme/task-core';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Paragraph, Strong } from '@acme/ui';

export type AuthGateProps = {
  client: TaskClient | null;
  children: (context: { ownerId: string; session: Session; client: TaskClient; signOut: () => Promise<void> }) => ReactNode;
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

    const { data: listener } = client.client.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [client]);

  if (!client) {
    return (
      <View style={styles.panel}>
        <Paragraph style={styles.heading}>
          <Strong>Connect to Supabase</Strong>
        </Paragraph>
        <Paragraph style={styles.helper}>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to sign in.</Paragraph>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.panel}>
        <ActivityIndicator />
        <Paragraph style={styles.helper}>Restoring your session…</Paragraph>
      </View>
    );
  }

  if (!session?.user?.id) {
    return <SignInPanel client={client} />;
  }

  return <>{children({ ownerId: session.user.id, session, client, signOut: client.auth.signOut })}</>;
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
    <View style={styles.panel}>
      <Paragraph style={styles.heading}>
        <Strong>Sign in</Strong>
      </Paragraph>
      <Paragraph style={styles.helper}>Use your Supabase email and password to continue.</Paragraph>
      <View style={styles.fieldRow}>
        <Paragraph style={styles.label}>Email</Paragraph>
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
        <Paragraph style={styles.label}>Password</Paragraph>
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
      {error ? <Paragraph style={styles.error}>{error}</Paragraph> : null}
      <Pressable
        accessibilityRole="button"
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={handleSubmit}
      >
        <Paragraph style={styles.buttonText}>{submitting ? 'Signing in…' : 'Sign in'}</Paragraph>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    gap: 12,
  },
  helper: {
    color: '#e5e7eb',
  },
  heading: {
    color: '#e5e7eb',
  },
  fieldRow: {
    gap: 6,
  },
  label: {
    color: '#e5e7eb',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e5e7eb',
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
    color: '#0b1221',
    fontWeight: '700',
  },
  error: {
    color: '#f87171',
  },
});
