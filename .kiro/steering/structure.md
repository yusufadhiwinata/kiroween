# Project structure

```
mobile/src/
  domain/       pure logic: types, constants (mirror of server seed), dates, progression
  db/           SQLite schema + repositories (no React)
  services/     supabase client, sync engine, auth, ai, reminders, crashLog
  store/        zustand stores: keeperStore (data + actions), sessionStore, settingsStore, uiStore
  audio/        catalog (scene → files), AudioEngine, hooks
  hooks/        useMotion (reduce motion / focus / app state), useKeeperData (selectors + completion actions)
  components/   ui kit, effects (fog/bats/glow/wisps), characters, game widgets, overlays, Screen
  screens/      one file per screen (or small related group)
  navigation/   types, RootNavigator, TabBar
supabase/
  migrations/   0001 schema · 0002 security (grants, RLS, guards) · 0003 reward functions · 0004 seed
  functions/dark-keeper/
```

Rules:
- Screens talk to stores/hooks, not to repositories or Supabase directly (exception: `services/ai.ts` for chat).
- `domain/` has no React or native imports.
- Sprites are referenced through `src/assets/images.ts`; never `require` images inside screens.
