import { QueueMove, TaskRow } from './types';

export type PositionedTask = Pick<TaskRow, 'id' | 'position'>;

const sortByPosition = (tasks: PositionedTask[]): PositionedTask[] =>
  [...tasks].sort((a, b) => a.position - b.position);

const clampIndex = (value: number, max: number) => {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
};

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
