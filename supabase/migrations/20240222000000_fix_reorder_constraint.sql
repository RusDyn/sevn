-- Fix duplicate key violations in queue reordering functions
-- The issue: PostgreSQL checks unique constraints row-by-row during UPDATE,
-- so when positions are shuffled, intermediate states can violate the constraint.
-- Solution: Use a two-phase update - first to negative positions, then to final values.

-- Re-sequence all active tasks for an owner so positions are contiguous
-- Fixed to avoid unique constraint violations during position shuffling
create or replace function public.resequence_active_tasks(p_owner uuid)
returns setof public.tasks
language plpgsql
set search_path = public
as $$
begin
  -- Phase 1: Move all positions to negative (temporary) values
  update public.tasks
  set position = -position
  where owner_id = p_owner
    and state not in ('done', 'archived')
    and position > 0;

  -- Phase 2: Assign final contiguous positions
  with ordered as (
    select id, row_number() over(order by -position asc, created_at asc) as new_position
    from public.tasks
    where owner_id = p_owner
      and state not in ('done', 'archived')
  )
  update public.tasks t
  set position = ordered.new_position
  from ordered
  where t.id = ordered.id;

  -- Return all active tasks
  return query
  select *
  from public.tasks
  where owner_id = p_owner
    and state not in ('done', 'archived')
  order by position;
end;
$$;

-- Move a task to a zero-based index and normalize the remaining queue atomically
-- Fixed to avoid unique constraint violations during position shuffling
create or replace function public.reorder_task_queue(p_task_id uuid, p_owner uuid, p_to_index int)
returns setof public.tasks
language plpgsql
set search_path = public
as $$
declare
  v_max_position int;
  v_target_exists boolean;
begin
  -- Check if target task exists in active tasks
  select exists(
    select 1 from public.tasks
    where id = p_task_id
      and owner_id = p_owner
      and state not in ('done', 'archived')
  ) into v_target_exists;

  if not v_target_exists then
    -- Return empty if task doesn't exist or isn't active
    return;
  end if;

  -- Phase 1: Move all active positions to negative (temporary) values
  update public.tasks
  set position = -position
  where owner_id = p_owner
    and state not in ('done', 'archived')
    and position > 0;

  -- Get max position count (excluding target)
  select count(*) - 1
  into v_max_position
  from public.tasks
  where owner_id = p_owner
    and state not in ('done', 'archived');

  -- Clamp destination index
  p_to_index := least(greatest(p_to_index, 0), greatest(v_max_position, 0));

  -- Phase 2: Assign final positions
  with active_ordered as (
    -- Get all active tasks ordered by their original position (now negative)
    select id, row_number() over(order by -position asc, created_at asc) as rn
    from public.tasks
    where owner_id = p_owner
      and state not in ('done', 'archived')
  ),
  without_target as (
    -- Exclude target and re-number
    select id, row_number() over(order by rn) as rn
    from active_ordered
    where id <> p_task_id
  ),
  reinsert as (
    -- Non-target tasks: shift positions after insertion point
    select id,
           case when rn <= p_to_index then rn else rn + 1 end as new_position
    from without_target
    union all
    -- Target task goes at the destination index + 1 (1-based)
    select p_task_id, p_to_index + 1
  ),
  normalized as (
    -- Ensure contiguous 1-based positions
    select id, row_number() over(order by new_position, id) as final_position
    from reinsert
  )
  update public.tasks t
  set position = normalized.final_position
  from normalized
  where t.id = normalized.id;

  -- Return all active tasks
  return query
  select *
  from public.tasks
  where owner_id = p_owner
    and state not in ('done', 'archived')
  order by position;
end;
$$;
