# Supabase migrations

This directory contains SQL assets needed for the task queue RPC functions used by `packages/task-core`.

To apply the functions to your Supabase project:

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and run `supabase init` in the repo root to link your project (if you haven't already).
2. Run `supabase db push` (or `supabase migration up`) to apply the migrations in the `supabase/migrations` folder.

The `20240221000000_queue_ordering.sql` migration creates the `reorder_task_queue`, `complete_task_and_resequence`, `delete_task_and_resequence`, and `deprioritize_task_to_bottom` functions and supporting indexes/constraints required by the task client RPC calls.
