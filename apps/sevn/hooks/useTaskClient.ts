import { type TaskClient, useEnvTaskClient } from '@acme/task-core';

export const useTaskClient = (): TaskClient | null => useEnvTaskClient();
