import type { Scalar } from '@op-engineering/op-sqlite';
import { all, inTransaction, run } from './database';
import type {
  FocusSession,
  ProvisionalReward,
  Quest,
  QuestHistory,
  Ritual,
  RitualCompletion,
  SyncOp,
  SyncOpType,
  XpEntry,
} from '../domain/types';
import { nowIso } from '../utils/id';

type Row = Record<string, Scalar>;

const QUEST_COLS = [
  'id', 'user_id', 'title', 'description', 'category_id', 'priority', 'difficulty', 'deadline', 'recurrence',
  'status', 'completed_at', 'last_completed_period', 'source', 'created_at', 'updated_at', 'deleted_at',
] as const;

const RITUAL_COLS = [
  'id', 'user_id', 'title', 'description', 'schedule_type', 'schedule_days', 'weekly_target', 'reminder_time',
  'reminder_enabled', 'icon', 'is_archived', 'created_at', 'updated_at', 'deleted_at',
] as const;

const upsertSql = (table: string, cols: readonly string[]) =>
  `insert or replace into ${table} (${cols.join(', ')}) values (${cols.map(() => '?').join(', ')})`;

// ---------------------------------------------------------------------------
// kv
// ---------------------------------------------------------------------------
export const kvRepo = {
  async get<T>(key: string, fallback: T): Promise<T> {
    const rows = await all<{ value: string }>('select value from kv where key = ?', [key]);
    if (!rows[0]) return fallback;
    try {
      return JSON.parse(rows[0].value) as T;
    } catch {
      return fallback;
    }
  },
  async set(key: string, value: unknown) {
    await run('insert or replace into kv (key, value) values (?, ?)', [key, JSON.stringify(value)]);
  },
};

// ---------------------------------------------------------------------------
// quests
// ---------------------------------------------------------------------------
const toQuest = (r: Row): Quest => ({
  id: String(r.id),
  user_id: (r.user_id as string) ?? null,
  title: String(r.title),
  description: String(r.description ?? ''),
  category_id: (r.category_id as string) ?? null,
  priority: r.priority as Quest['priority'],
  difficulty: r.difficulty as Quest['difficulty'],
  deadline: (r.deadline as string) ?? null,
  recurrence: (r.recurrence as Quest['recurrence']) ?? 'none',
  status: r.status as Quest['status'],
  completed_at: (r.completed_at as string) ?? null,
  last_completed_period: (r.last_completed_period as string) ?? null,
  source: (r.source as Quest['source']) ?? 'manual',
  created_at: String(r.created_at),
  updated_at: String(r.updated_at),
  deleted_at: (r.deleted_at as string) ?? null,
});

const questParams = (q: Quest): Scalar[] => QUEST_COLS.map(c => (q[c] ?? null) as Scalar);

export const questRepo = {
  async list(): Promise<Quest[]> {
    const rows = await all<Row>('select * from quests where deleted_at is null order by created_at desc');
    return rows.map(toQuest);
  },
  async get(id: string): Promise<Quest | null> {
    const rows = await all<Row>('select * from quests where id = ?', [id]);
    return rows[0] ? toQuest(rows[0]) : null;
  },
  async upsert(q: Quest) {
    await run(upsertSql('quests', QUEST_COLS), questParams(q));
  },
  /** Replace local rows with server truth, except entities with unsynced local edits. */
  async applyServer(rows: Quest[], protectedIds: Set<string>) {
    const serverIds = new Set(rows.map(r => r.id));
    const local = await all<{ id: string }>('select id from quests');
    await inTransaction(async exec => {
      for (const q of rows) {
        if (!protectedIds.has(q.id)) await exec(upsertSql('quests', QUEST_COLS), questParams(q));
      }
      for (const { id } of local) {
        if (!serverIds.has(id) && !protectedIds.has(id)) await exec('delete from quests where id = ?', [id]);
      }
    });
  },
};

