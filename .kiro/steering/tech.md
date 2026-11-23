# Tech stack and conventions

## Mobile (`mobile/`)
- React Native 0.88.1 CLI, TypeScript, Hermes, New Architecture. Android only.
- Navigation: React Navigation 7 (native-stack + bottom-tabs with the custom `GraveyardTabBar`).
- State: zustand. Settings persist in MMKV (`react-native-mmkv` 4, `createMMKV`, use `remove()` not `delete()`).
- Offline store: `@op-engineering/op-sqlite` (`src/db`). Every user action writes SQLite first, then enqueues a `sync_ops` row.
- Motion: Reanimated 4 + worklets (babel plugin `react-native-worklets/plugin` must stay last). Always gate loops with `useAnimationsActive()` and entering animations with `useMotion().reduceMotion`.
- Audio: `react-native-sound` with files in `android/app/src/main/res/raw/*.ogg`. Construct as `new Sound(file, Sound.MAIN_BUNDLE, cb)`; passing the callback as 2nd argument breaks the Android path. Screens call `useAudioScene(scene)`; play effects with `sfx(id)`.
- Build with JDK 17: `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew assembleRelease`. ABIs: arm64-v8a, x86_64.

## Backend (`supabase/`)
- New tables need: RLS enabled, explicit grants to `authenticated` (never `anon`), indexes on `user_id` access paths.
- Anything that grants progression goes in a `SECURITY DEFINER` function with `set search_path = ''`, `private.require_user()`, `private.claim_op()` idempotency and a `keeper_stats ... for update` lock.
- Helpers live in the `private` schema (not exposed by PostgREST).
- When changing reward rules, update `mobile/src/domain/constants.ts` and `progression.ts` in the same change.
- Edge Functions: Deno, `npm:@supabase/supabase-js@2`, secrets via `supabase secrets set`.

## Commands
- Typecheck: `cd mobile && npx tsc --noEmit`
- Lint: `cd mobile && npx eslint src App.tsx`
- Assets: `cd mobile && python3 scripts/prepare_assets.py` (needs pillow, numpy, scipy, ffmpeg)
