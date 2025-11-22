import type { TaskAnalyticsEvent, TaskClient, TaskDraft } from '@acme/task-core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Paragraph } from '../Paragraph';
import { Strong } from '../Strong';

export type SpeechAdapter = {
  supported: boolean;
  label?: string;
  start: (onText: (transcript: string) => void) => Promise<void>;
  stop?: () => Promise<void>;
};

export type TaskComposerProps = {
  client: TaskClient | null;
  ownerId: string;
  speechAdapter?: SpeechAdapter;
  analytics?: (event: TaskAnalyticsEvent) => void;
};

const logAnalytics = (
  analytics: TaskComposerProps['analytics'],
  event: TaskAnalyticsEvent
) => {
  try {
    if (analytics) {
      analytics(event);
      return;
    }

    console.info('[task-intake]', event.name, event.properties ?? {});
  } catch (error) {
    console.warn('Analytics logger failed', error);
  }
};

export const TaskComposer = ({ client, ownerId, speechAdapter, analytics }: TaskComposerProps) => {
  const [input, setInput] = useState('');
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [summary, setSummary] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [listening, setListening] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeAdapter = useRef<SpeechAdapter | null>(null);

  useEffect(() => () => {
    void activeAdapter.current?.stop?.();
  }, []);

  const toggleSelection = (index: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const startTranscription = async () => {
    if (!speechAdapter?.supported) {
      setError('Voice capture is unavailable. Type your task instead.');
      logAnalytics(analytics, { name: 'capture_failed', properties: { reason: 'unsupported' } });
      return;
    }

    setError(null);
    setListening(true);
    activeAdapter.current = speechAdapter;
    logAnalytics(analytics, { name: 'capture_started' });

    try {
      await speechAdapter.start((transcript) => {
        setInput(transcript);
        setListening(false);
      });
    } catch (captureError) {
      setListening(false);
      setError('Unable to start speech capture.');
      logAnalytics(analytics, {
        name: 'capture_failed',
        properties: { message: captureError instanceof Error ? captureError.message : String(captureError) },
      });
    }
  };

  const decompose = async () => {
    if (!client) {
      setError('Task sync is unavailable. Configure Supabase to continue.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const { data, error: decompositionError } = await client.decomposition.generate({
      prompt: input,
      ownerId,
    });

    if (decompositionError || !data) {
      setError('Could not reach the AI planner.');
      logAnalytics(analytics, {
        name: 'capture_failed',
        properties: { reason: 'llm', message: decompositionError?.message },
      });
      setSubmitting(false);
      return;
    }

    const tasks = data.tasks ?? [];
    setDrafts(tasks);
    setSummary(data.summary ?? '');
    setSelected(new Set(tasks.map((_, index) => index)));
    setSubmitting(false);
    logAnalytics(analytics, { name: 'decomposition_ready', properties: { tasks: tasks.length } });
  };

  const enqueue = async () => {
    if (!client) {
      setError('Task sync is unavailable. Configure Supabase to continue.');
      return;
    }

    const chosenTasks = drafts.filter((_, index) => selected.has(index));
    if (chosenTasks.length === 0) {
      setError('Select at least one task to enqueue.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data, error: enqueueError } = await client.decomposition.enqueue(chosenTasks, ownerId);

    setSubmitting(false);

    if (enqueueError) {
      setError('Unable to enqueue tasks. Please try again.');
      logAnalytics(analytics, {
        name: 'capture_failed',
        properties: { reason: 'enqueue', message: enqueueError.message },
      });
      return;
    }

    setInput('');
    setDrafts([]);
    setSelected(new Set());
    setSummary('');
    logAnalytics(analytics, { name: 'tasks_enqueued', properties: { count: data?.length ?? 0 } });
  };

  const instructions = useMemo(
    () =>
      speechAdapter?.supported
        ? 'Tap record and speak the next task you want to accomplish.'
        : 'Voice capture is unavailable on this platform. Use the text box to describe your task.',
    [speechAdapter?.supported]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Paragraph style={styles.heading}>
          <Strong>Capture tasks</Strong>
        </Paragraph>
        <Paragraph style={styles.subhead}>{instructions}</Paragraph>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Describe the task you want to break down"
          placeholderTextColor="#9ca3af"
          value={input}
          multiline
          onChangeText={setInput}
        />
        <Pressable
          style={[styles.micButton, listening && styles.micButtonActive]}
          accessibilityRole="button"
          onPress={startTranscription}
          disabled={!speechAdapter?.supported || listening}
        >
          <Text style={styles.micLabel}>{listening ? 'Listening…' : speechAdapter?.label ?? 'Record'}</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable style={[styles.button, styles.secondary]} onPress={() => setDrafts([])}>
          <Text style={styles.buttonText}>Clear</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.primary, submitting && styles.buttonDisabled]}
          accessibilityRole="button"
          onPress={decompose}
          disabled={submitting || input.trim().length === 0}
        >
          <Text style={styles.primaryText}>{submitting ? 'Planning…' : 'Plan tasks'}</Text>
        </Pressable>
      </View>
      {error ? <Paragraph style={styles.error}>{error}</Paragraph> : null}
      {drafts.length > 0 ? (
        <View style={styles.confirmation}>
          <Paragraph style={styles.heading}>
            <Strong>Confirm the checklist</Strong>
          </Paragraph>
          {summary ? <Paragraph style={styles.summary}>{summary}</Paragraph> : null}
          {drafts.map((draft, index) => (
            <Pressable
              key={`${draft.title}-${index}`}
              style={styles.checkRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected.has(index) }}
              onPress={() => toggleSelection(index)}
            >
              <View style={[styles.checkbox, selected.has(index) && styles.checkboxChecked]} />
              <View style={styles.checkCopy}>
                <Text style={styles.checkTitle}>{draft.title}</Text>
                {draft.description ? <Paragraph style={styles.checkDescription}>{draft.description}</Paragraph> : null}
              </View>
            </Pressable>
          ))}
          <Pressable
            style={[styles.button, styles.primary, submitting && styles.buttonDisabled]}
            accessibilityRole="button"
            onPress={enqueue}
            disabled={submitting}
          >
            <Text style={styles.primaryText}>{submitting ? 'Adding…' : 'Enqueue tasks'}</Text>
          </Pressable>
        </View>
      ) : null}
      <Paragraph style={styles.footer}>
        <Strong>Privacy note:</Strong> Speech capture happens locally when supported; browser users can always fall back to
        keyboard input.
      </Paragraph>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
    padding: 12,
    backgroundColor: '#0b1021',
    borderColor: '#111827',
    borderWidth: 1,
    borderRadius: 12,
  },
  header: {
    gap: 4,
  },
  heading: {
    fontSize: 18,
  },
  subhead: {
    color: '#cbd5e1',
  },
  inputRow: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 80,
    padding: 12,
    color: '#e5e7eb',
  },
  micButton: {
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  micButtonActive: {
    backgroundColor: '#1f2937',
    borderColor: '#6366f1',
  },
  micLabel: {
    color: '#e5e7eb',
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  primary: {
    backgroundColor: '#6366f1',
    borderColor: '#4f46e5',
  },
  secondary: {
    backgroundColor: '#0f172a',
    borderColor: '#1f2937',
  },
  buttonText: {
    color: '#e5e7eb',
    fontWeight: '600',
  },
  primaryText: {
    color: '#0b1021',
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  confirmation: {
    marginTop: 8,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingTop: 8,
  },
  checkRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1f2937',
    backgroundColor: '#0f172a',
  },
  checkboxChecked: {
    backgroundColor: '#22c55e',
    borderColor: '#16a34a',
  },
  checkCopy: {
    flex: 1,
    gap: 4,
  },
  checkTitle: {
    color: '#e5e7eb',
    fontWeight: '700',
  },
  checkDescription: {
    color: '#cbd5e1',
  },
  summary: {
    color: '#cbd5e1',
  },
  error: {
    color: '#f97316',
  },
  footer: {
    marginTop: 8,
    color: '#94a3b8',
  },
});
