-- GRAVEYARD v4.0 — privileges, Row Level Security, and write guards.
-- Principle: clients may only read their own rows, and may only write content
-- (quests, rituals, settings). Anything that grants progression is written by
-- SECURITY DEFINER functions in 20261123000003_functions.sql.

-- ---------------------------------------------------------------------------
-- Table privileges (least privilege; anon gets nothing)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on schema private from public;

grant select on public.achievements, public.world_areas to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar, timezone, onboarded_at) on public.profiles to authenticated;
grant select on public.keeper_stats to authenticated;
grant select, insert, update, delete on public.quest_categories to authenticated;
grant select, insert, update, delete on public.quests to authenticated;
grant select on public.quest_history to authenticated;
grant select, insert, update, delete on public.rituals to authenticated;
grant select on public.ritual_completions to authenticated;
grant select on public.focus_sessions to authenticated;
grant select on public.xp_transactions to authenticated;
grant select on public.user_achievements to authenticated;
grant select on public.world_progress to authenticated;
grant select, delete on public.ai_conversations to authenticated;
grant update (title) on public.ai_conversations to authenticated;
grant select on public.ai_messages to authenticated;
grant select on public.ai_proposals to authenticated;
grant select, insert, update on public.user_settings to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.device_tokens to authenticated;
grant select on public.sync_operations to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.achievements enable row level security;
alter table public.world_areas enable row level security;
alter table public.profiles enable row level security;
alter table public.keeper_stats enable row level security;
alter table public.quest_categories enable row level security;
alter table public.quests enable row level security;
alter table public.quest_history enable row level security;
alter table public.rituals enable row level security;
alter table public.ritual_completions enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.user_achievements enable row level security;
alter table public.world_progress enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_proposals enable row level security;
alter table public.user_settings enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.device_tokens enable row level security;
alter table public.sync_operations enable row level security;

-- Reference data: readable by any signed-in keeper.
create policy achievements_read on public.achievements for select to authenticated using (true);
create policy world_areas_read on public.world_areas for select to authenticated using (true);

-- Profiles
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Read-only progression tables
create policy keeper_stats_select_own on public.keeper_stats for select to authenticated
  using (user_id = (select auth.uid()));
create policy quest_history_select_own on public.quest_history for select to authenticated
  using (user_id = (select auth.uid()));
create policy ritual_completions_select_own on public.ritual_completions for select to authenticated
  using (user_id = (select auth.uid()));
create policy focus_sessions_select_own on public.focus_sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy xp_transactions_select_own on public.xp_transactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_achievements_select_own on public.user_achievements for select to authenticated
  using (user_id = (select auth.uid()));
create policy world_progress_select_own on public.world_progress for select to authenticated
  using (user_id = (select auth.uid()));
create policy sync_operations_select_own on public.sync_operations for select to authenticated
  using (user_id = (select auth.uid()));
create policy ai_messages_select_own on public.ai_messages for select to authenticated
  using (user_id = (select auth.uid()));
create policy ai_proposals_select_own on public.ai_proposals for select to authenticated
  using (user_id = (select auth.uid()));

-- Categories: built-ins (user_id null) are readable; own categories are writable.
create policy quest_categories_select on public.quest_categories for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy quest_categories_insert_own on public.quest_categories for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy quest_categories_update_own on public.quest_categories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy quest_categories_delete_own on public.quest_categories for delete to authenticated
  using (user_id = (select auth.uid()));

-- Quests & rituals: full CRUD on own rows (completion is guarded by trigger).
create policy quests_select_own on public.quests for select to authenticated
  using (user_id = (select auth.uid()));
create policy quests_insert_own on public.quests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy quests_update_own on public.quests for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy quests_delete_own on public.quests for delete to authenticated
  using (user_id = (select auth.uid()));

create policy rituals_select_own on public.rituals for select to authenticated
  using (user_id = (select auth.uid()));
create policy rituals_insert_own on public.rituals for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy rituals_update_own on public.rituals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy rituals_delete_own on public.rituals for delete to authenticated
  using (user_id = (select auth.uid()));

-- AI conversations: read, rename, delete own. Messages/proposals are written by the Edge Function.
create policy ai_conversations_select_own on public.ai_conversations for select to authenticated
  using (user_id = (select auth.uid()));
create policy ai_conversations_update_own on public.ai_conversations for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ai_conversations_delete_own on public.ai_conversations for delete to authenticated
  using (user_id = (select auth.uid()));

-- Settings
create policy user_settings_select_own on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_settings_insert_own on public.user_settings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy user_settings_update_own on public.user_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy notification_preferences_select_own on public.notification_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_preferences_insert_own on public.notification_preferences for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy notification_preferences_update_own on public.notification_preferences for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy device_tokens_select_own on public.device_tokens for select to authenticated
  using (user_id = (select auth.uid()));
create policy device_tokens_insert_own on public.device_tokens for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy device_tokens_update_own on public.device_tokens for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy device_tokens_delete_own on public.device_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Write guards
-- ---------------------------------------------------------------------------
-- Reward functions (SECURITY DEFINER) set the transaction-local flag
-- `graveyard.trusted = on` before touching guarded columns. Clients cannot set it:
-- PostgREST only exposes functions in the public schema.

-- Quests: last-write-wins on client updated_at; completion fields are server-owned.
create or replace function private.quests_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('graveyard.trusted', true), '') = 'on' then
    return new;
  end if;
  new.updated_at := least(coalesce(new.updated_at, now()), now());
  if tg_op = 'INSERT' then
    new.status := case when new.status = 'archived' then 'archived' else 'active' end;
    new.completed_at := null;
    new.last_completed_period := null;
    new.source := 'manual';
    new.created_at := least(coalesce(new.created_at, now()), now());
    return new;
  end if;
  -- Stale offline write: an older edit must not overwrite a newer one.
  if new.updated_at < old.updated_at then
    return null;
  end if;
  new.id := old.id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.source := old.source;
  new.completed_at := old.completed_at;
  new.last_completed_period := old.last_completed_period;
  new.deleted_at := coalesce(old.deleted_at, new.deleted_at);
  if old.status = 'completed' and new.status <> 'archived' then
    new.status := 'completed';
  elsif new.status = 'completed' then
    new.status := old.status; -- completion only through public.complete_quest()
  end if;
  return new;
end
$$;

create trigger quests_guard before insert or update on public.quests
  for each row execute function private.quests_guard();

create or replace function private.rituals_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('graveyard.trusted', true), '') = 'on' then
    return new;
  end if;
  new.updated_at := least(coalesce(new.updated_at, now()), now());
  if tg_op = 'INSERT' then
    new.created_at := least(coalesce(new.created_at, now()), now());
    return new;
  end if;
  if new.updated_at < old.updated_at then
    return null;
  end if;
  new.id := old.id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.deleted_at := coalesce(old.deleted_at, new.deleted_at);
  return new;
end
$$;

create trigger rituals_guard before insert or update on public.rituals
  for each row execute function private.rituals_guard();

create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger user_settings_touch before update on public.user_settings
  for each row execute function private.touch_updated_at();
create trigger notification_preferences_touch before update on public.notification_preferences
  for each row execute function private.touch_updated_at();
create trigger ai_conversations_touch before update on public.ai_conversations
  for each row execute function private.touch_updated_at();
