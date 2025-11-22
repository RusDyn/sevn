export type TaskState = 'backlog' | 'todo' | 'in_progress' | 'blocked' | 'done' | 'archived';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  state: TaskState;
  priority: TaskPriority;
  position: number;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string;
};

export type TaskInsert = Pick<TaskRow, 'title' | 'state' | 'priority' | 'owner_id'> &
  Partial<Pick<TaskRow, 'description' | 'position' | 'due_at'>>;

export type TaskUpdate = Partial<Omit<TaskRow, 'id' | 'owner_id'>>;

export type TaskTable = {
  Row: TaskRow;
  Insert: TaskInsert;
  Update: TaskUpdate;
};

export type Database = {
  public: {
    Tables: {
      tasks: TaskTable;
    };
  };
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