// ---------------------------------------------------------------------------
// rituals
// ---------------------------------------------------------------------------
const toRitual = (r: Row): Ritual => ({
  id: String(r.id),
  user_id: (r.user_id as string) ?? null,
  title: String(r.title),
  description: String(r.description ?? ''),
  schedule_type: r.schedule_type as Ritual['schedule_type'],
  schedule_days: safeParse<number[]>(r.schedule_days as string, []),
  weekly_target: Number(r.weekly_target ?? 1),
  reminder_time: (r.reminder_time as string) ?? null,
  reminder_enabled: Number(r.reminder_enabled) === 1,
  icon: String(r.icon ?? 'candle'),
  is_archived: Number(r.is_archived) === 1,
  created_at: String(r.created_at),
  updated_at: String(r.updated_at),
  deleted_at: (r.deleted_at as string) ?? null,
});

const ritualParams = (r: Ritual): Scalar[] =>
  RITUAL_COLS.map(c => {
    const v = r[c];
    if (c === 'schedule_days') return JSON.stringify(v ?? []);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return (v ?? null) as Scalar;
  });

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const ritualRepo = {
  async list(): Promise<Ritual[]> {
    const rows = await all<Row>('select * from rituals where deleted_at is null order by created_at asc');
    return rows.map(toRitual);
  },
  async get(id: string): Promise<Ritual | null> {
    const rows = await all<Row>('select * from rituals where id = ?', [id]);
    return rows[0] ? toRitual(rows[0]) : null;
  },
  async upsert(r: Ritual) {
    await run(upsertSql('rituals', RITUAL_COLS), ritualParams(r));
  },
  async applyServer(rows: Ritual[], protectedIds: Set<string>) {
    const serverIds = new Set(rows.map(r => r.id));
    const local = await all<{ id: string }>('select id from rituals');
    await inTransaction(async exec => {
      for (const r of rows) {
        if (!protectedIds.has(r.id)) await exec(upsertSql('rituals', RITUAL_COLS), ritualParams(r));
      }
      for (const { id } of local) {
        if (!serverIds.has(id) && !protectedIds.has(id)) await exec('delete from rituals where id = ?', [id]);
      }
    });
  },
};

// ---------------------------------------------------------------------------
// reward records (history tables share the sync_status lifecycle)
// ---------------------------------------------------------------------------
const toHistory = (r: Row): QuestHistory => ({
  id: String(r.id),
  quest_id: String(r.quest_id),
  period_key: String(r.period_key),
  difficulty: r.difficulty as QuestHistory['difficulty'],
  xp_awarded: Number(r.xp_awarded),
  completed_at: String(r.completed_at),
  sync_status: r.sync_status as QuestHistory['sync_status'],
});

const toCompletion = (r: Row): RitualCompletion => ({
  id: String(r.id),
  ritual_id: String(r.ritual_id),
  completion_date: String(r.completion_date),
  xp_awarded: Number(r.xp_awarded),
  completed_at: String(r.completed_at),
  sync_status: r.sync_status as RitualCompletion['sync_status'],
});

const toFocus = (r: Row): FocusSession => ({
  id: String(r.id),
  kind: r.kind as FocusSession['kind'],
  planned_minutes: Number(r.planned_minutes),
  actual_minutes: Number(r.actual_minutes),
  started_at: String(r.started_at),
  ended_at: String(r.ended_at),
  completed: Number(r.completed) === 1,
  xp_awarded: Number(r.xp_awarded),
  quest_id: (r.quest_id as string) ?? null,
  sync_status: r.sync_status as FocusSession['sync_status'],
});

const toXp = (r: Row): XpEntry => ({
  id: String(r.id),
  amount: Number(r.amount),
  source_type: r.source_type as XpEntry['source_type'],
  source_key: String(r.source_key),
  note: (r.note as string) ?? null,
  created_at: String(r.created_at),
  sync_status: r.sync_status as XpEntry['sync_status'],
});

