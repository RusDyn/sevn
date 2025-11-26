import { applyPositionsToDrafts, sanitizeDraft } from '../decomposition';
import type { TaskDraft, TaskRow } from '../types';

describe('task decomposition helpers', () => {
  const baseQueue: TaskRow[] = [
    {
      id: 'task-a',
      title: 'Initial task',
      description: null,
      position: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      owner_id: 'owner-1',
    },
    {
      id: 'task-b',
      title: 'Blocked task',
      description: 'waiting',
      position: 3,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      owner_id: 'owner-1',
    },
  ];

  it('sanitizes drafts with sensible defaults', () => {
    const draft: TaskDraft = { title: '  Ship release  ', description: undefined };

    expect(sanitizeDraft(draft)).toEqual({
      title: 'Ship release',
      description: null,
    });
  });

  it('appends drafts to the end of the active queue with normalized positions', () => {
    const drafts: TaskDraft[] = [
      { title: 'Gather requirements' },
      { title: 'Draft spec', description: 'Outline the happy path' },
    ];

    const inserts = applyPositionsToDrafts(baseQueue, drafts, 'owner-1');

    expect(inserts.map((task) => task.position)).toEqual([3, 4]);
    expect(inserts.every((task) => task.owner_id === 'owner-1')).toBe(true);
    expect(inserts[0]).toEqual(
      expect.objectContaining({ title: 'Gather requirements' })
    );
  });

  it('drops drafts without a usable title', () => {
    const drafts: TaskDraft[] = [{ title: '   ' }, { title: 'Keep me' }];

    const inserts = applyPositionsToDrafts([], drafts, 'owner-1');

    expect(inserts).toHaveLength(1);
    expect(inserts[0].title).toBe('Keep me');
  });
});
