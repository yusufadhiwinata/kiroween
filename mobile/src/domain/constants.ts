import type { Difficulty, Priority } from './types';

/** Mirrors private.quest_xp() on the server. */
export const QUEST_XP: Record<Difficulty, number> = { easy: 10, medium: 25, hard: 50, boss: 100 };
export const RITUAL_XP = 15;
export const FOCUS_XP_PER_SESSION_CAP = 60;
export const FOCUS_DAILY_MINUTES_CAP = 240;
export const DAILY_REWARDED_QUEST_CAP = 25;
export const DAILY_TIER_CAP: Partial<Record<Difficulty, number>> = { boss: 3, hard: 8 };

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'boss'];
export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

/** Built-in categories (same fixed UUIDs as the server seed). */
export const CATEGORIES: Category[] = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Work', color: '#F59E0B', icon: 'coin' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Study', color: '#8B5CF6', icon: 'potion' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Health', color: '#22C55E', icon: 'gem' },
  { id: '00000000-0000-4000-8000-000000000004', name: 'Personal', color: '#EC4899', icon: 'ghost' },
  { id: '00000000-0000-4000-8000-000000000005', name: 'Home', color: '#38BDF8', icon: 'pumpkin' },
  { id: '00000000-0000-4000-8000-000000000006', name: 'Creative', color: '#F97316', icon: 'deco_crystals' },
];

export const categoryById = (id: string | null | undefined) => CATEGORIES.find(c => c.id === id);

export interface WorldArea {
  id: 'forgotten_cemetery' | 'pumpkin_village' | 'whispering_woods' | 'haunted_castle';
  name: string;
  description: string;
  lore: string;
  sortOrder: number;
  unlockLevel: number;
  restorePoints: number;
}

export const WORLD_AREAS: WorldArea[] = [
  {
    id: 'forgotten_cemetery',
    name: 'Forgotten Cemetery',
    description: 'Where the first souls fell silent. Relight its lanterns.',
    lore: 'Crooked headstones lean into the fog. Each finished quest lights another lantern along the path.',
    sortOrder: 1,
    unlockLevel: 1,
    restorePoints: 200,
  },
  {
    id: 'pumpkin_village',
    name: 'Pumpkin Village',
    description: 'Hollow homes waiting for warm candlelight.',
    lore: 'The windmill stopped turning the night the Soul Energy faded. Villagers return as the hearths glow again.',
    sortOrder: 2,
    unlockLevel: 3,
    restorePoints: 400,
  },
  {
    id: 'whispering_woods',
    name: 'Whispering Woods',
    description: 'Fog-bound trees that remember every promise.',
    lore: 'The trees whisper the habits you keep. Consistency thins the fog between their branches.',
    sortOrder: 3,
    unlockLevel: 5,
    restorePoints: 700,
  },
  {
    id: 'haunted_castle',
    name: 'Haunted Castle',
    description: 'The sleeping heart of Graveyard.',
    lore: 'Its towers sleep beneath the moon. Only a seasoned Keeper can wake the castle and bring back the dawn.',
    sortOrder: 4,
    unlockLevel: 8,
    restorePoints: 1000,
  },
];

export type CriteriaType =
  | 'quests_completed'
  | 'boss_quests_completed'
  | 'rituals_completed'
  | 'streak_days'
  | 'focus_sessions'
  | 'focus_minutes'
  | 'soul_energy'
  | 'regions_restored'
  | 'level';

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  criteria: CriteriaType;
  value: number;
  cosmetic: string | null;
}

/** Mirrors the achievements seed. */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_awakening', name: 'First Awakening', description: 'Complete your first quest.', icon: 'ach_star', xp: 50, criteria: 'quests_completed', value: 1, cosmetic: null },
  { id: 'candle_bearer', name: 'Candle Bearer', description: 'Finish your first focus session.', icon: 'ach_trophy', xp: 50, criteria: 'focus_sessions', value: 1, cosmetic: null },
  { id: 'boss_slayer', name: 'Boss Slayer', description: 'Defeat a Boss quest.', icon: 'badge_boss', xp: 100, criteria: 'boss_quests_completed', value: 1, cosmetic: 'aura_crimson' },
  { id: 'ritual_keeper', name: 'Ritual Keeper', description: 'Complete 10 rituals.', icon: 'ach_banner', xp: 100, criteria: 'rituals_completed', value: 10, cosmetic: null },
  { id: 'night_guardian', name: 'Night Guardian', description: 'Stay active 7 days in a row.', icon: 'ach_shield', xp: 150, criteria: 'streak_days', value: 7, cosmetic: 'lantern_blue' },
  { id: 'deep_trance', name: 'Deep Trance', description: 'Spend 300 minutes in the Focus Chamber.', icon: 'banner_ghost', xp: 150, criteria: 'focus_minutes', value: 300, cosmetic: null },
  { id: 'soul_collector', name: 'Soul Collector', description: 'Gather 1,000 Soul Energy.', icon: 'ach_gem_shield', xp: 200, criteria: 'soul_energy', value: 1000, cosmetic: 'aura_violet' },
  { id: 'grave_keeper', name: 'Grave Keeper', description: 'Fully restore your first region.', icon: 'chest_big', xp: 250, criteria: 'regions_restored', value: 1, cosmetic: null },
  { id: 'master_keeper', name: 'Master Keeper', description: 'Reach Keeper level 10.', icon: 'ach_crown', xp: 500, criteria: 'level', value: 10, cosmetic: 'crown_gold' },
  { id: 'dawn_bringer', name: 'Dawn Bringer', description: 'Restore all four regions of Graveyard.', icon: 'logo', xp: 1000, criteria: 'regions_restored', value: 4, cosmetic: 'aura_dawn' },
];

export const achievementById = (id: string) => ACHIEVEMENTS.find(a => a.id === id);

export interface Cosmetic {
  id: string;
  name: string;
  ring: string;
  glow: string;
}

export const COSMETICS: Cosmetic[] = [
  { id: 'default', name: 'Keeper Gold', ring: '#F59E0B', glow: '#FBBF24' },
  { id: 'aura_crimson', name: 'Crimson Aura', ring: '#DC2626', glow: '#F87171' },
  { id: 'lantern_blue', name: 'Blue Lantern', ring: '#2563EB', glow: '#60A5FA' },
  { id: 'aura_violet', name: 'Violet Aura', ring: '#7C3AED', glow: '#C4B5FD' },
  { id: 'crown_gold', name: 'Golden Crown', ring: '#EAB308', glow: '#FDE68A' },
  { id: 'aura_dawn', name: 'Dawn Aura', ring: '#F472B6', glow: '#FBCFE8' },
];
