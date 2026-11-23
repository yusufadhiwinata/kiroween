# Tasks — GRAVEYARD v4.0

- [x] 1. Scaffold React Native 0.88.1 TypeScript app (`mobile/`) and native dependencies
- [x] 2. Asset pipeline: slice `image.png`, generate textures/icons, convert audio to OGG
- [x] 3. Supabase schema (20 tables), grants + RLS, write guards _(R12)_
- [x] 4. Reward functions with idempotency, locking and caps; seed regions/achievements/categories _(R4, R5, R6, R8, R10, R12)_
- [x] 5. Validate migrations on PGlite: isolation, privilege denial, idempotency, caps, LWW, ledger = stats
- [x] 6. Dark Keeper Edge Function with auth, rate limits, token budget, retries, validation _(R9)_
- [x] 7. Mobile core: SQLite ledger, sync engine, progression mirror, stores, Supabase client _(R12)_
- [x] 8. Audio engine with scenes, crossfades, ducking, persistence _(R11)_
- [x] 9. Motion primitives + Reduce Motion gating; cinematic celebrations _(R1, R10)_
- [x] 10. Screens: splash, onboarding, auth, home, quests, rituals, world, ledger, focus, Dark Keeper, achievements, profile, settings _(R1–R10)_
- [x] 11. Native ritual reminders (AlarmManager + boot receiver) _(R5)_
- [x] 12. Typecheck, lint, Metro bundle, release APK
- [ ] 13. Device QA of main flows against a live Supabase project (sign-up → quest → sync → AI proposal)
- [ ] 14. Optional: hosted crash reporting, push notifications via `device_tokens`
