# Supabase migrations

This directory contains SQL assets needed for the task queue RPC functions used by `packages/task-core`.

To apply the functions to your Supabase project:

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and run `supabase init` in the repo root to link your project (if you haven't already).
2. Run `supabase db push` (or `supabase migration up`) to apply the migrations in the `supabase/migrations` folder.

The `20240221000000_queue_ordering.sql` migration creates the `reorder_task_queue`, `complete_task_and_resequence`, `delete_task_and_resequence`, and `deprioritize_task_to_bottom` functions and supporting indexes/constraints required by the task client RPC calls.

## Edge functions

The `functions/decompose-tasks` Edge Function calls OpenAI to break down a spoken/text prompt into queue-ready task drafts. Deploy it with the Supabase CLI:

```
supabase functions deploy decompose-tasks
```

Required environment variables:

- `OPENAI_API_KEY`: secret key for the LLM provider.
- `OPENAI_MODEL` (optional): overrides the default `gpt-4o-mini` model name.
