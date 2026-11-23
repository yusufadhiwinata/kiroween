# GRAVEYARD V4.0
## Product Requirements Document

**Product:** GRAVEYARD  
**Version:** 4.0  
**Category:** Productivity / Gamification / Interactive Experience  
**Platform:** Android  
**Framework:** React Native CLI + TypeScript  
**Backend:** Supabase  
**Database:** PostgreSQL + SQLite  
**AI:** External LLM API  
**Design:** Animated Halloween Storybook  
**Audio:** Original Halloween Soundscape  
**Development:** Kiro Spec-Driven Development

**Tagline:** Every Task Awakens a Forgotten Soul.

---

# 1. EXECUTIVE SUMMARY

GRAVEYARD adalah aplikasi produktivitas yang menggabungkan task management, habit tracking, focus timer, AI productivity assistant, gamification, dan interactive world-building dalam satu pengalaman Halloween.

Aplikasi dirancang seperti dunia Halloween yang hidup.

Pengguna berperan sebagai Keeper yang bertugas memulihkan dunia Graveyard melalui aktivitas produktif sehari-hari.

Setiap aktivitas yang diselesaikan menghasilkan Soul Energy, XP, achievement, dan perkembangan visual pada dunia.

Pengalaman visual didukung oleh:
- Animated Halloween environments.
- Interactive ghost characters.
- Atmospheric background music.
- Context-aware sound effects.
- Cinematic transitions.
- Animated achievements.
- Environmental storytelling.

GRAVEYARD harus menjadi aplikasi yang benar-benar dapat digunakan, bukan sekadar demo visual.

# 2. PRODUCT VISION

Menciptakan aplikasi produktivitas yang menggabungkan manfaat praktis task management dengan pengalaman emosional dari sebuah dunia Halloween interaktif.

# 3. PRODUCT GOALS

1. Membantu pengguna mengatur pekerjaan sehari-hari.
2. Meningkatkan konsistensi habit.
3. Meningkatkan motivasi melalui progression.
4. Membuat produktivitas terasa seperti petualangan.
5. Menyediakan AI assistant yang membantu perencanaan.
6. Menghadirkan pengalaman audiovisual Halloween yang memorable.
7. Menjaga performa dan usability pada perangkat Android.

# 4. TARGET AUDIENCE

Primary:
- Students.
- Young professionals.
- Freelancers.
- Productivity enthusiasts.
- Habit-building users.
- Gamification enthusiasts.

Target usia: 16–35 tahun.

# 5. BRAND STORY

Dahulu, Graveyard merupakan sebuah dunia yang dipenuhi cahaya, roh penjaga, dan kehidupan.

Namun, Soul Energy perlahan menghilang.

Dunia menjadi gelap. Desa kehilangan cahaya. Hutan dipenuhi kabut. Kastil tertidur.

Pengguna datang sebagai Keeper terakhir.

Setiap tugas yang diselesaikan akan mengembalikan Soul Energy dan membangkitkan kembali dunia.

Dark Keeper menjadi pendamping misterius yang membantu Keeper menjalankan misi.

# 6. CORE PRODUCT MODULES

## 6.1 Splash & Onboarding

- Animated haunted castle.
- Moon reveal.
- Flying bats.
- Moving fog.
- Animated logo.
- Story-driven onboarding.
- Sound introduction with user permission.

## 6.2 Authentication

- Email registration.
- Email login.
- Password reset.
- Session persistence.
- Logout.
- Supabase Auth.

## 6.3 Home — The Graveyard

Display:
- Keeper greeting.
- Avatar.
- Level.
- Soul Energy.
- Daily ritual progress.
- Active quests.
- World status.
- AI assistant shortcut.

Animated elements:
- Moonlight.
- Drifting fog.
- Flying bats.
- Moving clouds.
- Ghost companion.
- Flickering windows.

## 6.4 Quest Management

- Create quest.
- Edit quest.
- Delete quest.
- Complete quest.
- Deadline.
- Priority.
- Difficulty.
- Category.
- Recurring quests.
- Search and filter.

Difficulty:
- Easy: 10 XP.
- Medium: 25 XP.
- Hard: 50 XP.
- Boss: 100 XP.

Rewards must be validated server-side.

## 6.5 Rituals

- Daily habits.
- Weekly habits.
- Custom schedules.
- Reminders.
- Streak tracking.
- Completion history.

## 6.6 World of Graveyard

Four primary regions:

1. Forgotten Cemetery.
2. Pumpkin Village.
3. Whispering Woods.
4. Haunted Castle.

Each region has:
- Locked state.
- Abandoned state.
- Awakening state.
- Restoration state.
- Restored state.

World progression is based on verified achievements and activity records.

## 6.7 Soul Ledger

Display:
- Daily productivity.
- Weekly productivity.
- Completed quests.
- XP history.
- Streak.
- Focus time.
- Achievements.
- Productivity trends.

## 6.8 Focus Chamber

- Pomodoro.
- Custom timer.
- Short break.
- Long break.
- Focus history.
- Focus statistics.
- Session rewards.

## 6.9 Dark Keeper AI

Real LLM integration.

Capabilities:
- Natural language chat.
- Goal breakdown.
- Quest generation.
- Daily planning.
- Weekly review.
- Habit suggestions.
- Productivity recommendations.

AI-generated quests require user approval before saving.

