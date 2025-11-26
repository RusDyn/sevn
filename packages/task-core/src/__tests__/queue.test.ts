import {
  QUEUE_WINDOW_SIZE,
  deriveVisibleQueue,
  buildPositionUpdates,
  normalizeQueuePositions,
  reduceQueueChange,
  reorderQueue,
} from '../queue';

const buildTasks = (count: number) =>
  Array.from({ length: count }).map((_, index) => ({
    id: `task-${index + 1}`,
    position: index + 1,
  }));

const buildQueueTask = (id: string, position: number) => ({ id, position }) as any;

describe('queue helpers', () => {
  it('normalizes queue positions with gaps', () => {
    const tasks = [
      { id: 'a', position: 5 },
      { id: 'b', position: 2 },
      { id: 'c', position: 8 },
    ];

    expect(normalizeQueuePositions(tasks)).toEqual([
      { id: 'b', position: 1 },
      { id: 'a', position: 2 },
      { id: 'c', position: 3 },
    ]);
  });

  it('reorders tasks and resequences positions', () => {
    const tasks = buildTasks(4);

    const result = reorderQueue(tasks, { taskId: 'task-4', toIndex: 0 });

    expect(result.map((task) => task.id)).toEqual(['task-4', 'task-1', 'task-2', 'task-3']);
    expect(result.map((task) => task.position)).toEqual([1, 2, 3, 4]);
  });

  it('builds a minimal set of updates for Supabase', () => {
    const tasks = buildTasks(3);

    const updates = buildPositionUpdates(tasks, { taskId: 'task-1', toIndex: 2 });

    expect(updates).toEqual([
      { id: 'task-2', position: 1 },
      { id: 'task-3', position: 2 },
      { id: 'task-1', position: 3 },
    ]);
  });

  it('derives a visible window even when fewer tasks exist', () => {
    const tasks = deriveVisibleQueue(
      [buildQueueTask('a', 2), buildQueueTask('b', 1)] as any,
      QUEUE_WINDOW_SIZE
    );

    expect(tasks).toEqual([
      expect.objectContaining({ id: 'b', position: 1 }),
      expect.objectContaining({ id: 'a', position: 2 }),
    ]);
  });

  it('fills the window from lower priority rows after removals', () => {
    const initialQueue = normalizeQueuePositions([
      ...buildTasks(9).map((task) => buildQueueTask(task.id, task.position)),
    ] as any);

    const afterDelete = reduceQueueChange(initialQueue as any, {
      eventType: 'DELETE',
      old: { id: 'task-1' } as any,
    });

    const visibleQueue = deriveVisibleQueue(afterDelete as any);

    expect(visibleQueue).toHaveLength(QUEUE_WINDOW_SIZE);
    expect(visibleQueue[visibleQueue.length - 1]).toEqual(
      expect.objectContaining({ id: 'task-8', position: 7 })
    );
  });

  it('handles concurrent updates by normalizing positions deterministically', () => {
    const base = normalizeQueuePositions(
      buildTasks(7).map((task) => buildQueueTask(task.id, task.position)) as any
    );

    const afterFirstUpdate = reduceQueueChange(base as any, {
      eventType: 'UPDATE',
      new: { id: 'task-3', position: 10 } as any,
    });

    const afterSecondUpdate = reduceQueueChange(afterFirstUpdate as any, {
      eventType: 'UPDATE',
      new: { id: 'task-3', position: 2 } as any,
    });

    const visibleQueue = deriveVisibleQueue(afterSecondUpdate as any);

    expect(visibleQueue.map((task) => task.id)).toContain('task-3');
    expect(visibleQueue.find((task) => task.id === 'task-3')?.position).toBe(2);
    expect(visibleQueue).toHaveLength(7);
  });
});
