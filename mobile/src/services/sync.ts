/**
 * Offline-first sync engine.
 *
 * push: replays the local sync_ops queue in order. Content edits are upserted
 *       (server resolves conflicts last-write-wins on updated_at). Reward ops call
 *       idempotent RPCs keyed by the op id, so retries can never double-reward.
 * pull: refreshes the authoritative snapshot (XP, level, world, achievements)
 *       and the user's content, without overwriting entities that still have
 *       unsynced local edits.
 */
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  completionRepo,
  focusRepo,
  historyRepo,
  opsRepo,
  questRepo,
  ritualRepo,
  xpRepo,
} from '../db/repositories';
import type { KeeperSnapshot, Quest, RewardResult, Ritual, SyncOp } from '../domain/types';
import { registerSyncTrigger, useKeeper } from '../store/keeperStore';
import { useSession } from '../store/sessionStore';
import { useUi } from '../store/uiStore';
import { nowIso, uuid } from '../utils/id';
import { getSupabase, isTransientError } from './supabase';

const QUEST_FIELDS = ['id', 'title', 'description', 'category_id', 'priority', 'difficulty', 'deadline', 'recurrence', 'status', 'created_at', 'updated_at', 'deleted_at'] as const;
const RITUAL_FIELDS = ['id', 'title', 'description', 'schedule_type', 'schedule_days', 'weekly_target', 'reminder_time', 'reminder_enabled', 'icon', 'is_archived', 'created_at', 'updated_at', 'deleted_at'] as const;

const REJECT_MESSAGES: Record<string, string> = {
  already_completed: 'That quest was already completed.',
  already_completed_this_period: 'Already completed for this period.',
  quest_not_found: 'The quest no longer exists.',
  ritual_not_found: 'The ritual no longer exists.',
  date_out_of_range: 'Ritual check-ins older than 2 days cannot be verified.',
  overlapping_session: 'Focus sessions cannot overlap.',
  duration_exceeds_elapsed_time: 'Focus time did not match the clock.',
  weekly_target_reached: 'Weekly ritual target already reached.',
  not_scheduled_today: 'That ritual is not scheduled for that day.',
};

let running = false;
let rerun = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function pick<T extends object>(row: T, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  fields.forEach(f => {
    out[f] = (row as Record<string, unknown>)[f] ?? null;
  });
  return out;
}

type ApplyOutcome = 'applied' | 'rejected' | 'transient';

class RejectedError extends Error {}

async function applyReward(op: SyncOp, result: RewardResult) {
  if (!result.ok) throw new RejectedError(result.error ?? 'rejected');
  if (result.snapshot) await useKeeper.getState().setSnapshot(result.snapshot);
  const xp = result.xp_awarded ?? 0;
  if (op.type === 'quest.complete') await historyRepo.setStatus(op.id, 'verified', xp);
  if (op.type === 'ritual.complete') await completionRepo.setStatus(op.id, 'verified', xp);
  if (op.type === 'focus.record') await focusRepo.setStatus(String(op.payload.session_id), 'verified', xp);
  if (result.quest) await questRepo.upsert({ ...result.quest });
  await xpRepo.remove(op.id); // the verified ledger entry arrives with the next pull
}

async function revertReward(op: SyncOp) {
  if (op.type === 'quest.complete') await historyRepo.setStatus(op.id, 'rejected', 0);
  if (op.type === 'ritual.complete') await completionRepo.setStatus(op.id, 'rejected', 0);
  if (op.type === 'focus.record') await focusRepo.setStatus(String(op.payload.session_id), 'rejected', 0);
  await xpRepo.remove(op.id);
}

async function applyOp(sb: SupabaseClient, uid: string, op: SyncOp): Promise<ApplyOutcome> {
  try {
    switch (op.type) {
      case 'quest.upsert': {
        const row: Record<string, unknown> = { ...pick(op.payload.row as Quest, QUEST_FIELDS), user_id: uid };
        if (row.status === 'completed') delete row.status; // completion is server-owned
        const { error } = await sb.from('quests').upsert(row, { onConflict: 'id' });
        if (error) throw error;
        break;
      }
      case 'ritual.upsert': {
        const row = { ...pick(op.payload.row as Ritual, RITUAL_FIELDS), user_id: uid };
        const { error } = await sb.from('rituals').upsert(row, { onConflict: 'id' });
        if (error) throw error;
        break;
      }
      case 'quest.complete': {
        const { data, error } = await sb.rpc('complete_quest', {
          p_op_id: op.id,
          p_quest_id: op.payload.quest_id,
          p_completed_at: op.payload.completed_at,
        });
        if (error) throw error;
        await applyReward(op, data as RewardResult);
        break;
      }
      case 'ritual.complete': {
        const { data, error } = await sb.rpc('complete_ritual', {
          p_op_id: op.id,
          p_ritual_id: op.payload.ritual_id,
          p_date: op.payload.date,
        });
        if (error) throw error;
        await applyReward(op, data as RewardResult);
        break;
      }
      case 'focus.record': {
        const p = op.payload;
        const { data, error } = await sb.rpc('record_focus_session', {
          p_op_id: op.id,
          p_session_id: p.session_id,
          p_kind: p.kind,
          p_planned_minutes: p.planned_minutes,
          p_actual_minutes: p.actual_minutes,
          p_started_at: p.started_at,
          p_ended_at: p.ended_at,
          p_quest_id: p.quest_id ?? null,
        });
        if (error) throw error;
        await applyReward(op, data as RewardResult);
        break;
      }
      case 'profile.update': {
        const { error } = await sb.from('profiles').update(op.payload).eq('id', uid);
        if (error) throw error;
        break;
      }
      case 'settings.update': {
        const { error } = await sb.from('user_settings').upsert({ ...op.payload, user_id: uid }, { onConflict: 'user_id' });
        if (error) throw error;
        break;
      }
    }
    await opsRepo.markApplied(op.id);
    return 'applied';
  } catch (err) {
    const message = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
    if (!(err instanceof RejectedError) && isTransientError(err)) {
      await opsRepo.markAttempt(op.id, message);
      return 'transient';
    }
    await opsRepo.markRejected(op.id, message);
    await revertReward(op);
    if (op.type.endsWith('.complete') || op.type === 'focus.record') {
      useUi.getState().showToast({
        tone: 'error',
        title: 'Reward not verified',
        message: REJECT_MESSAGES[message] ?? message,
      });
    }
    return 'rejected';
  }
}

