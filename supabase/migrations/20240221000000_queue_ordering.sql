-- Ensure active queue ordering remains stable and efficient
alter table if exists public.tasks
  add constraint if not exists tasks_position_positive check (position > 0);

create index if not exists tasks_owner_state_position_idx
  on public.tasks (owner_id, state, position);

-- Re-sequence all active tasks for an owner so positions are contiguous
create or replace function public.resequence_active_tasks(p_owner uuid)
returns setof public.tasks
language sql
security definer
set search_path = public
as $$
  with ordered as (
    select id, row_number() over(order by position asc, created_at asc) as new_position
    from public.tasks
    where owner_id = p_owner
      and state not in ('done', 'archived')
  ), updated as (
    update public.tasks t
    set position = ordered.new_position
    from ordered
    where t.id = ordered.id and t.position is distinct from ordered.new_position
    returning t.*
  )
  select * from updated;
$$;

do $$
declare
  r record;
begin
  for r in (
    select distinct owner_id
    from public.tasks
    where state not in ('done', 'archived')
  ) loop
    perform resequence_active_tasks(r.owner_id);
  end loop;
end$$;

create unique index if not exists tasks_owner_active_position_idx
  on public.tasks (owner_id, position)
  where state not in ('done', 'archived');

-- Move a task to a zero-based index and normalize the remaining queue atomically
create or replace function public.reorder_task_queue(p_task_id uuid, p_owner uuid, p_to_index int)
returns setof public.tasks
language sql
security definer
set search_path = public
as $$
  with active as (
    select id, row_number() over(order by position asc, created_at asc) as rn
    from public.tasks
    where owner_id = p_owner
      and state not in ('done', 'archived')
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

-- Mark a task complete and close the gap in the queue in one transaction
create or replace function public.complete_task_and_resequence(p_task_id uuid, p_owner uuid)
returns setof public.tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks
  set state = 'done'
  where id = p_task_id;

  return query select * from resequence_active_tasks(p_owner);
end;
$$;

-- Delete a task and resequence the remaining active tasks
create or replace function public.delete_task_and_resequence(p_task_id uuid, p_owner uuid)
returns setof public.tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.tasks where id = p_task_id;
  return query select * from resequence_active_tasks(p_owner);
end;
$$;

-- Push a task to the back of the queue atomically
create or replace function public.deprioritize_task_to_bottom(p_task_id uuid, p_owner uuid)
returns setof public.tasks
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tasks
  set position = coalesce(
    (select max(position) + 1 from public.tasks where owner_id = p_owner and state not in ('done', 'archived')),
    1
  )
  where id = p_task_id;

  return query select * from resequence_active_tasks(p_owner);
end;
$$;
