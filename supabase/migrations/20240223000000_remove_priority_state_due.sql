-- Remove priority, state, and due_at columns from tasks table
-- Sevn is minimalist: no priorities, due dates, or complex states
-- Completing a task = deleting it (no archive, no done state)
-- Position gaps are allowed (e.g., 1,2,4 after removing 3)

-- Drop indexes that reference state
drop index if exists tasks_state_idx;
drop index if exists tasks_owner_state_position_idx;
drop index if exists tasks_owner_active_position_idx;

-- Remove columns
alter table public.tasks drop column if exists priority;
alter table public.tasks drop column if exists state;
alter table public.tasks drop column if exists due_at;

-- Drop the enums (they're no longer used)
drop type if exists task_priority;
drop type if exists task_state;

-- Recreate index for position ordering (no state filter needed now)
-- Not unique anymore since we allow position gaps
create index if not exists tasks_owner_position_idx
  on public.tasks (owner_id, position);

-- Drop unique constraint on position if it exists
alter table public.tasks drop constraint if exists tasks_owner_active_position_idx;

-- Drop RPC functions (now just direct deletes/updates from client)
drop function if exists public.complete_task_and_resequence(uuid, uuid);
drop function if exists public.delete_task_and_resequence(uuid, uuid);
drop function if exists public.deprioritize_task_to_bottom(uuid, uuid);
drop function if exists public.resequence_active_tasks(uuid);

-- Update reorder function (no state filter)
create or replace function public.reorder_task_queue(p_task_id uuid, p_owner uuid, p_to_index int)
returns setof public.tasks
language sql
set search_path = public
as $$
  with active as (
    select id, row_number() over(order by position asc, created_at asc) as rn
    from public.tasks
    where owner_id = p_owner
  ),
  has_target as (
    select 1 as present
    from active
    where id = p_task_id
    limit 1
  ),
  without_target as (
    select id, row_number() over(order by rn) as rn
    from active
    where id <> p_task_id
  ),
  destination as (
    select least(greatest(p_to_index, 0), coalesce((select max(rn) from without_target), 0)) as dest
  ),
  reinsert as (
    select id, case when rn <= destination.dest then rn else rn + 1 end as new_position
    from without_target
    cross join destination
    union all
    select p_task_id, destination.dest + 1
    from destination
    cross join has_target
  ),
  normalized as (
    select id, row_number() over(order by new_position, id) as position
    from reinsert
  ),
  updated as (
    update public.tasks t
    set position = normalized.position
    from normalized
    where t.id = normalized.id
    returning t.*
  )
  select * from updated;
$$;
