import { QueueMove, TaskRow } from './types';

export type PositionedTask = Pick<TaskRow, 'id' | 'position'>;

export type QueueChangePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: TaskRow | null;
  old?: TaskRow | null;
};

export const QUEUE_WINDOW_SIZE = 7;

export const isQueueTask = (task: TaskRow) => task.state !== 'done' && task.state !== 'archived';

const sortByPosition = (tasks: PositionedTask[]): PositionedTask[] =>
  [...tasks].sort((a, b) => a.position - b.position);

const clampIndex = (value: number, max: number) => {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
};

export const deriveVisibleQueue = (tasks: TaskRow[], size: number = QUEUE_WINDOW_SIZE) =>
  normalizeQueuePositions(tasks.filter(isQueueTask)).slice(0, size);

export const normalizeQueuePositions = <T extends PositionedTask>(tasks: T[]): T[] =>
  sortByPosition(tasks).map((task, index) => ({
    ...task,
    position: index + 1,
  }));

export const reorderQueue = <T extends PositionedTask>(tasks: T[], move: QueueMove): T[] => {
  const ordered = sortByPosition(tasks);
  const currentIndex = ordered.findIndex((task) => task.id === move.taskId);

  if (currentIndex === -1) return normalizeQueuePositions(ordered);

  const [removed] = ordered.splice(currentIndex, 1);
  const destination = clampIndex(move.toIndex, ordered.length);
  ordered.splice(destination, 0, removed);

  return normalizeQueuePositions(ordered);
};

export const buildPositionUpdates = (
  tasks: PositionedTask[],
  move: QueueMove
): PositionedTask[] => {
  const reordered = reorderQueue(tasks, move);
  const originalPositions = tasks.reduce<Record<string, number>>((positions, task) => {
    positions[task.id] = task.position;
    return positions;
  }, {});

  return reordered.filter((task) => originalPositions[task.id] !== task.position);
};

export const reduceQueueChange = (tasks: TaskRow[], payload: QueueChangePayload): TaskRow[] => {
  if (payload.eventType === 'INSERT') {
    const nextTask = payload.new as TaskRow;
    if (!isQueueTask(nextTask)) return normalizeQueuePositions(tasks);

    return normalizeQueuePositions([...tasks, nextTask]);
  }

  if (payload.eventType === 'UPDATE') {
    const updated = payload.new as TaskRow;
    if (!isQueueTask(updated)) {
      return normalizeQueuePositions(tasks.filter((task) => task.id !== updated.id));
    }

    const nextTasks = tasks.some((task) => task.id === updated.id)
      ? tasks.map((task) => (task.id === updated.id ? updated : task))
      : [...tasks, updated];

    return normalizeQueuePositions(nextTasks);
  }

  if (payload.eventType === 'DELETE') {
    const removed = payload.old as TaskRow;
    return normalizeQueuePositions(tasks.filter((task) => task.id !== removed.id));
  }

  return normalizeQueuePositions(tasks);
};
