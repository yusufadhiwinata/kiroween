import { create } from 'zustand';
import {
  completionRepo,
  focusRepo,
  historyRepo,
  kvRepo,
  opsRepo,
  questRepo,
  ritualRepo,
  xpRepo,
} from '../db/repositories';
import { wipeUserData } from '../db/database';
import {
  DAILY_REWARDED_QUEST_CAP,
  DAILY_TIER_CAP,
  FOCUS_DAILY_MINUTES_CAP,
  FOCUS_XP_PER_SESSION_CAP,
  QUEST_XP,
  RITUAL_XP,
} from '../domain/constants';
import { addDays, dayKey, isoWeekKey, parseDayKey, startOfWeek } from '../domain/dates';
import { deriveDisplay, diffCelebrations, emptySnapshot, type DisplayProgress } from '../domain/progression';
import type {
  FocusKind,
  FocusSession,
  KeeperSnapshot,
  ProvisionalReward,
  Quest,
  QuestHistory,
  Ritual,
  RitualCompletion,
  SyncOp,
  XpEntry,
} from '../domain/types';
import { nowIso, uuid } from '../utils/id';
import { GUEST_ID } from './sessionStore';
import { useUi } from './uiStore';

export type QuestInput = Pick<Quest, 'title' | 'description' | 'category_id' | 'priority' | 'difficulty' | 'deadline' | 'recurrence'> & {
  id?: string;
};

export type RitualInput = Pick<
  Ritual,
  'title' | 'description' | 'schedule_type' | 'schedule_days' | 'weekly_target' | 'reminder_time' | 'reminder_enabled'
> & { id?: string };

export interface SyncInfo {
  running: boolean;
  lastAt: string | null;
  error: string | null;
  online: boolean;
}

interface KeeperState {
  ready: boolean;
  ownerId: string | null;
  displayName: string;
  quests: Quest[];
  rituals: Ritual[];
  history: QuestHistory[];
  completions: RitualCompletion[];
  focus: FocusSession[];
  xp: XpEntry[];
  snapshot: KeeperSnapshot;
  display: DisplayProgress;
  pendingOps: number;
  sync: SyncInfo;

  load: (ownerId: string) => Promise<void>;
  refresh: (celebrate?: boolean) => Promise<void>;
  setSnapshot: (snapshot: KeeperSnapshot) => Promise<void>;
  setDisplayName: (name: string) => Promise<void>;
  setSync: (patch: Partial<SyncInfo>) => void;
  signOutWipe: () => Promise<void>;

  saveQuest: (input: QuestInput) => Promise<Quest>;
  deleteQuest: (id: string) => Promise<void>;
  completeQuest: (id: string) => Promise<{ xp: number; capped: boolean } | null>;
  saveRitual: (input: RitualInput) => Promise<Ritual>;
  deleteRitual: (id: string) => Promise<void>;
  completeRitual: (id: string) => Promise<{ xp: number } | { error: string }>;
  recordFocus: (input: {
    kind: FocusKind;
    planned: number;
    actual: number;
    startedAt: Date;
    endedAt: Date;
    questId: string | null;
  }) => Promise<{ xp: number }>;
  addServerQuest: (quest: Quest) => Promise<void>;
  addServerRitual: (ritual: Ritual) => Promise<void>;
}

let syncHook: (() => void) | null = null;
/** The sync engine registers itself here to avoid an import cycle. */
export const registerSyncTrigger = (fn: () => void) => {
  syncHook = fn;
};
const requestSync = () => syncHook?.();

const isFocusKind = (k: FocusKind) => k === 'pomodoro' || k === 'custom';

function advanceDeadline(q: Quest, now: Date): string | null {
  if (!q.deadline || q.recurrence === 'none') return q.deadline;
  const unit = q.recurrence === 'daily' ? 86_400_000 : 7 * 86_400_000;
  const d = new Date(q.deadline).getTime();
  const steps = Math.max(1, Math.floor((now.getTime() - d) / unit) + 1);
  return new Date(d + steps * unit).toISOString();
}