Dark Keeper has animated states:
- Idle.
- Thinking.
- Talking.
- Celebrating.
- Error.

## 6.10 Achievement System

Examples:
- First Awakening.
- Night Guardian.
- Soul Collector.
- Grave Keeper.
- Master Keeper.

Unlock rewards:
- XP.
- Badges.
- World restoration.
- Character cosmetics.

# 7. AUDIO EXPERIENCE

Audio is a first-class product feature.

The audio engine must understand the current screen, interaction state, and user settings.

### Audio categories

1. Background Music.
2. Environmental Ambience.
3. UI Sound Effects.
4. Character Sounds.
5. Quest Feedback.
6. Achievement Sounds.
7. Focus Music.

### Audio requirements

- Background music changes based on application context.
- Environmental ambience is layered independently.
- UI sound effects have priority over ambience.
- Music transitions must use crossfades.
- No overlapping duplicate sound effects.
- Sounds must stop or pause appropriately when leaving a screen.
- Focus mode must not contain sudden loud sounds.
- Users can independently control music, ambience, and SFX.
- Sound can be disabled entirely.
- Audio preferences persist across sessions.
- Audio must never be required to understand the interface.

### Initial audio defaults

- Music: 45%.
- Ambience: 35%.
- SFX: 65%.

These are initial recommendations and must remain configurable.

# 8. ANIMATION EXPERIENCE

Animation categories:

### Environment
- Moving clouds.
- Drifting fog.
- Flying bats.
- Flickering windows.
- Swaying trees.
- Candle flames.
- Floating particles.

### Characters
- Dark Keeper.
- Ghost Companion.
- Pumpkin Spirit.
- Flying Bat.

### UI
- Card entrance.
- Button press.
- Quest completion.
- Progress update.
- Achievement reveal.
- Level-up.
- World unlock.

### Cinematic events
- First quest completion.
- First achievement.
- First region unlock.
- World restoration.
- Level progression.

### Technical rules

- Reanimated for interface motion.
- Rive for interactive character state machines.
- Lottie for suitable decorative animation.
- Skia for advanced effects.
- Native audio playback for sound assets.

Animations must respect app lifecycle and Reduce Motion settings.

# 9. NAVIGATION

Bottom navigation:

1. Home.
2. Quests.
3. World.
4. Ledger.
5. Profile.

Dark Keeper is accessible through a dedicated floating action button.

# 10. BACKEND AND DATA

Supabase PostgreSQL tables:

- profiles
- keeper_stats
- quests
- quest_categories
- quest_history
- rituals
- ritual_completions
- focus_sessions
- xp_transactions
- achievements
- user_achievements
- world_areas
- world_progress
- ai_conversations
- ai_messages
- ai_proposals
- user_settings
- notification_preferences
- device_tokens
- sync_operations

Requirements:
- Foreign keys.
- Indexes.
- Unique constraints.
- Row Level Security.
- Atomic reward operations.
- Idempotency.
- User ownership enforcement.

SQLite stores offline data and pending operations.

# 11. AI ARCHITECTURE

React Native → Supabase Edge Function → LLM Provider → Response Validation → React Native.

Security:
- AI API key stored as server secret.
- Authentication required.
- Rate limiting.
- Input validation.
- Token usage tracking.
- Timeout and retry handling.
- Conversation ownership validation.

# 12. OFFLINE-FIRST

Available offline:
- Cached quests.
- Quest creation.
- Local quest completion records.
- Cached habits.
- Habit completion records.
- Cached world state.

On reconnect:
- Synchronize operations.
- Resolve conflicts.
- Validate rewards.
- Refresh progression.

The backend is the authoritative source for XP and levels.

# 13. NON-FUNCTIONAL REQUIREMENTS

Performance:
- Target 60 FPS on supported devices.
- Lazy-load large assets.
- Compress illustrations.
- Pause inactive animations.
- Limit particle effects.
- Avoid unnecessary rendering.
- Manage audio focus.

Accessibility:
- Reduce Motion.
- Sound controls.
- High contrast.
- Screen reader labels.
- Minimum 44dp touch targets.

Reliability:
- Error boundaries.
- Offline fallback.
- Retry handling.
- Crash monitoring.
- Database consistency.

# 14. TESTING

Functional:
- Authentication.
- Quest CRUD.
- Ritual tracking.
- Reward validation.
- Level progression.
- World restoration.
- AI proposals.
- Audio transitions.
- Sound settings.
- Offline synchronization.

Performance:
- Animation FPS.
- Memory usage.
- Audio resource management.
- Startup time.
- Asset loading.

Security:
- RLS.
- User isolation.
- Reward manipulation.
- AI key protection.
- Duplicate operations.

# 15. RELEASE ACCEPTANCE

The product is ready for judging when:
- Main screens are functional.
- Backend is connected.
- AI uses a real API.
- Rewards are server validated.
- Offline synchronization works.
- Audio is context-aware.
- Halloween animations are implemented.
- Reduce Motion works.
- All sound preferences work.
- No private API key is bundled in the APK.
- Release APK builds and installs.
- Main flows pass QA.

# 16. PRODUCT STATEMENT

GRAVEYARD is a living Halloween productivity universe.

Every quest restores a forgotten corner of the world.

Every habit brings light into the darkness.

Every day, the Keeper makes the Graveyard come alive.

**Every Task Awakens a Forgotten Soul.**