async function push(sb: SupabaseClient, uid: string): Promise<boolean> {
  const ops = await opsRepo.pending();
  for (const op of ops) {
    const outcome = await applyOp(sb, uid, op);
    if (outcome === 'transient') return false; // keep order; retry later
  }
  await opsRepo.prune();
  return true;
}

async function pull(sb: SupabaseClient) {
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const sinceDay = since.slice(0, 10);
  const [snap, quests, rituals, history, completions, focus, xp, profile] = await Promise.all([
    sb.rpc('get_keeper_snapshot'),
    sb.from('quests').select('*').is('deleted_at', null).limit(2000),
    sb.from('rituals').select('*').is('deleted_at', null).limit(500),
    sb.from('quest_history').select('id, quest_id, period_key, difficulty, xp_awarded, completed_at').gte('completed_at', since).limit(3000),
    sb.from('ritual_completions').select('id, ritual_id, completion_date, xp_awarded, completed_at').gte('completion_date', sinceDay).limit(5000),
    sb.from('focus_sessions').select('id, kind, planned_minutes, actual_minutes, started_at, ended_at, completed, xp_awarded, quest_id').gte('started_at', since).limit(2000),
    sb.from('xp_transactions').select('id, amount, source_type, source_key, note, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(500),
    sb.from('profiles').select('display_name').maybeSingle(),
  ]);
  const firstError = [snap, quests, rituals, history, completions, focus, xp, profile].find(r => r.error)?.error;
  if (firstError) throw firstError;

  const pending = await opsRepo.pending();
  const protectedIds = new Set(pending.map(p => p.entity_id).filter((x): x is string => !!x));

  await useKeeper.getState().setSnapshot(snap.data as KeeperSnapshot);
  await questRepo.applyServer((quests.data ?? []) as Quest[], protectedIds);
  await ritualRepo.applyServer(
    ((rituals.data ?? []) as Ritual[]).map(r => ({
      ...r,
      schedule_days: r.schedule_days ?? [],
      reminder_time: r.reminder_time ? r.reminder_time.slice(0, 5) : null,
    })),
    protectedIds,
  );
  await historyRepo.replaceVerified(history.data ?? []);
  await completionRepo.replaceVerified(completions.data ?? []);
  await focusRepo.replaceVerified(focus.data ?? []);
  await xpRepo.replaceVerified(xp.data ?? []);
  if (profile.data?.display_name) await useKeeper.getState().setDisplayName(profile.data.display_name);
}

export async function runSync(): Promise<void> {
  const sb = getSupabase();
  if (!sb || useSession.getState().status !== 'signedIn') return;
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  const keeper = useKeeper.getState();
  // The first pull on a device replays history the Keeper already earned; don't celebrate it.
  const firstSync = !keeper.sync.lastAt;
  keeper.setSync({ running: true, error: null });
  try {
    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      keeper.setSync({ online: false });
      return;
    }
    const { data } = await sb.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return;
    const clean = await push(sb, uid);
    if (clean) await pull(sb);
    keeper.setSync({ online: true, lastAt: nowIso(), error: clean ? null : 'Some changes are waiting for a connection' });
  } catch (err) {
    const message = (err as { message?: string })?.message ?? 'Sync failed';
    keeper.setSync({ error: message, online: !isTransientError(err) });
  } finally {
    running = false;
    keeper.setSync({ running: false });
    await useKeeper.getState().refresh(!firstSync);
    if (rerun) {
      rerun = false;
      scheduleSync(300);
    }
  }
}

export function scheduleSync(delay = 700) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void runSync();
  }, delay);
}

let started = false;
/** Wires reconnect and foreground triggers once per app process. */
export function startSyncTriggers() {
  if (started) return;
  started = true;
  registerSyncTrigger(() => scheduleSync());
  let wasOffline = false;
  NetInfo.addEventListener(state => {
    const offline = state.isConnected === false;
    useKeeper.getState().setSync({ online: !offline });
    if (wasOffline && !offline) scheduleSync(400);
    wasOffline = offline;
  });
  AppState.addEventListener('change', s => {
    if (s === 'active') scheduleSync(500);
  });
}

/** Queue a profile edit (display name / timezone) for the server. */
export async function queueProfileUpdate(patch: { display_name?: string; timezone?: string; onboarded_at?: string }) {
  await opsRepo.enqueue({ id: uuid(), type: 'profile.update', entity_id: null, payload: patch, provisional: null });
  scheduleSync();
}

export async function queueSettingsUpdate(patch: Record<string, unknown>) {
  await opsRepo.enqueue({ id: uuid(), type: 'settings.update', entity_id: null, payload: patch, provisional: null });
  scheduleSync(2000);
}
