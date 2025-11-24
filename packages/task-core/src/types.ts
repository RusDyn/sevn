import type { Database as GeneratedDatabase, Tables, TablesInsert, TablesUpdate, Enums } from './database.types';

// Re-export the generated Database type
export type Database = GeneratedDatabase;

// Type aliases for easier consumption
export type TaskRow = Tables<'tasks'>;
export type TaskInsert = TablesInsert<'tasks'>;
export type TaskUpdate = TablesUpdate<'tasks'>;
export type TaskState = Enums<'task_state'>;
export type TaskPriority = Enums<'task_priority'>;

export type TaskTable = {
  Row: TaskRow;
  Insert: TaskInsert;
  Update: TaskUpdate;
};

export type TaskSortKey = 'position' | 'created_at' | 'priority';

export type QueueMove = {
  taskId: string;
  toIndex: number;
};

export type TaskDraft = {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  state?: TaskState;
  due_at?: string | null;
};

export type TaskDecompositionRequest = {
  prompt: string;
  ownerId?: string;
  timezone?: string;
  desiredCount?: number;
};

export type TaskDecompositionResponse = {
  tasks: TaskDraft[];
  summary?: string;
};

export type TaskAnalyticsEventName =
  | 'capture_started'
  | 'capture_failed'
  | 'decomposition_ready'
  | 'tasks_enqueued';

export type TaskAnalyticsEvent = {
  name: TaskAnalyticsEventName;
  properties?: Record<string, unknown>;
};
