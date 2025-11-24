import { type TaskClient, useEnvTaskClient } from '@sevn/task-core';

export const useTaskClient = (): TaskClient | null => useEnvTaskClient();
