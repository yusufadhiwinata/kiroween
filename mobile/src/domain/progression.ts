/**
 * Client-side mirror of the server progression rules.
 *
 * The server is authoritative. The app uses these functions only to preview the
 * effect of rewards that are queued offline, so the Graveyard reacts instantly;
 * the next sync replaces the preview with the server snapshot.
 */
import { ACHIEVEMENTS, WORLD_AREAS } from './constants';
import { daysBetween } from './dates';
import type {
  CelebrationEvent,
  KeeperCounters,
  KeeperSnapshot,
  ProvisionalReward,
  RegionState,
  UnlockedAchievement,
  WorldProgress,
} from './types';

const MAX_LEVEL = 100;

/** Cumulative XP needed to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  const l = Math.max(1, level) - 1;
  return 100 * l + 25 * l * (l - 1);
}

export function levelForXp(xp: number): number {
  let lvl = 1;
  while (lvl < MAX_LEVEL && xpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, current: xp - floor, needed: next - floor, ratio: (xp - floor) / (next - floor) };
}

export function regionState(points: number, required: number): Exclude<RegionState, 'locked'> {
  if (points >= required) return 'restored';
  if (points * 100 >= required * 60) return 'restoration';
  if (points * 100 >= required * 25) return 'awakening';
  return 'abandoned';
}

/** Soul Energy fills unlocked regions in order (same result as server banking). */
export function computeWorld(soulEnergy: number, level: number): WorldProgress[] {
  let remaining = soulEnergy;
  return WORLD_AREAS.map(area => {
    if (level < area.unlockLevel) {
      return { area_id: area.id, points: 0, state: 'locked', required: area.restorePoints, unlock_level: area.unlockLevel };
    }
    const points = Math.min(remaining, area.restorePoints);
    remaining -= points;
    return {
      area_id: area.id,
      points,
      state: regionState(points, area.restorePoints),
      required: area.restorePoints,
      unlock_level: area.unlockLevel,
    };
  });
}

export const emptyCounters = (): KeeperCounters => ({
  xp: 0,
  level: 1,
  soul_energy: 0,
  quests_completed: 0,
  boss_quests_completed: 0,
  rituals_completed: 0,
  focus_sessions_completed: 0,
  focus_minutes: 0,
  current_streak: 0,
  longest_streak: 0,
  last_active_date: null,
});

export const emptySnapshot = (): KeeperSnapshot => ({
  stats: emptyCounters(),
  world: computeWorld(0, 1),
  achievements: [],
});

function touchActivity(c: KeeperCounters, day: string) {
  if (!c.last_active_date) {
    c.current_streak = 1;
  } else {
    const gap = daysBetween(c.last_active_date, day);
    if (gap <= 0) return;
    c.current_streak = gap === 1 ? c.current_streak + 1 : 1;
  }
  c.longest_streak = Math.max(c.longest_streak, c.current_streak);
  c.last_active_date = day;
}

function criteriaProgress(c: KeeperCounters, restored: number, criteria: string): number {
  switch (criteria) {
    case 'quests_completed':
      return c.quests_completed;
    case 'boss_quests_completed':
      return c.boss_quests_completed;
    case 'rituals_completed':
      return c.rituals_completed;
    case 'streak_days':
      return c.longest_streak;
    case 'focus_sessions':
      return c.focus_sessions_completed;
    case 'focus_minutes':
      return c.focus_minutes;
    case 'soul_energy':
      return c.soul_energy;
    case 'regions_restored':
      return restored;
    case 'level':
      return c.level;
    default:
      return 0;
  }
}

export interface DisplayProgress {
  stats: KeeperCounters;
  world: WorldProgress[];
  achievements: (UnlockedAchievement & { provisional: boolean })[];
  pendingXp: number;
}

/** Server snapshot + queued provisional rewards => what the Keeper sees now. */
export function deriveDisplay(snapshot: KeeperSnapshot, pending: ProvisionalReward[]): DisplayProgress {
  const c: KeeperCounters = { ...emptyCounters(), ...snapshot.stats };
  const unlocked = new Map<string, UnlockedAchievement & { provisional: boolean }>();
  snapshot.achievements.forEach(a => unlocked.set(a.id, { ...a, provisional: false }));
  let pendingXp = 0;

  for (const p of pending) {
    c.xp += p.xp;
    c.soul_energy += p.xp;
    pendingXp += p.xp;
    c.quests_completed += p.quests ?? 0;
    c.boss_quests_completed += p.boss ?? 0;
    c.rituals_completed += p.rituals ?? 0;
    c.focus_sessions_completed += p.focusSessions ?? 0;
    c.focus_minutes += p.focusMinutes ?? 0;
    if (p.activityDate) touchActivity(c, p.activityDate);
  }

  if (pending.length === 0) {
    return { stats: c, world: snapshot.world.length ? snapshot.world : computeWorld(c.soul_energy, c.level), achievements: [...unlocked.values()], pendingXp: 0 };
  }

  let world = computeWorld(c.soul_energy, levelForXp(c.xp));
  for (let round = 0; round < 5; round++) {
    c.level = levelForXp(c.xp);
    world = computeWorld(c.soul_energy, c.level);
    const restored = world.filter(w => w.state === 'restored').length;
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (unlocked.has(a.id)) continue;
      if (criteriaProgress(c, restored, a.criteria) >= a.value) {
        unlocked.set(a.id, { id: a.id, unlocked_at: new Date().toISOString(), provisional: true });
        c.xp += a.xp;
        c.soul_energy += a.xp;
        pendingXp += a.xp;
        changed = true;
      }
    }
    if (!changed) break;
  }
  c.level = levelForXp(c.xp);
  world = computeWorld(c.soul_energy, c.level);
  return { stats: c, world, achievements: [...unlocked.values()], pendingXp };
}

export function achievementProgress(display: DisplayProgress, criteria: string): number {
  const restored = display.world.filter(w => w.state === 'restored').length;
  return criteriaProgress(display.stats, restored, criteria);
}

/** Events worth a cinematic when moving from `prev` to `next`. */
export function diffCelebrations(prev: DisplayProgress, next: DisplayProgress): CelebrationEvent[] {
  const events: CelebrationEvent[] = [];
  const had = new Set(prev.achievements.map(a => a.id));
  next.achievements.forEach(a => {
    if (!had.has(a.id)) events.push({ kind: 'achievement', id: a.id });
  });
  next.world.forEach(w => {
    const before = prev.world.find(p => p.area_id === w.area_id);
    if (!before) return;
    if (before.state === 'locked' && w.state !== 'locked') events.push({ kind: 'region_unlocked', areaId: w.area_id });
    if (before.state !== 'restored' && w.state === 'restored') events.push({ kind: 'region_restored', areaId: w.area_id });
  });
  if (next.stats.level > prev.stats.level) events.push({ kind: 'level', level: next.stats.level });
  return events;
}

/** The region currently absorbing Soul Energy (first unlocked, not restored). */
export function activeRegion(world: WorldProgress[]): WorldProgress | undefined {
  return world.find(w => w.state !== 'locked' && w.state !== 'restored') ?? [...world].reverse().find(w => w.state === 'restored');
}

/** 0..1 share of total restoration across all regions. */
export function worldRestoration(world: WorldProgress[]): number {
  const total = world.reduce((s, w) => s + w.required, 0);
  const done = world.reduce((s, w) => s + Math.min(w.points, w.required), 0);
  return total ? done / total : 0;
}
