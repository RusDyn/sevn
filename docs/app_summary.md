# MVP Requirements — **Sevn**, the 7‑Task Focus App

## 1. Objective
Sevn is a minimalistic, cross‑platform focus tool designed to help people consistently work on what truly matters. It is not a traditional to‑do list, planner, or productivity app. Sevn protects the user’s attention by showing **exactly 7 active tasks** — never more.

Sevn is built on three pillars:
- **Clarity:** Only 7 tasks are visible at any moment.
- **Simplicity:** Only three actions exist — complete, delete, or deprioritize.
- **Psychological safety:** No guilt, no complexity, no overload.

---
## 2. Platforms & Tech Stack

### 2.1 Target Platforms (MVP)
- iOS (mobile)
- Android (mobile)
- Web app (mobile-first responsive)
- Browser extension (Chrome first)

All platforms must share as much business logic and UI philosophy as possible.

### 2.2 Preferred Tech Stack

**Frontend:**
- React (web)
- React Native / Expo (mobile)
- Browser extension built using the web stack
- Optional monorepo (Turborepo/Nx) for shared code

**Backend:**
- Supabase for:
  - Database (PostgreSQL)
  - Auth (email/OAuth)
  - Storage (optional)
  - Edge Functions (AI endpoints)

**AI:**
- One LLM provider for:
  - Voice transcription (or external STT)
  - Task decomposition

**Other:**
- Minimal analytics (PostHog/Amplitude or Supabase events)
- Notifications (later phase, if needed)

---
## 3. Core Principles

1. **Only 7 active tasks are visible** — this is the user’s focus surface.
2. **No scrolling below the top 7** — everything else exists but is intentionally hidden.
3. **One interaction model everywhere:**
   - Swipe **right** → complete (done)
   - Swipe **left** → delete (remove permanently)
   - Swipe **down** → move task to the bottom of the full queue (“not now”)
4. **No archive screen. No secondary lists. No status management.**
5. **No customization:** no tags, no priorities, no due dates.
6. **One screen philosophy** — the entire app experience revolves around the Focus Screen.
7. **Sevn reduces cognitive load** — it does not add new decisions.

---
## 4. User Accounts

- **Authenticated users (MVP):**
  - All data stored in Supabase
  - Sync across mobile, web, extension

Anonymous mode is optional for later phases.

---
## 5. Main Screens & Flows

## 5.1 Sevn’s Only Main Screen — The Focus Screen

Sevn has **a single primary screen** — no lists, no tabs, no navigation stacks of screens.

**Layout:**
- Small text at top:
  - `Clarity streak: X days`
  - `Today: Y tasks done`
- 7 task cards:
  - Task #1 is the largest (most significant)
  - Tasks #2–#6 medium
  - Task #7 partially visible at bottom (non-scrollable)
- Bottom button: `+ Add task`

**User actions (only 3):**
- Swipe **right** → complete task
- Swipe **left** → delete task permanently
- Swipe **down** → push task to bottom of full queue

**System behavior:**
- After any swipe action, tasks shift up.
- The next task from the hidden queue fills the #7 position.
- If fewer than 7 tasks exist, show only existing ones.
- If zero tasks exist → show Empty State.

---
## 5.2 Task Details (Tap to Open)

A simplified details screen:
- Editable title
- Editable description
- No buttons
- Same swipe gestures apply:
  - Swipe right → complete
  - Swipe left → delete
  - Swipe down → move to bottom

Back gesture returns to Focus Screen.

---
## 5.3 Add Task Flow

**Step 1 — Choose input:**
- Large button: `Record with voice`
- Small link: `Type instead`

**Step 2 — Voice/Text Processing:**
- STT → Text → AI
- AI attempts decomposition

**Step 3 — Confirmation:**
- If multiple tasks detected → show checklist
- If single → show preview

**Result:**
- New tasks are appended to **bottom** of full queue.
- User returns to Focus Screen.

---
## 5.4 Empty State

If no tasks exist:
- Message: `Today is clear.`
- Button: `+ Add first task`

---
## 6. Task Model & Queue Logic

### 6.1 States
- `active` (in queue)
- `done`
- `deleted`

No `archived` state.

### 6.2 Task Fields
- `id`
- `user_id`
- `title`
- `description`
- `state`
- `position` (ordering across entire queue)
- `created_at`
- `updated_at`
- `completed_at` (nullable)

### 6.3 Queue Logic
- Visible tasks = first 7 `active` tasks by `position`.
- Swipe right → state = done; task removed; queue compresses.
- Swipe left → state = deleted; task removed.
- Swipe down → set task `position` = max(position) + 1.

This replaces archives, folders, lists, and all task management.

---
## 7. Soft Gamification

Sevn uses calm reinforcement, not gamified pressure.

### 7.1 Focus Streak
- +1 day if ≥1 task completed.
- Never display negative messages.

### 7.2 Micro‑moments
- After 3 tasks done in a row: `You’re in flow.`
- After a productive day: `Nice clarity today.`

No XP, badges, or levels.

---
## 8. Notifications (Optional for MVP)

### If tasks exist:
- Morning notification:
  - `What’s the most important thing today?`

### If tasks were completed:
- Evening reflection:
  - `Good work today. Tomorrow starts clear.`

All notifications must be gentle, not demanding.

---
## 9. Browser Extension (MVP)

Popup view replicates Focus Screen with simplified UI:
- Shows top 7 tasks
- Supports gestures if possible, otherwise small buttons:
  - Done
  - Delete
  - Move down
- Quick Add (text/voice)

Extension mirrors the same Supabase queue.

---
## 10. Non‑Goals

Explicitly excluded from MVP:
- Due dates & reminders per task
- Projects, tags, labels
- Subtasks or hierarchies
- Calendar integrations
- Collaboration
- Multiple lists
- Customization/settings
- Themes

Sevn must remain radically simple.

---
## 11. Acceptance Criteria

1. User **never** sees more than 7 tasks.
2. All three swipe actions work identically on all platforms.
3. Task queue updates correctly in real time.
4. AI decomposition produces logical multi‑task suggestions.
5. Cross‑platform sync works consistently.
6. Experience feels calm, minimal, and focused.

---
## 12. Future Extensions (Post‑MVP)

- Weekly reflection mode
- Deeper AI guidance
- Calendar sync
- Advanced notifications
- iPad/tablet UI

---

Sevn delivers one thing exceptionally well: **clarity**. It helps users focus on the next action without overwhelm, distraction, or cognitive noise.