export function periodKeyFor(q: Pick<Quest, 'recurrence'>, date = new Date()): string {
  if (q.recurrence === 'daily') return dayKey(date);
  if (q.recurrence === 'weekly') return isoWeekKey(date);
  return 'once';
}

export function isRitualDueOn(r: Ritual, date: Date): boolean {
  if (r.schedule_type === 'custom') return r.schedule_days.includes(date.getDay());
  return true;
}

export function ritualStreak(r: Ritual, completions: RitualCompletion[], today = new Date()): number {
  const days = new Set(completions.filter(c => c.ritual_id === r.id).map(c => c.completion_date));
  if (r.schedule_type === 'weekly') {
    let streak = 0;
    let week = startOfWeek(today);
    const doneInWeek = (start: Date) =>
      [...Array(7)].filter((_, i) => days.has(dayKey(addDays(start, i)))).length >= r.weekly_target;
    if (!doneInWeek(week)) week = addDays(week, -7);
    while (doneInWeek(week) && streak < 520) {
      streak++;
      week = addDays(week, -7);
    }
    return streak;
  }
  let streak = 0;
  let cursor = new Date(today);
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  for (let guard = 0; guard < 730; guard++) {
    if (!isRitualDueOn(r, cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (!days.has(dayKey(cursor))) break;
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export const useKeeper = create<KeeperState>((set, get) => ({
  ready: false,
  ownerId: null,
  displayName: 'Keeper',
  quests: [],
  rituals: [],
  history: [],
  completions: [],
  focus: [],
  xp: [],
  snapshot: emptySnapshot(),
  display: deriveDisplay(emptySnapshot(), []),
  pendingOps: 0,
  sync: { running: false, lastAt: null, error: null, online: true },

  async load(ownerId) {
    const previousOwner = await kvRepo.get<string | null>('owner', null);
    // Guest progress migrates into the first account; another account's data is wiped.
    if (previousOwner && previousOwner !== ownerId && previousOwner !== GUEST_ID) {
      await wipeUserData();
    }
    await kvRepo.set('owner', ownerId);
    const snapshot = await kvRepo.get<KeeperSnapshot>('snapshot', emptySnapshot());
    const displayName = await kvRepo.get<string>('displayName', 'Keeper');
    const lastAt = await kvRepo.get<string | null>('lastSyncAt', null);
    set({ ownerId, snapshot, displayName, sync: { ...get().sync, lastAt } });
    await get().refresh(false);
    set({ ready: true });
  },

  async refresh(celebrate = false) {
    const [quests, rituals, history, completions, focus, xp, pending] = await Promise.all([
      questRepo.list(),
      ritualRepo.list(),
      historyRepo.list(),
      completionRepo.list(),
      focusRepo.list(),
      xpRepo.list(),
      opsRepo.pending(),
    ]);
    const provisional = pending.map(p => p.provisional).filter((p): p is ProvisionalReward => !!p);
    const display = deriveDisplay(get().snapshot, provisional);
    const prev = get().display;
    set({ quests, rituals, history, completions, focus, xp, display, pendingOps: pending.length });
    if (celebrate && get().ready) useUi.getState().pushCelebrations(diffCelebrations(prev, display));
  },

  async setSnapshot(snapshot) {
    await kvRepo.set('snapshot', snapshot);
    set({ snapshot });
  },

  async setDisplayName(name) {
    await kvRepo.set('displayName', name);
    set({ displayName: name });
  },

  setSync(patch) {
    set({ sync: { ...get().sync, ...patch } });
    if (patch.lastAt) void kvRepo.set('lastSyncAt', patch.lastAt);
  },

  async signOutWipe() {
    await wipeUserData();
    set({
      ready: false,
      ownerId: null,
      quests: [],
      rituals: [],
      history: [],
      completions: [],
      focus: [],
      xp: [],
      snapshot: emptySnapshot(),
      display: deriveDisplay(emptySnapshot(), []),
      pendingOps: 0,
    });
  },

  // ------------------------------------------------------------------ quests
  async saveQuest(input) {
    const existing = input.id ? await questRepo.get(input.id) : null;
    const now = nowIso();
    const quest: Quest = {
      id: existing?.id ?? uuid(),
      user_id: existing?.user_id ?? null,
      title: input.title.trim().slice(0, 120),
      description: input.description.trim().slice(0, 1000),
      category_id: input.category_id,
      priority: input.priority,
      difficulty: input.difficulty,
      deadline: input.deadline,
      recurrence: input.recurrence,
      status: existing?.status ?? 'active',
      completed_at: existing?.completed_at ?? null,
      last_completed_period: existing?.last_completed_period ?? null,
      source: existing?.source ?? 'manual',
      created_at: existing?.created_at ?? now,
      updated_at: now,
      deleted_at: null,
    };
    await questRepo.upsert(quest);
    await opsRepo.enqueue({ id: uuid(), type: 'quest.upsert', entity_id: quest.id, payload: { row: quest }, provisional: null });
    await get().refresh();
    requestSync();
    return quest;
  },

  async deleteQuest(id) {
    const q = await questRepo.get(id);
    if (!q) return;
    const now = nowIso();
    const row = { ...q, deleted_at: now, updated_at: now };
    await questRepo.upsert(row);
    await opsRepo.enqueue({ id: uuid(), type: 'quest.upsert', entity_id: id, payload: { row }, provisional: null });
    await get().refresh();
    requestSync();
  },

  async completeQuest(id) {
    const q = get().quests.find(x => x.id === id);
    if (!q || q.status === 'archived') return null;
    if (q.recurrence === 'none' && q.status === 'completed') return null;
    const now = new Date();
    const period = periodKeyFor(q, now);
    const history = get().history;
    if (history.some(h => h.quest_id === id && h.period_key === period)) return null;

    const today = dayKey(now);
    const rewardedToday = history.filter(h => h.xp_awarded > 0 && dayKey(new Date(h.completed_at)) === today);
    const tierCap = DAILY_TIER_CAP[q.difficulty];
    const capped =
      rewardedToday.length >= DAILY_REWARDED_QUEST_CAP ||
      (tierCap !== undefined && rewardedToday.filter(h => h.difficulty === q.difficulty).length >= tierCap);
    const xp = capped ? 0 : QUEST_XP[q.difficulty];
    const opId = uuid();
    const at = now.toISOString();

    await historyRepo.insert({ id: opId, quest_id: id, period_key: period, difficulty: q.difficulty, xp_awarded: xp, completed_at: at, sync_status: 'pending' });
    await questRepo.upsert({
      ...q,
      status: q.recurrence === 'none' ? 'completed' : 'active',
      completed_at: at,
      last_completed_period: period,
      deadline: advanceDeadline(q, now),
    });
    if (xp > 0) {
      await xpRepo.insert({ id: opId, amount: xp, source_type: 'quest', source_key: `quest:${id}:${period}`, note: q.title, created_at: at, sync_status: 'pending' });
    }
    await opsRepo.enqueue({
      id: opId,
      type: 'quest.complete',
      entity_id: id,
      payload: { quest_id: id, completed_at: at },
      provisional: { xp, quests: 1, boss: q.difficulty === 'boss' ? 1 : 0, activityDate: today },
    });
    await get().refresh(true);
    requestSync();
    return { xp, capped };
  },

  async addServerQuest(quest) {
    await questRepo.upsert(quest);
    await get().refresh();
  },

  // ----------------------------------------------------------------- rituals
  async saveRitual(input) {
    const existing = input.id ? await ritualRepo.get(input.id) : null;
    const now = nowIso();
    const ritual: Ritual = {
      id: existing?.id ?? uuid(),
      user_id: existing?.user_id ?? null,
      title: input.title.trim().slice(0, 80),
      description: input.description.trim().slice(0, 500),
      schedule_type: input.schedule_type,
      schedule_days: input.schedule_type === 'custom' ? [...new Set(input.schedule_days)].sort() : [],
      weekly_target: Math.min(7, Math.max(1, input.weekly_target)),
      reminder_time: input.reminder_time,
      reminder_enabled: input.reminder_enabled,
      icon: existing?.icon ?? 'candle',
      is_archived: false,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      deleted_at: null,
    };
    await ritualRepo.upsert(ritual);
    await opsRepo.enqueue({ id: uuid(), type: 'ritual.upsert', entity_id: ritual.id, payload: { row: ritual }, provisional: null });
    await get().refresh();
    requestSync();
    return ritual;
  },

  async deleteRitual(id) {
    const r = await ritualRepo.get(id);
    if (!r) return;
    const now = nowIso();
    const row = { ...r, deleted_at: now, updated_at: now };
    await ritualRepo.upsert(row);
    await opsRepo.enqueue({ id: uuid(), type: 'ritual.upsert', entity_id: id, payload: { row }, provisional: null });
    await get().refresh();
    requestSync();
  },

  async completeRitual(id) {
    const r = get().rituals.find(x => x.id === id);
    if (!r) return { error: 'ritual_not_found' };
    const now = new Date();
    const today = dayKey(now);
    const mine = get().completions.filter(c => c.ritual_id === id);
    if (mine.some(c => c.completion_date === today)) return { error: 'already_completed' };
    if (!isRitualDueOn(r, now)) return { error: 'not_scheduled_today' };
    if (r.schedule_type === 'weekly') {
      const weekStart = startOfWeek(now).getTime();
      const thisWeek = mine.filter(c => parseDayKey(c.completion_date).getTime() >= weekStart).length;
      if (thisWeek >= r.weekly_target) return { error: 'weekly_target_reached' };
    }
    const opId = uuid();
    const at = now.toISOString();
    await completionRepo.insert({ id: opId, ritual_id: id, completion_date: today, xp_awarded: RITUAL_XP, completed_at: at, sync_status: 'pending' });
    await xpRepo.insert({ id: opId, amount: RITUAL_XP, source_type: 'ritual', source_key: `ritual:${id}:${today}`, note: r.title, created_at: at, sync_status: 'pending' });
    await opsRepo.enqueue({
      id: opId,
      type: 'ritual.complete',
      entity_id: id,
      payload: { ritual_id: id, date: today },
      provisional: { xp: RITUAL_XP, rituals: 1, activityDate: today },
    });
    await get().refresh(true);
    requestSync();
    return { xp: RITUAL_XP };
  },

  async addServerRitual(ritual) {
    await ritualRepo.upsert(ritual);
    await get().refresh();
  },

  // ------------------------------------------------------------------- focus
  async recordFocus({ kind, planned, actual, startedAt, endedAt, questId }) {
    const focusKind = isFocusKind(kind);
    let xp = 0;
    if (focusKind && actual >= 5) {
      const day = dayKey(startedAt);
      const minutesToday = get()
        .focus.filter(f => isFocusKind(f.kind) && dayKey(new Date(f.started_at)) === day)
        .reduce((s, f) => s + f.actual_minutes, 0);
      const rewardable = Math.min(actual, FOCUS_XP_PER_SESSION_CAP, Math.max(0, FOCUS_DAILY_MINUTES_CAP - minutesToday));
      xp = Math.floor(rewardable / 5) * 5;
    }
    const id = uuid();
    const opId = uuid();
    const finished = actual >= planned;
    const session: FocusSession = {
      id,
      kind,
      planned_minutes: planned,
      actual_minutes: actual,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      completed: finished,
      xp_awarded: xp,
      quest_id: questId,
      sync_status: 'pending',
    };
    await focusRepo.insert(session);
    if (xp > 0) {
      await xpRepo.insert({ id: opId, amount: xp, source_type: 'focus', source_key: `focus:${id}`, note: kind, created_at: session.ended_at, sync_status: 'pending' });
    }
    await opsRepo.enqueue({
      id: opId,
      type: 'focus.record',
      entity_id: id,
      payload: {
        session_id: id,
        kind,
        planned_minutes: planned,
        actual_minutes: actual,
        started_at: session.started_at,
        ended_at: session.ended_at,
        quest_id: questId,
      },
      provisional: {
        xp,
        focusSessions: focusKind && finished && actual >= 5 ? 1 : 0,
        focusMinutes: focusKind ? actual : 0,
        activityDate: focusKind && actual >= 5 ? dayKey(startedAt) : null,
      },
    });
    await get().refresh(true);
    requestSync();
    return { xp };
  },
}));

export type { SyncOp };