export const historyRepo = {
  async list(): Promise<QuestHistory[]> {
    return (await all<Row>(`select * from quest_history where sync_status <> 'rejected' order by completed_at desc limit 2000`)).map(toHistory);
  },
  async insert(h: QuestHistory) {
    await run(
      'insert or replace into quest_history (id, quest_id, period_key, difficulty, xp_awarded, completed_at, sync_status) values (?, ?, ?, ?, ?, ?, ?)',
      [h.id, h.quest_id, h.period_key, h.difficulty, h.xp_awarded, h.completed_at, h.sync_status],
    );
  },
  async setStatus(id: string, status: QuestHistory['sync_status'], xp?: number) {
    await run('update quest_history set sync_status = ?, xp_awarded = coalesce(?, xp_awarded) where id = ?', [status, xp ?? null, id]);
  },
  async replaceVerified(rows: Omit<QuestHistory, 'sync_status'>[]) {
    await inTransaction(async exec => {
      await exec(`delete from quest_history where sync_status = 'verified'`);
      for (const h of rows) {
        await exec(
          `insert or ignore into quest_history (id, quest_id, period_key, difficulty, xp_awarded, completed_at, sync_status) values (?, ?, ?, ?, ?, ?, 'verified')`,
          [h.id, h.quest_id, h.period_key, h.difficulty, h.xp_awarded, h.completed_at],
        );
      }
    });
  },
};

export const completionRepo = {
  async list(): Promise<RitualCompletion[]> {
    return (await all<Row>(`select * from ritual_completions where sync_status <> 'rejected' order by completion_date desc limit 3000`)).map(toCompletion);
  },
  async insert(c: RitualCompletion) {
    await run(
      'insert or replace into ritual_completions (id, ritual_id, completion_date, xp_awarded, completed_at, sync_status) values (?, ?, ?, ?, ?, ?)',
      [c.id, c.ritual_id, c.completion_date, c.xp_awarded, c.completed_at, c.sync_status],
    );
  },
  async setStatus(id: string, status: RitualCompletion['sync_status'], xp?: number) {
    await run('update ritual_completions set sync_status = ?, xp_awarded = coalesce(?, xp_awarded) where id = ?', [status, xp ?? null, id]);
  },
  async replaceVerified(rows: Omit<RitualCompletion, 'sync_status'>[]) {
    await inTransaction(async exec => {
      await exec(`delete from ritual_completions where sync_status = 'verified'`);
      for (const c of rows) {
        await exec(
          `insert or ignore into ritual_completions (id, ritual_id, completion_date, xp_awarded, completed_at, sync_status) values (?, ?, ?, ?, ?, 'verified')`,
          [c.id, c.ritual_id, c.completion_date, c.xp_awarded, c.completed_at],
        );
      }
    });
  },
};

export const focusRepo = {
  async list(): Promise<FocusSession[]> {
    return (await all<Row>(`select * from focus_sessions where sync_status <> 'rejected' order by started_at desc limit 1000`)).map(toFocus);
  },
  async insert(f: FocusSession) {
    await run(
      'insert or replace into focus_sessions (id, kind, planned_minutes, actual_minutes, started_at, ended_at, completed, xp_awarded, quest_id, sync_status) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [f.id, f.kind, f.planned_minutes, f.actual_minutes, f.started_at, f.ended_at, f.completed ? 1 : 0, f.xp_awarded, f.quest_id, f.sync_status],
    );
  },
  async setStatus(id: string, status: FocusSession['sync_status'], xp?: number) {
    await run('update focus_sessions set sync_status = ?, xp_awarded = coalesce(?, xp_awarded) where id = ?', [status, xp ?? null, id]);
  },
  async replaceVerified(rows: Omit<FocusSession, 'sync_status'>[]) {
    await inTransaction(async exec => {
      await exec(`delete from focus_sessions where sync_status = 'verified'`);
      for (const f of rows) {
        await exec(
          `insert or ignore into focus_sessions (id, kind, planned_minutes, actual_minutes, started_at, ended_at, completed, xp_awarded, quest_id, sync_status) values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified')`,
          [f.id, f.kind, f.planned_minutes, f.actual_minutes, f.started_at, f.ended_at, f.completed ? 1 : 0, f.xp_awarded, f.quest_id],
        );
      }
    });
  },
};

