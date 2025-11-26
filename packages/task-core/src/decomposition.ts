import { normalizeQueuePositions, isQueueTask } from './queue';
import type { TaskDraft, TaskInsert, TaskRow } from './types';

export const sanitizeDraft = (draft: TaskDraft): TaskDraft => ({
  title: draft.title.trim(),
  description: draft.description ?? null,
});

export const applyPositionsToDrafts = (
  activeQueue: TaskRow[],
  drafts: TaskDraft[],
  ownerId: string
): TaskInsert[] => {
  const normalizedQueue = normalizeQueuePositions(activeQueue.filter(isQueueTask));
  const startingPosition = normalizedQueue.length;

  return drafts
    .map(sanitizeDraft)
    .filter((draft) => draft.title.length > 0)
    .map((draft, index) => ({
      title: draft.title,
      description: draft.description,
      position: startingPosition + index + 1,
      owner_id: ownerId,
    }));
};

export const buildTaskDraftSummary = (drafts: TaskDraft[]) =>
  drafts.map((draft, index) => `${index + 1}. ${draft.title}`).join('\n');
