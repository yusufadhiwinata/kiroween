# Requirements — GRAVEYARD v4.0

Derived from #[[file:prd.md]]. Acceptance criteria use EARS notation.

## R1 Splash & onboarding
- WHEN the app cold-starts THE SYSTEM SHALL show an animated splash (moon reveal, bats, fog, logo) and continue once the session is restored.
- WHEN onboarding has not been completed THE SYSTEM SHALL present the story pages and ask permission before playing any sound.
- WHERE Reduce Motion is on THE SYSTEM SHALL show the splash without movement.

## R2 Authentication
- THE SYSTEM SHALL support email sign-up, sign-in, password reset by emailed code, persistent sessions, and sign-out via Supabase Auth.
- WHEN a user signs out THE SYSTEM SHALL warn about unsynced changes and clear local user data.
- WHERE no backend is configured THE SYSTEM SHALL allow a fully offline "Wandering Keeper" mode.

## R3 Home
- THE SYSTEM SHALL show greeting, avatar, level, Soul Energy toward the active region, ritual progress, top active quests, world status, and shortcuts to Focus and the Dark Keeper.
- THE SYSTEM SHALL change the Home scene art as the world is restored (night → haunted → dusk → day).

## R4 Quests
- THE SYSTEM SHALL let the user create, edit, delete and complete quests with deadline, priority, difficulty, category and daily/weekly recurrence, plus search and filters (All, Today, Weekly, Boss, Done, category).
- WHEN a quest is completed THE SYSTEM SHALL grant 10/25/50/100 XP by difficulty, validated by the server.
- WHEN a recurring quest is completed THE SYSTEM SHALL reward it at most once per period and advance its deadline.

## R5 Rituals
- THE SYSTEM SHALL support daily, weekly (N× per week) and custom-day rituals with streaks, completion history and optional reminders.
- WHEN a reminder is enabled THE SYSTEM SHALL post a local notification at the chosen time on scheduled days, including after reboot.

## R6 World
- THE SYSTEM SHALL show four regions, each in one of: locked, abandoned, awakening, restoration, restored.
- WHEN XP is verified THE SYSTEM SHALL channel the same amount of Soul Energy into unlocked regions in order; regions unlock by Keeper level (1, 3, 5, 8).

## R7 Soul Ledger
- THE SYSTEM SHALL show daily and weekly XP, quests completed, streaks, focus time, week-over-week trend, XP history and achievements.

## R8 Focus Chamber
- THE SYSTEM SHALL provide Pomodoro, custom, short-break and long-break timers that survive navigation and app restarts, with history, statistics and rewards.
- WHEN in the Focus Chamber THE SYSTEM SHALL play only gentle sound cues.

## R9 Dark Keeper AI
- THE SYSTEM SHALL call a real LLM through an authenticated Edge Function for chat, goal breakdown, quest generation, daily planning, weekly review and habit suggestions.
- WHEN the AI proposes quests or rituals THE SYSTEM SHALL save them only after the user approves each proposal.
- THE SYSTEM SHALL animate the Dark Keeper in idle, thinking, talking, celebrating and error states.

## R10 Achievements
- WHEN achievement criteria are met THE SYSTEM SHALL unlock it once, grant its XP, and unlock any cosmetic it carries, with a cinematic reveal.

## R11 Audio
- THE SYSTEM SHALL switch music and layered ambience by screen with crossfades, never overlap a sound effect with itself, duck ambience for important effects, pause in background, and expose independent Music (45%), Ambience (35%) and SFX (65%) volumes plus a master toggle that persist.

## R12 Backend, security, offline
- THE SYSTEM SHALL enforce RLS and user ownership on every table, write rewards only through idempotent atomic server functions, and keep the LLM key server-side.
- WHILE offline THE SYSTEM SHALL allow creating/completing quests, rituals and focus sessions, and SHALL sync and re-validate them on reconnect.
