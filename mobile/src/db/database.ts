import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';

/**
 * Local offline store. Mirrors the server tables the app needs offline plus a
 * queue of pending operations (sync_ops) that the sync engine replays.
 */
const MIGRATIONS: string[][] = [
  [
    `create table if not exists kv (key text primary key, value text not null)`,
    `create table if not exists quests (
      id text primary key, user_id text, title text not null, description text not null default '',
      category_id text, priority text not null, difficulty text not null, deadline text,
      recurrence text not null default 'none', status text not null default 'active',
      completed_at text, last_completed_period text, source text not null default 'manual',
      created_at text not null, updated_at text not null, deleted_at text)`,
    `create index if not exists quests_status_idx on quests (status, deleted_at)`,
    `create table if not exists quest_history (
      id text primary key, quest_id text not null, period_key text not null, difficulty text not null,
      xp_awarded integer not null default 0, completed_at text not null,
      sync_status text not null default 'verified', unique (quest_id, period_key))`,
    `create table if not exists rituals (
      id text primary key, user_id text, title text not null, description text not null default '',
      schedule_type text not null default 'daily', schedule_days text not null default '[]',
      weekly_target integer not null default 1, reminder_time text, reminder_enabled integer not null default 0,
      icon text not null default 'candle', is_archived integer not null default 0,
      created_at text not null, updated_at text not null, deleted_at text)`,
    `create table if not exists ritual_completions (
      id text primary key, ritual_id text not null, completion_date text not null,
      xp_awarded integer not null default 0, completed_at text not null,
      sync_status text not null default 'verified', unique (ritual_id, completion_date))`,
    `create table if not exists focus_sessions (
      id text primary key, kind text not null, planned_minutes integer not null, actual_minutes integer not null,
      started_at text not null, ended_at text not null, completed integer not null default 0,
      xp_awarded integer not null default 0, quest_id text, sync_status text not null default 'verified')`,
    `create table if not exists xp_transactions (
      id text primary key, amount integer not null, source_type text not null, source_key text not null,
      note text, created_at text not null, sync_status text not null default 'verified')`,
    `create index if not exists xp_created_idx on xp_transactions (created_at)`,
    `create table if not exists sync_ops (
      id text primary key, type text not null, entity_id text, payload text not null, provisional text,
      status text not null default 'pending', attempts integer not null default 0, last_error text,
      created_at text not null)`,
    `create index if not exists sync_ops_status_idx on sync_ops (status, created_at)`,
  ],
];

let db: DB | null = null;

export function getDb(): DB {
  if (!db) {
    db = open({ name: 'graveyard.sqlite' });
    db.executeSync('pragma journal_mode = wal');
    const current = Number(db.executeSync('pragma user_version').rows[0]?.user_version ?? 0);
    for (let v = current; v < MIGRATIONS.length; v++) {
      db.executeSync('begin');
      try {
        MIGRATIONS[v].forEach(sql => db!.executeSync(sql));
        db.executeSync(`pragma user_version = ${v + 1}`);
        db.executeSync('commit');
      } catch (e) {
        db.executeSync('rollback');
        throw e;
      }
    }
  }
  return db;
}

export async function all<T>(sql: string, params: Scalar[] = []): Promise<T[]> {
  const res = await getDb().execute(sql, params);
  return (res.rows ?? []) as unknown as T[];
}

export async function run(sql: string, params: Scalar[] = []): Promise<number> {
  const res = await getDb().execute(sql, params);
  return res.rowsAffected ?? 0;
}

export async function inTransaction(fn: (exec: (sql: string, params?: Scalar[]) => Promise<void>) => Promise<void>) {
  await getDb().transaction(async tx => {
    await fn(async (sql, params = []) => {
      await tx.execute(sql, params);
    });
  });
}

/** Removes every user-owned row (used on sign-out / account switch). */
export async function wipeUserData() {
  await inTransaction(async exec => {
    for (const t of ['quests', 'quest_history', 'rituals', 'ritual_completions', 'focus_sessions', 'xp_transactions', 'sync_ops', 'kv']) {
      await exec(`delete from ${t}`);
    }
  });
}
