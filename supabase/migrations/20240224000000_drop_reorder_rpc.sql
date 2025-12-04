-- Drop reorder_task_queue RPC function
-- Task ordering is now handled by the add-tasks edge function
-- which inserts new tasks and updates existing positions atomically

drop function if exists public.reorder_task_queue(uuid, uuid, int);
