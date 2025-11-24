-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create task_state enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_state') then
    create type task_state as enum ('backlog', 'todo', 'in_progress', 'blocked', 'done', 'archived');
  end if;
end $$;

-- Create task_priority enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type task_priority as enum ('low', 'medium', 'high', 'urgent');
  end if;
end $$;

-- Create tasks table
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  state task_state not null default 'todo',
  priority task_priority not null default 'medium',
  position integer not null default 1,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_id uuid not null references auth.users(id) on delete cascade
);

-- Enable realtime replication for tasks
alter table public.tasks replica identity full;
alter publication supabase_realtime add table public.tasks;

-- Enable Row Level Security
alter table public.tasks enable row level security;

-- Create RLS policies
-- Users can only see their own tasks
create policy "Users can view their own tasks"
  on public.tasks for select
  using (auth.uid() = owner_id);

-- Users can only insert their own tasks
create policy "Users can insert their own tasks"
  on public.tasks for insert
  with check (auth.uid() = owner_id);

-- Users can only update their own tasks
create policy "Users can update their own tasks"
  on public.tasks for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Users can only delete their own tasks
create policy "Users can delete their own tasks"
  on public.tasks for delete
  using (auth.uid() = owner_id);

-- Create indexes for common queries
create index if not exists tasks_owner_id_idx on public.tasks (owner_id);
create index if not exists tasks_state_idx on public.tasks (state);
create index if not exists tasks_created_at_idx on public.tasks (created_at);

-- Create trigger to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at
  before update on public.tasks
  for each row
  execute function public.handle_updated_at();
