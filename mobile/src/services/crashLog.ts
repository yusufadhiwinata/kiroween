import { readJson, writeJson } from '../storage/mmkv';

/**
 * Minimal on-device crash/error log (last 20 entries), shown in Settings.
 * A hosted crash reporter (e.g. Sentry) can be plugged in here later.
 */
export interface CrashEntry {
  at: string;
  message: string;
  fatal: boolean;
}

const KEY = 'crashlog.v1';

export function recordError(error: unknown, fatal = false) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const list = readJson<CrashEntry[]>(KEY, []);
  list.unshift({ at: new Date().toISOString(), message: message.slice(0, 400), fatal });
  writeJson(KEY, list.slice(0, 20));
}

export const readCrashLog = () => readJson<CrashEntry[]>(KEY, []);
export const clearCrashLog = () => writeJson(KEY, []);

let installed = false;
export function installGlobalErrorHandler() {
  if (installed) return;
  installed = true;
  const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => (e: unknown, f?: boolean) => void; setGlobalHandler: (h: (e: unknown, f?: boolean) => void) => void } };
  const utils = g.ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    recordError(error, !!isFatal);
    previous(error, isFatal);
  });
}
