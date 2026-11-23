export type Difficulty = 'easy' | 'medium' | 'hard' | 'boss';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Recurrence = 'none' | 'daily' | 'weekly';
export type QuestStatus = 'active' | 'completed' | 'archived';
export type SyncStatus = 'verified' | 'pending' | 'rejected';
export type RegionState = 'locked' | 'abandoned' | 'awakening' | 'restoration' | 'restored';
export type ScheduleType = 'daily' | 'weekly' | 'custom';
export type FocusKind = 'pomodoro' | 'custom' | 'short_break' | 'long_break';

export interface Quest {
  id: string;
  user_id: string | null;
  title: string;
  description: string;
  category_id: string | null;
  priority: Priority;
  difficulty: Difficulty;
  deadline: string | null;
  recurrence: Recurrence;
  status: QuestStatus;
  completed_at: string | null;
  last_completed_period: string | null;
  source: 'manual' | 'ai';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface QuestHistory {
  id: string;
  quest_id: string;
  period_key: string;
  difficulty: Difficulty;
  xp_awarded: number;
  completed_at: string;
  sync_status: SyncStatus;
}

export interface Ritual {
  id: string;
  user_id: string | null;
  title: string;
  description: string;
  schedule_type: ScheduleType;
  schedule_days: number[];
  weekly_target: number;
  reminder_time: string | null; // HH:MM
  reminder_enabled: boolean;
  icon: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RitualCompletion {
  id: string;
  ritual_id: string;
  completion_date: string; // YYYY-MM-DD
  xp_awarded: number;
  completed_at: string;
  sync_status: SyncStatus;
}

export interface FocusSession {
  id: string;
  kind: FocusKind;
  planned_minutes: number;
  actual_minutes: number;
  started_at: string;
  ended_at: string;
  completed: boolean;
  xp_awarded: number;
  quest_id: string | null;
  sync_status: SyncStatus;
}

export interface XpEntry {
  id: string;
  amount: number;
  source_type: 'quest' | 'ritual' | 'focus' | 'achievement' | 'bonus';
  source_key: string;
  note: string | null;
  created_at: string;
  sync_status: SyncStatus;
}

export interface KeeperCounters {
  xp: number;
  level: number;
  soul_energy: number;
  quests_completed: number;
  boss_quests_completed: number;
  rituals_completed: number;
  focus_sessions_completed: number;
  focus_minutes: number;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
}

export interface WorldProgress {
  area_id: string;
  points: number;
  state: RegionState;
  required: number;
  unlock_level: number;
  unlocked_at?: string | null;
  restored_at?: string | null;
}

export interface UnlockedAchievement {
  id: string;
  unlocked_at: string;
}

/** Shape returned by get_keeper_snapshot() and every reward RPC. */
export interface KeeperSnapshot {
  stats: KeeperCounters;
  world: WorldProgress[];
  achievements: UnlockedAchievement[];
}

/** Provisional effect of a pending (unsynced) reward operation. */
export interface ProvisionalReward {
  xp: number;
  quests?: number;
  boss?: number;
  rituals?: number;
  focusSessions?: number;
  focusMinutes?: number;
  activityDate?: string | null;
}

export type SyncOpType =
  | 'quest.upsert'
  | 'quest.complete'
  | 'ritual.upsert'
  | 'ritual.complete'
  | 'focus.record'
  | 'profile.update'
  | 'settings.update';

export interface SyncOp {
  id: string;
  type: SyncOpType;
  entity_id: string | null;
  payload: Record<string, unknown>;
  provisional: ProvisionalReward | null;
  status: 'pending' | 'applied' | 'rejected';
  attempts: number;
  last_error: string | null;
  created_at: string;
}

export interface RewardResult {
  ok: boolean;
  error?: string;
  duplicate?: boolean;
  xp_awarded?: number;
  level_before?: number;
  level_after?: number;
  level_up?: boolean;
  capped?: boolean;
  unlocked_achievements?: { id: string; name: string; xp: number; icon: string }[];
  snapshot?: KeeperSnapshot;
  quest?: Quest;
}

export type CelebrationEvent =
  | { kind: 'level'; level: number }
  | { kind: 'achievement'; id: string }
  | { kind: 'region_unlocked'; areaId: string }
  | { kind: 'region_restored'; areaId: string };
