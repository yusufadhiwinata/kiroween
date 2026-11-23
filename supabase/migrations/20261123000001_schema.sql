-- GRAVEYARD v4.0 — core schema
-- All user-owned tables enforce ownership through RLS (see 20261123000002_security.sql).
-- XP, levels, Soul Energy, achievements and world progress are written only by
-- SECURITY DEFINER functions (20261123000003_functions.sql); clients can read them.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table public.achievements (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null,
  xp_reward integer not null default 0 check (xp_reward >= 0),
  criteria_type text not null check (criteria_type in (
    'quests_completed', 'boss_quests_completed', 'rituals_completed', 'streak_days',
    'focus_sessions', 'focus_minutes', 'soul_energy', 'regions_restored', 'level')),
  criteria_value integer not null check (criteria_value > 0),
  cosmetic text,
  sort_order integer not null default 0
);

create table public.world_areas (
  id text primary key,
  name text not null,
  description text not null,
  sort_order integer not null unique,
  unlock_level integer not null check (unlock_level >= 1),
  restore_points integer not null check (restore_points > 0)
);

-- ---------------------------------------------------------------------------
-- Keeper profile & stats
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Keeper' check (char_length(display_name) between 1 and 40),
  avatar text not null default 'dark_keeper' check (char_length(avatar) <= 40),
  timezone text not null default 'UTC' check (char_length(timezone) <= 64),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.keeper_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  soul_energy integer not null default 0 check (soul_energy >= 0),
  soul_banked integer not null default 0 check (soul_banked >= 0),
  quests_completed integer not null default 0,
  boss_quests_completed integer not null default 0,
  rituals_completed integer not null default 0,
  focus_sessions_completed integer not null default 0,
  focus_minutes integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Quests
-- ---------------------------------------------------------------------------
create table public.quest_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade, -- null = built-in
  name text not null check (char_length(btrim(name)) between 1 and 30),
  color text not null default '#8B5CF6' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default 'gem' check (char_length(icon) <= 40),
  created_at timestamptz not null default now()
);
create unique index quest_categories_owner_name_key
  on public.quest_categories (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  category_id uuid references public.quest_categories (id) on delete set null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  difficulty text not null default 'easy' check (difficulty in ('easy', 'medium', 'hard', 'boss')),
  deadline timestamptz,
  recurrence text not null default 'none' check (recurrence in ('none', 'daily', 'weekly')),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  completed_at timestamptz,
  last_completed_period text,
  source text not null default 'manual' check (source in ('manual', 'ai')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index quests_user_status_idx on public.quests (user_id, status) where deleted_at is null;
create index quests_user_deadline_idx on public.quests (user_id, deadline);
create index quests_user_updated_idx on public.quests (user_id, updated_at);
create index quests_category_idx on public.quests (category_id);

create table public.quest_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  quest_id uuid not null references public.quests (id) on delete cascade,
  period_key text not null,
  difficulty text not null,
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  completed_at timestamptz not null default now(),
  unique (quest_id, period_key)
);
create index quest_history_user_completed_idx on public.quest_history (user_id, completed_at desc);

-- ---------------------------------------------------------------------------
-- Rituals (habits)
-- ---------------------------------------------------------------------------
create table public.rituals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  schedule_type text not null default 'daily' check (schedule_type in ('daily', 'weekly', 'custom')),
  schedule_days smallint[] not null default '{}',
  weekly_target smallint not null default 1 check (weekly_target between 1 and 7),
  reminder_time time,
  reminder_enabled boolean not null default false,
  icon text not null default 'candle' check (char_length(icon) <= 40),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (schedule_type <> 'custom' or cardinality(schedule_days) > 0),
  check (schedule_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
);
create index rituals_user_idx on public.rituals (user_id) where deleted_at is null;
create index rituals_user_updated_idx on public.rituals (user_id, updated_at);

create table public.ritual_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ritual_id uuid not null references public.rituals (id) on delete cascade,
  completion_date date not null,
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  completed_at timestamptz not null default now(),
  unique (ritual_id, completion_date)
);
create index ritual_completions_user_date_idx on public.ritual_completions (user_id, completion_date desc);

