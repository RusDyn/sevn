import { buildPositionUpdates, normalizeQueuePositions, reorderQueue } from '../queue';

const buildTasks = (count: number) =>
  Array.from({ length: count }).map((_, index) => ({
    id: `task-${index + 1}`,
    position: index + 1,
  }));

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
});
