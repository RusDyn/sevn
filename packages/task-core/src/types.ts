import type {
  Database as GeneratedDatabase,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.types';

// Re-export the generated Database type
export type Database = GeneratedDatabase;

// Type aliases for easier consumption
export type TaskRow = Tables<'tasks'>;
export type TaskInsert = TablesInsert<'tasks'>;
export type TaskUpdate = TablesUpdate<'tasks'>;

export type TaskTable = {
  Row: TaskRow;
  Insert: TaskInsert;
  Update: TaskUpdate;
};

export type TaskSortKey = 'position' | 'created_at';

export type QueueMove = {
  taskId: string;
  toIndex: number;
};

export type TaskDraft = {
  title: string;
  description?: string | null;
};

export type TaskDecompositionRequest = {
  text: string;
  timezone?: string;
  desiredCount?: number;
};

export type TaskDecompositionResponse = {
  tasks: TaskDraft[];
  summary?: string;
};

export type TranscriptionResponse = {
  text: string;
  language?: string;
  duration?: number;
};

export type AddTasksRequest = {
  newTasks: Array<{
    title: string;
    description?: string | null;
  }>;
  position: 'auto' | 'top' | 'bottom';
};

export type AddTasksResponse = {
  tasks: Array<{
    id: string;
    title: string;
    description?: string | null;
    position: number;
  }>;
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
