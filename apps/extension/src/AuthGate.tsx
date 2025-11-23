import type { TaskClient } from '@sevn/task-core';
import { useTaskSession } from '@sevn/task-core';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Paragraph, Strong } from '@sevn/ui';

export type AuthGateProps = {
  client: TaskClient | null;
  children: (context: { ownerId: string; client: TaskClient; signOut: () => Promise<void> }) => ReactNode;
};

export const AuthGate = ({ client, children }: AuthGateProps) => {
  const { client: authedClient, ownerId, loading, status, invalidSession, signInWithEmail, signOut } =
    useTaskSession(client);

  if (status === 'missing-client') {
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

  if (invalidSession) {
    return (
      <View style={styles.panel}>
        <Paragraph style={styles.heading}>
          <Strong>Session needs attention</Strong>
        </Paragraph>
        <Paragraph style={styles.helper}>We couldn&apos;t restore your account. Please sign in again.</Paragraph>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void signOut()}>
          <Paragraph style={styles.buttonText}>Reset session</Paragraph>
        </Pressable>
      </View>
    );
  }

  if (!ownerId || !authedClient) {
    return <SignInPanel onSubmit={signInWithEmail} />;
  }

  return <>{children({ ownerId, client: authedClient, signOut: async () => void signOut() })}</>;
};

const SignInPanel = ({
  onSubmit,
}: {
  onSubmit: (email: string, password: string) => Promise<{ error: { message?: string } | null }>;
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await onSubmit(email.trim(), password);
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