export const xpRepo = {
  async list(limit = 200): Promise<XpEntry[]> {
    return (await all<Row>(`select * from xp_transactions where sync_status <> 'rejected' order by created_at desc limit ?`, [limit])).map(toXp);
  },
  async insert(e: XpEntry) {
    await run(
      'insert or replace into xp_transactions (id, amount, source_type, source_key, note, created_at, sync_status) values (?, ?, ?, ?, ?, ?, ?)',
      [e.id, e.amount, e.source_type, e.source_key, e.note, e.created_at, e.sync_status],
    );
  },
  async remove(id: string) {
    await run('delete from xp_transactions where id = ?', [id]);
  },
  async replaceVerified(rows: Omit<XpEntry, 'sync_status'>[]) {
    await inTransaction(async exec => {
      await exec(`delete from xp_transactions where sync_status = 'verified'`);
      for (const e of rows) {
        await exec(
          `insert or ignore into xp_transactions (id, amount, source_type, source_key, note, created_at, sync_status) values (?, ?, ?, ?, ?, ?, 'verified')`,
          [e.id, e.amount, e.source_type, e.source_key, e.note, e.created_at],
        );
      }
    });
  },
};

// ---------------------------------------------------------------------------
// sync queue
// ---------------------------------------------------------------------------
const toOp = (r: Row): SyncOp => ({
  id: String(r.id),
  type: r.type as SyncOpType,
  entity_id: (r.entity_id as string) ?? null,
  payload: safeParse<Record<string, unknown>>(r.payload as string, {}),
  provisional: safeParse<ProvisionalReward | null>(r.provisional as string, null),
  status: r.status as SyncOp['status'],
  attempts: Number(r.attempts),
  last_error: (r.last_error as string) ?? null,
  created_at: String(r.created_at),
});

export const opsRepo = {
  async enqueue(op: Pick<SyncOp, 'id' | 'type' | 'entity_id' | 'payload' | 'provisional'>) {
    await run(
      `insert into sync_ops (id, type, entity_id, payload, provisional, status, attempts, created_at) values (?, ?, ?, ?, ?, 'pending', 0, ?)`,
      [op.id, op.type, op.entity_id, JSON.stringify(op.payload), op.provisional ? JSON.stringify(op.provisional) : null, nowIso()],
    );
  },
  async pending(): Promise<SyncOp[]> {
    return (await all<Row>(`select * from sync_ops where status = 'pending' order by created_at asc, rowid asc`)).map(toOp);
  },
  async recentRejected(limit = 10): Promise<SyncOp[]> {
    return (await all<Row>(`select * from sync_ops where status = 'rejected' order by created_at desc limit ?`, [limit])).map(toOp);
  },
  async markApplied(id: string) {
    await run(`update sync_ops set status = 'applied', last_error = null where id = ?`, [id]);
  },
  async markRejected(id: string, error: string) {
    await run(`update sync_ops set status = 'rejected', last_error = ? where id = ?`, [error, id]);
  },
  async markAttempt(id: string, error: string) {
    await run(`update sync_ops set attempts = attempts + 1, last_error = ? where id = ?`, [error, id]);
  },
  /** Keep the applied-op log small. */
  async prune() {
    await run(`delete from sync_ops where status = 'applied' and created_at < ?`, [new Date(Date.now() - 7 * 86_400_000).toISOString()]);
  },
};