-- ---------------------------------------------------------------------------
-- Focus Chamber
-- ---------------------------------------------------------------------------
create table public.focus_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('pomodoro', 'custom', 'short_break', 'long_break')),
  planned_minutes integer not null check (planned_minutes between 1 and 180),
  actual_minutes integer not null check (actual_minutes between 0 and 180),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  completed boolean not null default false,
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  quest_id uuid references public.quests (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ended_at >= started_at)
);
create index focus_sessions_user_started_idx on public.focus_sessions (user_id, started_at desc);
create index focus_sessions_quest_idx on public.focus_sessions (quest_id);

-- ---------------------------------------------------------------------------
-- Rewards & progression
-- ---------------------------------------------------------------------------
create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount >= 0),
  source_type text not null check (source_type in ('quest', 'ritual', 'focus', 'achievement', 'bonus')),
  source_id text,
  source_key text not null,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_key)
);
create index xp_transactions_user_created_idx on public.xp_transactions (user_id, created_at desc);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
create index user_achievements_achievement_idx on public.user_achievements (achievement_id);

create table public.world_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  area_id text not null references public.world_areas (id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  state text not null default 'locked'
    check (state in ('locked', 'abandoned', 'awakening', 'restoration', 'restored')),
  unlocked_at timestamptz,
  restored_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, area_id)
);
create index world_progress_area_idx on public.world_progress (area_id);

-- ---------------------------------------------------------------------------
-- Dark Keeper AI
-- ---------------------------------------------------------------------------
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Dark Keeper counsel' check (char_length(title) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_user_updated_idx on public.ai_conversations (user_id, updated_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  mode text not null default 'chat' check (mode in (
    'chat', 'breakdown', 'generate_quests', 'daily_plan', 'weekly_review', 'habit_suggestions')),
  content text not null check (char_length(content) <= 8000),
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  model text,
  created_at timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);
create index ai_messages_user_created_idx on public.ai_messages (user_id, created_at desc);

create table public.ai_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  message_id uuid references public.ai_messages (id) on delete set null,
  kind text not null default 'quest' check (kind in ('quest', 'ritual')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_entity_id uuid,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index ai_proposals_user_status_idx on public.ai_proposals (user_id, status);
create index ai_proposals_conversation_idx on public.ai_proposals (conversation_id);
create index ai_proposals_message_idx on public.ai_proposals (message_id);

-- ---------------------------------------------------------------------------
-- Settings, notifications, devices
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  sound_enabled boolean not null default true,
  music_volume numeric(3, 2) not null default 0.45 check (music_volume between 0 and 1),
  ambience_volume numeric(3, 2) not null default 0.35 check (ambience_volume between 0 and 1),
  sfx_volume numeric(3, 2) not null default 0.65 check (sfx_volume between 0 and 1),
  reduce_motion boolean not null default false,
  high_contrast boolean not null default false,
  focus_minutes integer not null default 25 check (focus_minutes between 5 and 120),
  short_break_minutes integer not null default 5 check (short_break_minutes between 1 and 30),
  long_break_minutes integer not null default 15 check (long_break_minutes between 5 and 60),
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  ritual_reminders boolean not null default true,
  quest_deadlines boolean not null default true,
  daily_planning boolean not null default false,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz not null default now()
);

create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique check (char_length(token) <= 512),
  platform text not null default 'android' check (platform in ('android', 'ios')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index device_tokens_user_idx on public.device_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Offline sync ledger (idempotency keys for every reward operation)
-- ---------------------------------------------------------------------------
create table public.sync_operations (
  id uuid primary key, -- client-generated operation id
  user_id uuid not null references public.profiles (id) on delete cascade,
  op_type text not null check (char_length(op_type) <= 40),
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'processing' check (status in ('processing', 'applied', 'rejected')),
  result jsonb,
  client_created_at timestamptz,
  processed_at timestamptz not null default now()
);
create index sync_operations_user_processed_idx on public.sync_operations (user_id, processed_at desc);
