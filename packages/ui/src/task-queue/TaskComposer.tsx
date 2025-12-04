import { type TaskAnalyticsEvent, type TaskClient, type TaskDraft } from '@sevn/task-core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { type Theme, useTheme } from '../theme';

export type SpeechState = 'idle' | 'recording' | 'transcribing';

export type SpeechAdapter = {
  supported: boolean;
  label?: string;
  start: (
    onText: (transcript: string) => void,
    onStateChange?: (state: SpeechState) => void,
    initialText?: string
  ) => Promise<void>;
  stop?: () => Promise<void>;
};

export type TaskComposerProps = {
  client: TaskClient | null;
  ownerId: string;
  speechAdapter?: SpeechAdapter;
  analytics?: (event: TaskAnalyticsEvent) => void;
  onTaskAdded?: () => void;
};

type ComposerStep = 'input' | 'review';

type SplitTask = TaskDraft & { selected: boolean };

const logAnalytics = (analytics: TaskComposerProps['analytics'], event: TaskAnalyticsEvent) => {
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

export const TaskComposer = ({
  client,
  ownerId,
  speechAdapter,
  analytics,
  onTaskAdded,
}: TaskComposerProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [speechState, setSpeechState] = useState<SpeechState>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [step, setStep] = useState<ComposerStep>('input');
  const [splitTasks, setSplitTasks] = useState<SplitTask[]>([]);
  const activeAdapter = useRef<SpeechAdapter | null>(null);

  const resetState = useCallback(() => {
    setInput('');
    setStep('input');
    setSplitTasks([]);
    setError(null);
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    resetState();
  }, [resetState]);

  useEffect(() => {
    if (isOpen && mode === 'voice' && speechAdapter?.supported) {
      void startTranscription();
    }
    return () => {
      void activeAdapter.current?.stop?.();
    };
  }, [isOpen, mode]);

  const startTranscription = async () => {
    if (!speechAdapter?.supported) return;

    setError(null);
    activeAdapter.current = speechAdapter;
    logAnalytics(analytics, { name: 'capture_started' });

    try {
      await speechAdapter.start(
        (transcript) => {
          setInput(transcript);
        },
        (state) => {
          setSpeechState(state);
        },
        input // Pass existing text to prepend to transcript
      );
    } catch (captureError) {
      const message =
        captureError instanceof Error ? captureError.message : 'Unable to start speech capture.';
      setError(message);
      setSpeechState('idle');
    }
  };

  const handleSwitchToText = useCallback(async () => {
    // Stop any in-progress recording before switching
    if (speechState !== 'idle') {
      await activeAdapter.current?.stop?.();
      setSpeechState('idle');
    }
    setMode('text');
  }, [speechState]);

  const handleSplit = async () => {
    if (!client || !input.trim()) return;
    setSubmitting(true);
    setError(null);

    const { data, error: decompositionError } = await client.decomposition.generate({
      text: input,
    });

    if (decompositionError || !data) {
      setError('Could not reach the AI planner.');
      setSubmitting(false);
      return;
    }

    const tasks = (data.tasks ?? []).map((task) => ({
      ...task,
      selected: true,
    }));

    if (tasks.length === 0) {
      setError('No tasks found in your input.');
      setSubmitting(false);
      return;
    }

    setSplitTasks(tasks);
    setStep('review');
    setSubmitting(false);
    logAnalytics(analytics, { name: 'decomposition_ready', properties: { count: tasks.length } });
  };

  const toggleTask = (index: number) => {
    setSplitTasks((prev) =>
      prev.map((task, i) => (i === index ? { ...task, selected: !task.selected } : task))
    );
  };

  const handleAddTasks = async (position: 'top' | 'bottom' | 'ai') => {
    if (!client) return;

    const tasksToAdd =
      step === 'review'
        ? splitTasks.filter((t) => t.selected).map(({ selected: _selected, ...task }) => task)
        : input.trim()
          ? [{ title: input.trim() }]
          : [];

    if (tasksToAdd.length === 0) return;

    setSubmitting(true);
    setError(null);

    // Map 'ai' to 'auto' for the API
    const positionMode = position === 'ai' ? 'auto' : position;

    // Use unified add-tasks API that handles insert + reorder atomically
    const { data, error: addError } = await client.ai.addTasks({
      newTasks: tasksToAdd.map((t) => ({
        title: t.title,
        description: t.description,
      })),
      position: positionMode,
    });

    if (addError || !data?.tasks || data.tasks.length === 0) {
      setError('Failed to add tasks');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    handleClose();
    onTaskAdded?.();
    logAnalytics(analytics, {
      name: 'tasks_enqueued',
      properties: { count: data.tasks.length, position },
    });
  };

  const selectedCount = splitTasks.filter((t) => t.selected).length;

  return (
    <>
      <View style={styles.fabContainer}>
        <View style={styles.fabInner}>
          <Pressable style={styles.fab} onPress={() => setIsOpen(true)}>
            <Text style={styles.fabIcon}>+</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={isOpen} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.header}>
            {step === 'review' && (
              <Pressable onPress={() => setStep('input')} style={styles.backButton}>
                <Text style={styles.backIcon}>{'\u2190'}</Text>
              </Pressable>
            )}
            <View style={styles.headerSpacer} />
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Text style={styles.closeIcon}>{'\u2715'}</Text>
            </Pressable>
          </View>

          {step === 'input' ? (
            <View style={styles.content}>
              {mode === 'voice' && speechAdapter?.supported ? (
                <View style={styles.voiceContainer}>
                  <Text style={styles.listeningText}>
                    {speechState === 'transcribing'
                      ? 'Transcribing...'
                      : speechState === 'recording'
                        ? 'Recording...'
                        : 'Tap to speak'}
                  </Text>
                  <Pressable
                    style={[styles.micButton, speechState !== 'idle' && styles.micActive]}
                    onPress={speechState === 'recording' ? speechAdapter.stop : startTranscription}
                    disabled={speechState === 'transcribing'}
                  >
                    {speechState === 'transcribing' ? (
                      <ActivityIndicator color={theme.accent} size="small" />
                    ) : (
                      <View style={styles.micInner} />
                    )}
                  </Pressable>
                  <Text style={styles.transcript}>{input || 'Say something...'}</Text>
                  <Pressable onPress={handleSwitchToText}>
                    <Text style={styles.switchMode}>Switch to keyboard</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.textContainer}>
                  <TextInput
                    style={styles.textInput}
                    value={input}
                    onChangeText={setInput}
                    placeholder="What needs to be done?"
                    placeholderTextColor={theme.textMuted}
                    multiline
                    autoFocus
                  />
                  {speechAdapter?.supported && (
                    <Pressable onPress={() => setMode('voice')}>
                      <Text style={styles.switchMode}>Switch to voice</Text>
                    </Pressable>
                  )}
                </View>
              )}

              {error && <Text style={styles.errorText}>{error}</Text>}

              {input.trim() && (
                <View style={styles.optionsContainer}>
                  <Pressable
                    style={styles.optionButton}
                    onPress={handleSplit}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color={theme.text} size="small" />
                    ) : (
                      <Text style={styles.optionText}>{'\u2728'} Split</Text>
                    )}
                  </Pressable>

                  <View style={styles.row}>
                    <Pressable
                      style={[styles.optionButton, styles.aiButton]}
                      onPress={() => handleAddTasks('ai')}
                      disabled={submitting}
                    >
                      <Text style={styles.optionText}>AI Decide</Text>
                    </Pressable>
                    <Pressable
                      style={styles.optionButton}
                      onPress={() => handleAddTasks('top')}
                      disabled={submitting}
                    >
                      <Text style={styles.optionText}>Top</Text>
                    </Pressable>
                    <Pressable
                      style={styles.optionButton}
                      onPress={() => handleAddTasks('bottom')}
                      disabled={submitting}
                    >
                      <Text style={styles.optionText}>Bottom</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.content}>
              <Text style={styles.reviewTitle}>Review tasks</Text>
              <Text style={styles.reviewSubtitle}>
                {selectedCount} of {splitTasks.length} selected
              </Text>

              <ScrollView style={styles.taskList} showsVerticalScrollIndicator={false}>
                {splitTasks.map((task, index) => (
                  <Pressable
                    key={index}
                    style={[styles.taskItem, task.selected && styles.taskItemSelected]}
                    onPress={() => toggleTask(index)}
                  >
                    <View style={[styles.checkbox, task.selected && styles.checkboxSelected]}>
                      {task.selected && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                    </View>
                    <View style={styles.taskContent}>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      {task.description && (
                        <Text style={styles.taskDescription}>{task.description}</Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </ScrollView>

              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.optionsContainer}>
                <View style={styles.row}>
                  <Pressable
                    style={[
                      styles.optionButton,
                      styles.aiButton,
                      selectedCount === 0 && styles.optionDisabled,
                    ]}
                    onPress={() => handleAddTasks('ai')}
                    disabled={selectedCount === 0 || submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color={theme.text} size="small" />
                    ) : (
                      <Text style={styles.optionText}>AI Decide</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.optionButton, selectedCount === 0 && styles.optionDisabled]}
                    onPress={() => handleAddTasks('top')}
                    disabled={selectedCount === 0 || submitting}
                  >
                    <Text style={styles.optionText}>Top</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.optionButton, selectedCount === 0 && styles.optionDisabled]}
                    onPress={() => handleAddTasks('bottom')}
                    disabled={selectedCount === 0 || submitting}
                  >
                    <Text style={styles.optionText}>Bottom</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    fabContainer: {
      position: 'absolute',
      bottom: 24,
      left: 0,
      right: 0,
      alignItems: 'center',
      pointerEvents: 'box-none',
    },
    fabInner: {
      width: '100%',
      maxWidth: 1024,
      alignItems: 'flex-end',
      paddingHorizontal: 24,
      pointerEvents: 'box-none',
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 8,
    },
    fabIcon: {
      fontSize: 32,
      color: '#fff',
      marginTop: -4,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      padding: 16,
      alignItems: 'center',
    },
    headerSpacer: {
      flex: 1,
    },
    backButton: {
      padding: 8,
    },
    backIcon: {
      fontSize: 24,
      color: theme.textMuted,
    },
    closeButton: {
      padding: 8,
    },
    closeIcon: {
      fontSize: 24,
      color: theme.textMuted,
    },
    content: {
      flex: 1,
      padding: 24,
      justifyContent: 'center',
    },
    voiceContainer: {
      alignItems: 'center',
      gap: 32,
    },
    listeningText: {
      color: theme.textSecondary,
      fontSize: 18,
    },
    micButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    micActive: {
      borderColor: theme.accent,
      backgroundColor: `${theme.accent}15`,
    },
    micInner: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.error,
    },
    transcript: {
      color: theme.text,
      fontSize: 24,
      textAlign: 'center',
      minHeight: 100,
    },
    switchMode: {
      color: theme.accent,
      fontSize: 16,
      marginTop: 16,
    },
    switchModeDisabled: {
      opacity: 0.5,
    },
    textContainer: {
      flex: 1,
      gap: 16,
    },
    textInput: {
      fontSize: 24,
      color: theme.text,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    optionsContainer: {
      marginTop: 'auto',
      gap: 12,
    },
    row: {
      flexDirection: 'row',
      gap: 12,
    },
    optionButton: {
      flex: 1,
      backgroundColor: theme.card,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    optionDisabled: {
      opacity: 0.5,
    },
    aiButton: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    optionText: {
      color: theme.text,
      fontWeight: '600',
    },
    errorText: {
      color: theme.error,
      textAlign: 'center',
      marginVertical: 8,
    },
    reviewTitle: {
      color: theme.text,
      fontSize: 24,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 8,
    },
    reviewSubtitle: {
      color: theme.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 24,
    },
    taskList: {
      flex: 1,
      marginBottom: 16,
    },
    taskItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 16,
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
      gap: 12,
    },
    taskItemSelected: {
      borderColor: theme.accent,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    checkmark: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
    taskContent: {
      flex: 1,
      gap: 4,
    },
    taskTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '600',
    },
    taskDescription: {
      color: theme.textSecondary,
      fontSize: 14,
    },
  });
