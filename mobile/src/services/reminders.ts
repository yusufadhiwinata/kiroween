import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type { Ritual } from '../domain/types';
import { useSettings } from '../store/settingsStore';

/**
 * Ritual reminders backed by a small native module (AlarmManager + notifications,
 * see android/.../reminders). Reminders are rescheduled from local data, so they
 * work offline and survive reboots.
 */
interface ReminderModule {
  schedule(id: string, title: string, body: string, hour: number, minute: number, days: number[]): Promise<boolean>;
  cancelAll(): Promise<boolean>;
}

const native: ReminderModule | undefined = NativeModules.GraveyardReminders;

export const remindersAvailable = () => Platform.OS === 'android' && !!native;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (Number(Platform.Version) < 33) return true;
  const perm = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(perm)) return true;
  const res = await PermissionsAndroid.request(perm);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export async function syncReminders(rituals: Ritual[]) {
  if (!remindersAvailable() || !native) return;
  try {
    await native.cancelAll();
    if (!useSettings.getState().ritualReminders) return;
    for (const r of rituals) {
      if (!r.reminder_enabled || !r.reminder_time || r.is_archived || r.deleted_at) continue;
      const [h, m] = r.reminder_time.split(':').map(Number);
      const days = r.schedule_type === 'custom' ? r.schedule_days : [];
      await native.schedule(r.id, 'A ritual candle awaits', `${r.title} — keep the lantern burning, Keeper.`, h, m, days);
    }
  } catch {
    // Reminders are best-effort; never block the UI.
  }
}
