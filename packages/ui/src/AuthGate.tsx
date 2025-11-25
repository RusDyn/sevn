import type { TaskClient } from '@sevn/task-core';
import { useTaskSession } from '@sevn/task-core';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
  type ViewStyle,
} from 'react-native';

import { Paragraph } from './Paragraph';
import { Strong } from './Strong';

type AuthView = 'sign-in' | 'sign-up' | 'forgot-password';

type AuthGateTheme = {
  background: string;
  text: string;
  muted: string;
  border: string;
  inputBackground: string;
  button: string;
  buttonText: string;
  link: string;
  error: string;
  success: string;
  placeholder: string;
};

const lightTheme = {
  background: '#ffffff',
  text: '#0f172a',
  muted: '#475569',
  border: '#cbd5e1',
  inputBackground: '#ffffff',
  button: '#0ea5e9',
  buttonText: '#0b1221',
  link: '#0ea5e9',
  error: '#b91c1c',
  success: '#15803d',
  placeholder: '#94a3b8',
};

const darkTheme: AuthGateTheme = {
  background: '#0b1221',
  text: '#e5e7eb',
  muted: '#94a3b8',
  border: '#1f2937',
  inputBackground: '#0f172a',
  button: '#0ea5e9',
  buttonText: '#0b1221',
  link: '#38bdf8',
  error: '#f87171',
  success: '#34d399',
  placeholder: '#94a3b8',
};

export type AuthGateProps = {
  client: TaskClient | null;
  children: (context: {
    ownerId: string;
    userEmail: string | null;
    client: TaskClient;
    signOut: () => Promise<void>;
  }) => ReactNode;
  style?: StyleProp<ViewStyle>;
  missingClientHint?: string;
};

export const AuthGate = ({ client, children, style, missingClientHint }: AuthGateProps) => {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;
  const styles = useMemo(() => createStyles(theme), [theme]);
  const {
    client: authedClient,
    ownerId,
    userEmail,
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
      <View style={[styles.panel, style]}>
        <Paragraph style={styles.heading}>
          <Strong>Connect to Supabase</Strong>
        </Paragraph>
        <Paragraph style={styles.helper}>
          {missingClientHint ?? 'Set your Supabase URL and anon key to sign in.'}
        </Paragraph>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.panel, style]}>
        <ActivityIndicator />
        <Paragraph style={styles.helper}>Restoring your session…</Paragraph>
      </View>
    );
  }

  if (invalidSession) {
    return (
      <View style={[styles.panel, style]}>
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
        panelStyle={style}
        styles={styles}
        theme={theme}
        view={view}
        onChangeView={setView}
        onSignIn={signInWithEmail}
        onSignUp={signUpWithEmail}
        onResetPassword={resetPasswordForEmail}
      />
    );
  }

  return <>{children({ ownerId, userEmail, client: authedClient, signOut: handleSignOut })}</>;
};

const AuthPanels = ({
  styles,
  theme,
  view,
  onChangeView,
  onSignIn,
  onSignUp,
  onResetPassword,
  panelStyle,
}: {
  styles: AuthGateStyles;
  theme: AuthGateTheme;
  view: AuthView;
  onChangeView: (next: AuthView) => void;
  onSignIn: (email: string, password: string) => Promise<{ error: { message?: string } | null }>;
  onSignUp: (email: string, password: string) => Promise<{ error: { message?: string } | null }>;
  onResetPassword: (email: string) => Promise<{ error: { message?: string } | null }>;
  panelStyle?: StyleProp<ViewStyle>;
}) => (
  <>
    {view === 'sign-in' ? (
      <SignInPanel
        panelStyle={panelStyle}
        styles={styles}
        theme={theme}
        onSubmit={onSignIn}
        onShowSignUp={() => onChangeView('sign-up')}
        onShowForgot={() => onChangeView('forgot-password')}
      />
    ) : null}
    {view === 'sign-up' ? (
      <SignUpPanel
        panelStyle={panelStyle}
        styles={styles}
        theme={theme}
        onSubmit={onSignUp}
        onShowSignIn={() => onChangeView('sign-in')}
      />
    ) : null}
    {view === 'forgot-password' ? (
      <ForgotPasswordPanel
        panelStyle={panelStyle}
        styles={styles}
        theme={theme}
        onSubmit={onResetPassword}
        onShowSignIn={() => onChangeView('sign-in')}
      />
    ) : null}
  </>
);

const SignInPanel = ({
  styles,
  theme,
  onSubmit,
  onShowSignUp,
  onShowForgot,
  panelStyle,
}: {
  styles: AuthGateStyles;
  theme: AuthGateTheme;
  onSubmit: (email: string, password: string) => Promise<{ error: { message?: string } | null }>;
  onShowSignUp: () => void;
  onShowForgot: () => void;
  panelStyle?: StyleProp<ViewStyle>;
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
    <View style={[styles.panel, panelStyle]}>
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
          placeholderTextColor={theme.placeholder}
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
          placeholderTextColor={theme.placeholder}
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
  styles,
  theme,
  onSubmit,
  onShowSignIn,
  panelStyle,
}: {
  styles: AuthGateStyles;
  theme: AuthGateTheme;
  onSubmit: (email: string, password: string) => Promise<{ error: { message?: string } | null }>;
  onShowSignIn: () => void;
  panelStyle?: StyleProp<ViewStyle>;
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
    <View style={[styles.panel, panelStyle]}>
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
          placeholderTextColor={theme.placeholder}
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
          placeholderTextColor={theme.placeholder}
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
          placeholderTextColor={theme.placeholder}
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
  styles,
  theme,
  onSubmit,
  onShowSignIn,
  panelStyle,
}: {
  styles: AuthGateStyles;
  theme: AuthGateTheme;
  onSubmit: (email: string) => Promise<{ error: { message?: string } | null }>;
  onShowSignIn: () => void;
  panelStyle?: StyleProp<ViewStyle>;
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
    <View style={[styles.panel, panelStyle]}>
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
          placeholderTextColor={theme.placeholder}
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

const createStyles = (theme: AuthGateTheme) =>
  StyleSheet.create({
    panel: {
      gap: 12,
      width: '100%',
      backgroundColor: theme.background,
    },
    helper: {
      color: theme.muted,
    },
    heading: {
      color: theme.text,
    },
    fieldRow: {
      gap: 6,
    },
    label: {
      color: theme.text,
      fontWeight: '600',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      backgroundColor: theme.inputBackground,
    },
    button: {
      backgroundColor: theme.button,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: theme.buttonText,
      fontWeight: '700',
    },
    error: {
      color: theme.error,
    },
    success: {
      color: theme.success,
    },
    linkRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    link: {
      color: theme.link,
      fontWeight: '700',
    },
  });

type AuthGateStyles = ReturnType<typeof createStyles>;
