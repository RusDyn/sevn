import type { TaskRow } from '@sevn/task-core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { type Theme, useTheme } from '../theme';

export type TaskEditModalProps = {
  task: TaskRow | null;
  visible: boolean;
  onSave: (
    taskId: string,
    updates: { title: string; description?: string | null }
  ) => Promise<void>;
  onClose: () => void;
};

export const TaskEditModal = ({ task, visible, onSave, onClose }: TaskEditModalProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
      setError(null);
    }
  }, [task]);

  const handleSave = useCallback(async () => {
    if (!task || !title.trim()) return;

    setSaving(true);
    setError(null);

    try {
      await onSave(task.id, {
        title: title.trim(),
        description: description.trim() || null,
      });
      onClose();
    } catch (_saveError) {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [task, title, description, onSave, onClose]);

  const handleClose = useCallback(() => {
    if (!saving) {
      onClose();
    }
  }, [saving, onClose]);

  const canSave = title.trim().length > 0 && !saving;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleClose} disabled={saving}>
            <Text style={[styles.headerButton, saving && styles.headerButtonDisabled]}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit Task</Text>
          <Pressable onPress={handleSave} disabled={!canSave}>
            {saving ? (
              <ActivityIndicator color={theme.accent} size="small" />
            ) : (
              <Text
                style={[
                  styles.headerButton,
                  styles.saveButton,
                  !canSave && styles.headerButtonDisabled,
                ]}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Task title"
              placeholderTextColor={theme.textMuted}
              autoFocus
              editable={!saving}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add more details..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!saving}
            />
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '600',
    },
    headerButton: {
      color: theme.accent,
      fontSize: 17,
    },
    headerButtonDisabled: {
      opacity: 0.5,
    },
    saveButton: {
      fontWeight: '600',
    },
    content: {
      flex: 1,
      padding: 16,
      gap: 24,
    },
    field: {
      gap: 8,
    },
    label: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    input: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      color: theme.text,
      fontSize: 16,
    },
    textArea: {
      minHeight: 120,
    },
    errorText: {
      color: theme.error,
      fontSize: 14,
      textAlign: 'center',
    },
  });
