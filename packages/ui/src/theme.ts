import { useColorScheme } from 'react-native';

export type Theme = {
  // Base colors
  background: string;
  card: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;

  // Accent colors
  accent: string;
  link: string;

  // Action colors (consistent across themes)
  success: string;
  warning: string;
  error: string;

  // Task-specific
  priority: string;
  state: string;
  position: string;
};

export const darkTheme: Theme = {
  background: '#0b1021',
  card: '#111827',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  border: '#1f2937',

  accent: '#0ea5e9',
  link: '#38bdf8',

  success: '#a3e635',
  warning: '#fbbf24',
  error: '#f87171',

  priority: '#0ea5e9',
  state: '#a5b4fc',
  position: '#cbd5e1',
};

export const lightTheme: Theme = {
  background: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  border: '#e2e8f0',

  accent: '#0284c7',
  link: '#0284c7',

  success: '#65a30d',
  warning: '#d97706',
  error: '#dc2626',

  priority: '#0284c7',
  state: '#6366f1',
  position: '#475569',
};

export const useTheme = (): Theme => {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkTheme : lightTheme;
};
