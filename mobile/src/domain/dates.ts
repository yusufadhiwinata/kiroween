const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date key, e.g. 2026-11-23. */
export function dayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDayKey(b).getTime() - parseDayKey(a).getTime()) / 86_400_000);
}

/** ISO week key matching Postgres to_char(date, 'IYYY-"W"IW'). */
export function isoWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${pad(week)}`;
}

/** Monday-based start of week (matches Postgres date_trunc('week')). */
export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 0, 0);
  return d;
}

export function isSameDay(iso: string | null | undefined, date: Date = new Date()): boolean {
  return !!iso && dayKey(new Date(iso)) === dayKey(date);
}

export function timezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDeadline(iso: string | null): string {
  if (!iso) return 'No deadline';
  const d = new Date(iso);
  const now = new Date();
  const diff = daysBetween(dayKey(now), dayKey(d));
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.getTime() < now.getTime()) return `Overdue · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;
  if (diff < 7) return `${WEEKDAYS_SHORT[d.getDay()]} ${time}`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'The witching hour';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
