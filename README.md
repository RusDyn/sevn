# Sevn

Sevn keeps you anchored to the seven tasks that matter most. The app centres around a focused queue you can advance with three quick swipe actions: swipe right to complete, swipe left to delete, or swipe down to push a task lower in priority.

## Supported platforms
- **Expo mobile & web (`apps/mobile`)**: The Expo app runs on iOS, Android, and the web using the same shared task queue UI.
- **Browser extension (`apps/extension`)**: A Vite-powered extension that reuses the Sevn focus board so you can pin your queue alongside your daily work.

## Minimal setup
1. Install dependencies with `pnpm install`.
2. Provide Supabase credentials:
   - Expo app & web: set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   - Extension: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and optionally `VITE_SUPABASE_OWNER_ID` for a fixed user).
3. Sign in with your Supabase email/password credentials. Sessions are stored via Supabase auth and reused across launches.

## Core commands
- `pnpm dev:mobile` – Start the Sevn Expo app (mobile + web) in development mode.
- `pnpm build:mobile` – Export the Sevn app bundles for web and native builds.
- `pnpm lint` – Run ESLint across all workspaces.
- `pnpm --filter @sevn/extension dev` – Start the extension in development with Vite.
- `pnpm build:extension` – Type-check and bundle the extension for distribution.

## MVP scope
- Implemented: Supabase email/password login, viewing the seven-task focus queue, adding tasks to the queue, and the three swipe actions (complete, delete, deprioritize).
- Deferred: calendar views, reminders/notifications, shared lists, and offline support.
