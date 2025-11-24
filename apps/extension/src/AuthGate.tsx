import type { TaskClient } from '@sevn/task-core';
import { useTaskSession } from '@sevn/task-core';
import { Paragraph, Strong } from '@sevn/ui';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

type AuthView = 'sign-in' | 'sign-up' | 'forgot-password';

export type AuthGateProps = {
  client: TaskClient | null;
  children: (context: {
    ownerId: string;
    client: TaskClient;
    signOut: () => Promise<void>;
  }) => ReactNode;
};

export const AuthGate = ({ client, children }: AuthGateProps) => {
  const {
    client: authedClient,
    ownerId,
    loading,
    status,
    invalidSession,
    signInWithEmail,
    signUpWithEmail,
    resetPasswordForEmail,
    signOut,
  } = useTaskSession(client);
  const [view, setView] = useState<AuthView>('sign-in');

  const handleSignOut = async () => {
    await signOut();
  };

  if (status === 'missing-client') {
    return (
      <View style={styles.panel}>
        <Paragraph style={styles.heading}>
          <Strong>Connect to Supabase</Strong>
        </Paragraph>
        <Paragraph style={styles.helper}>
          Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to sign in.
        </Paragraph>
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
        <Paragraph style={styles.helper}>
          We couldn&apos;t restore your account. Please sign in again.
        </Paragraph>
        <Pressable accessibilityRole="button" style={styles.button} onPress={handleSignOut}>
          <Paragraph style={styles.buttonText}>Reset session</Paragraph>
        </Pressable>
      </View>
    );
  }

  if (!ownerId || !authedClient) {
    return (
      <AuthPanels
        view={view}
        onChangeView={setView}
        onSignIn={signInWithEmail}
        onSignUp={signUpWithEmail}
        onResetPassword={resetPasswordForEmail}
      />
    );
  }

  return <>{children({ ownerId, client: authedClient, signOut: handleSignOut })}</>;
};

const AuthPanels = ({
  view,
  onChangeView,
  onSignIn,
  onSignUp,
  onResetPassword,
}: {
  view: AuthView;
  onChangeView: (next: AuthView) => void;
  onSignIn: (email: string, password: string) => Promise<{ error: { message?: string } | null }>;
  onSignUp: (email: string, password: string) => Promise<{ error: { message?: string } | null }>;
  onResetPassword: (email: string) => Promise<{ error: { message?: string } | null }>;
}) => (
  <>
    {view === 'sign-in' ? (
      <SignInPanel
        onSubmit={onSignIn}
        onShowSignUp={() => onChangeView('sign-up')}
        onShowForgot={() => onChangeView('forgot-password')}
      />
    ) : null}
    {view === 'sign-up' ? (
      <SignUpPanel onSubmit={onSignUp} onShowSignIn={() => onChangeView('sign-in')} />
    ) : null}
    {view === 'forgot-password' ? (
      <ForgotPasswordPanel
        onSubmit={onResetPassword}
        onShowSignIn={() => onChangeView('sign-in')}
      />
    ) : null}
  </>
);

const SignInPanel = ({
  onSubmit,
  onShowSignUp,
  onShowForgot,
}: {
  onSubmit: (email: string, password: string) => Promise<{ error: { message?: string } | null }>;
  onShowSignUp: () => void;
  onShowForgot: () => void;
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
      <View style={styles.linkRow}>
        <Pressable accessibilityRole="button" onPress={onShowForgot}>
          <Paragraph style={styles.link}>Forgot password?</Paragraph>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onShowSignUp}>
          <Paragraph style={styles.link}>Create account</Paragraph>
        </Pressable>
      </View>
    </View>
  );
};

const SignUpPanel = ({
  onSubmit,
  onShowSignIn,
}: {
  onSubmit: (email: string, password: string) => Promise<{ error: { message?: string } | null }>;
  onShowSignIn: () => void;
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password.trim().length > 0 && password === confirmPassword;
  const canSubmit = email.trim().length > 0 && passwordsMatch && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const { error: signUpError } = await onSubmit(email.trim(), password);
    if (signUpError) {
      setError(signUpError.message ?? 'Unable to sign up.');
    }
    setSubmitting(false);
  };

  return (
    <View style={styles.panel}>
      <Paragraph style={styles.heading}>
        <Strong>Sign up</Strong>
      </Paragraph>
      <Paragraph style={styles.helper}>
        Create an account to sync your tasks across devices.
      </Paragraph>
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
      <View style={styles.fieldRow}>
        <Paragraph style={styles.label}>Confirm password</Paragraph>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          autoCapitalize="none"
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor="#94a3b8"
          style={styles.input}
        />
      </View>
      {!passwordsMatch ? (
        <Paragraph style={styles.error}>Passwords need to match.</Paragraph>
      ) : null}
      {error ? <Paragraph style={styles.error}>{error}</Paragraph> : null}
      <Pressable
        accessibilityRole="button"
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={handleSubmit}
      >
        <Paragraph style={styles.buttonText}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </Paragraph>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onShowSignIn}>
        <Paragraph style={styles.link}>Already have an account? Sign in</Paragraph>
      </Pressable>
    </View>
  );
};

const ForgotPasswordPanel = ({
  onSubmit,
  onShowSignIn,
}: {
  onSubmit: (email: string) => Promise<{ error: { message?: string } | null }>;
  onShowSignIn: () => void;
}) => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    setSubmitting(true);
    setStatusMessage(null);
    setError(null);

    const { error: resetError } = await onSubmit(email.trim());
    if (resetError) {
      setError(resetError.message ?? 'Unable to send reset email.');
    } else {
      setStatusMessage('Check your inbox for a reset link.');
    }

    setSubmitting(false);
  };

  return (
    <View style={styles.panel}>
      <Paragraph style={styles.heading}>
        <Strong>Reset password</Strong>
      </Paragraph>
      <Paragraph style={styles.helper}>
        We&apos;ll email you a secure link to reset your password.
      </Paragraph>
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
      {error ? <Paragraph style={styles.error}>{error}</Paragraph> : null}
      {statusMessage ? <Paragraph style={styles.success}>{statusMessage}</Paragraph> : null}
      <Pressable
        accessibilityRole="button"
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={handleSubmit}
      >
        <Paragraph style={styles.buttonText}>
          {submitting ? 'Sending link…' : 'Send reset link'}
        </Paragraph>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onShowSignIn}>
        <Paragraph style={styles.link}>Return to sign in</Paragraph>
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
  success: {
    color: '#34d399',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  link: {
    color: '#38bdf8',
    fontWeight: '700',
  },
});
