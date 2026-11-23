-- GRAVEYARD v4.0 — reference data (regions, achievements, built-in categories).
-- IDs are stable because the mobile app ships the same constants for offline use.

insert into public.world_areas (id, name, description, sort_order, unlock_level, restore_points) values
  ('forgotten_cemetery', 'Forgotten Cemetery', 'Where the first souls fell silent. Relight its lanterns.', 1, 1, 200),
  ('pumpkin_village', 'Pumpkin Village', 'Hollow homes waiting for warm candlelight.', 2, 3, 400),
  ('whispering_woods', 'Whispering Woods', 'Fog-bound trees that remember every promise.', 3, 5, 700),
  ('haunted_castle', 'Haunted Castle', 'The sleeping heart of Graveyard.', 4, 8, 1000)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, sort_order = excluded.sort_order,
  unlock_level = excluded.unlock_level, restore_points = excluded.restore_points;

insert into public.achievements (id, name, description, icon, xp_reward, criteria_type, criteria_value, cosmetic, sort_order) values
  ('first_awakening', 'First Awakening', 'Complete your first quest.', 'ach_star', 50, 'quests_completed', 1, null, 1),
  ('candle_bearer', 'Candle Bearer', 'Finish your first focus session.', 'ach_trophy', 50, 'focus_sessions', 1, null, 2),
  ('boss_slayer', 'Boss Slayer', 'Defeat a Boss quest.', 'badge_boss', 100, 'boss_quests_completed', 1, 'aura_crimson', 3),
  ('ritual_keeper', 'Ritual Keeper', 'Complete 10 rituals.', 'ach_banner', 100, 'rituals_completed', 10, null, 4),
  ('night_guardian', 'Night Guardian', 'Stay active 7 days in a row.', 'ach_shield', 150, 'streak_days', 7, 'lantern_blue', 5),
  ('deep_trance', 'Deep Trance', 'Spend 300 minutes in the Focus Chamber.', 'banner_ghost', 150, 'focus_minutes', 300, null, 6),
  ('soul_collector', 'Soul Collector', 'Gather 1,000 Soul Energy.', 'ach_gem_shield', 200, 'soul_energy', 1000, 'aura_violet', 7),
  ('grave_keeper', 'Grave Keeper', 'Fully restore your first region.', 'chest_big', 250, 'regions_restored', 1, null, 8),
  ('master_keeper', 'Master Keeper', 'Reach Keeper level 10.', 'ach_crown', 500, 'level', 10, 'crown_gold', 9),
  ('dawn_bringer', 'Dawn Bringer', 'Restore all four regions of Graveyard.', 'logo', 1000, 'regions_restored', 4, 'aura_dawn', 10)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  xp_reward = excluded.xp_reward, criteria_type = excluded.criteria_type,
  criteria_value = excluded.criteria_value, cosmetic = excluded.cosmetic, sort_order = excluded.sort_order;

insert into public.quest_categories (id, user_id, name, color, icon) values
  ('00000000-0000-4000-8000-000000000001', null, 'Work', '#F59E0B', 'coin'),
  ('00000000-0000-4000-8000-000000000002', null, 'Study', '#8B5CF6', 'potion'),
  ('00000000-0000-4000-8000-000000000003', null, 'Health', '#22C55E', 'gem'),
  ('00000000-0000-4000-8000-000000000004', null, 'Personal', '#EC4899', 'ghost'),
  ('00000000-0000-4000-8000-000000000005', null, 'Home', '#38BDF8', 'pumpkin'),
  ('00000000-0000-4000-8000-000000000006', null, 'Creative', '#F97316', 'deco_crystals')
on conflict (id) do nothing;
