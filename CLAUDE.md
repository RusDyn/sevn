# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sevn is a minimalist, cross-platform focus tool that shows exactly 7 active tasks. Three swipe actions: right to complete, left to delete, down to deprioritize. Built as a pnpm monorepo with Turborepo orchestration.

## Commands

```bash
# Development
pnpm install                    # Install all dependencies
pnpm dev                        # Start all apps (Turbo)
pnpm dev:mobile                 # Expo app (iOS/Android/Web)
pnpm dev:extension              # Browser extension (Vite)

# Building
pnpm build                      # Build all packages
pnpm build:mobile               # Export mobile bundles
pnpm build:extension            # Type-check & bundle extension

# Quality
pnpm lint                       # ESLint across all workspaces
pnpm test                       # Jest tests across all packages

# Single package operations
pnpm --filter @sevn/task-core test    # Run tests for one package
pnpm --filter @sevn/ui lint           # Lint one package

# Mobile-specific
cd apps/mobile
pnpm android                    # Run on Android
pnpm ios                        # Run on iOS
pnpm web                        # Run web build
```

## Architecture

```
apps/
  mobile/         Expo app (iOS, Android, Web) - expo-router v6
  extension/      Browser extension - Vite + react-native-web

packages/
  task-core/      Supabase client, task types, hooks, RPC wrappers
  ui/             React Native components (TaskCard, TaskQueueBoard, AuthGate)
  feature-home/   SevnFocusScreen - the main 7-task display
  eslint-config/  Shared ESLint rules

supabase/
  migrations/     Database schema + RPC functions
  functions/      Edge functions (decompose-tasks uses OpenAI)
```

### Package Dependencies

```
Mobile/Extension → feature-home → ui → task-core → Supabase
```

All internal dependencies use `workspace:*` protocol.

### Cross-Platform Strategy

- **Shared code**: task-core, ui, and feature-home work on all platforms
- **Mobile**: React Native via Expo
- **Extension**: react-native-web with custom Vite shim at `apps/extension/src/react-native-web-shim.ts`

## Key Patterns

### Task Queue RPC Functions (in Supabase)

Task operations use PostgreSQL RPC functions that handle atomic position updates:
- `reorder_task_queue()` - Reposition tasks
- `complete_task_and_resequence()` - Mark done + shift queue
- `delete_task_and_resequence()` - Remove + shift queue
- `deprioritize_task_to_bottom()` - Move to end of queue

### Environment Variables

**Mobile (Expo):**
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Extension (Vite):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_OWNER_ID` (optional, fixed user)

**Supabase Edge Functions:**
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, defaults to gpt-4o-mini)

## Tech Stack

- **React** 19.1.0, **React Native** 0.81.5
- **Expo** 54 with expo-router 6
- **TypeScript** 5.9 (strict mode)
- **Supabase** (PostgreSQL + Auth + Edge Functions)
- **Vite** 5.4 (extension), **Metro** (mobile)
- **Jest** + Testing Library

## Database Setup

```bash
# Apply migrations to Supabase project
supabase db push

# Deploy edge functions
supabase functions deploy decompose-tasks
```

## Product Constraints

The app enforces these design rules:
- Maximum 7 visible tasks (never more)
- Only three actions: complete, delete, deprioritize
- No tags, priorities, due dates, or archives
- Single-screen philosophy centered on the Focus Screen
