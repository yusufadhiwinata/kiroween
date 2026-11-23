# Design — GRAVEYARD v4.0

## Data flow
1. A screen calls a `keeperStore` action (e.g. `completeQuest`).
2. The action writes SQLite (`quest_history` row with `sync_status = 'pending'`), enqueues a `sync_ops` row whose id doubles as the server idempotency key, and stores a *provisional* reward on it.
3. `deriveDisplay(serverSnapshot, pendingProvisional[])` recomputes level, Soul Energy, world state and achievements using the same rules as the server. Differences between before/after produce celebration events.
4. `services/sync.ts` replays `sync_ops` in order. Content ops upsert rows (DB trigger enforces last-write-wins on `updated_at` and keeps completion fields server-owned). Reward ops call RPCs; their JSON result includes the new authoritative snapshot.
5. A pull refreshes the snapshot plus 60 days of history, skipping entities that still have pending local ops.

Transient failures stop the queue (order is preserved); permanent rejections mark the op `rejected`, revert the local record and notify the user.

## Server reward functions (`supabase/migrations/…_functions.sql`)
`complete_quest`, `complete_ritual`, `record_focus_session` share one pattern:
`claim_op` (idempotency) → lock `keeper_stats` → validate ownership/state/time window → insert history row (unique per period) → `grant_xp` (unique per source in `xp_transactions`) → counters + streak → `evaluate_achievements` (loops until stable, also calls `sync_world`) → `finish_op` with the result snapshot.

`decide_ai_proposal` turns an approved proposal into a quest (`source = 'ai'`) or ritual, re-validating every field.

## AI Edge Function (`supabase/functions/dark-keeper`)
Verify JWT → validate body (mode enum, 1–2000 chars, UUID) → rate limit (6/min, 120/day) and token budget (150k/day) → verify conversation ownership or create one → build compact context (stats, active quests, rituals, last 7 days) → OpenAI-compatible call with 25 s timeout and 3 attempts → parse/sanitize JSON (`reply`, ≤ 8 `proposals`) → store messages with token usage and pending proposals.

## Audio
`SCENES` maps each screen to one music bed and 0–2 ambience layers with gains. The engine keeps a list of tracks with current/target volume and runs a 60 ms ticker only while something is fading. Overlay scenes (achievement fanfare) push/pop over the base scene.

## Motion
Reusable primitives in `components/effects.tsx` (Fog, Bats, Glow, Wisps, useFloat, useSway). Each primitive checks `useAnimationsActive()` (motion allowed AND screen focused AND app active) and cancels its shared values otherwise.

## Asset pipeline
`scripts/prepare_assets.py` crops sprites from `image.png` using measured bounding boxes, keys out the background colour connected to the crop border, drops neighbouring-sprite slivers (components < 25% of the main blob), recolours nav icons for active/idle, generates fog/glow textures and launcher icons, and converts WAV → OGG.
