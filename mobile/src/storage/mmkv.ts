import { createMMKV } from 'react-native-mmkv';

/** Small synchronous key-value store for preferences and the auth session. */
export const kv = createMMKV({ id: 'graveyard' });

export function readJson<T>(key: string, fallback: T): T {
  const raw = kv.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  kv.set(key, JSON.stringify(value));
}

/** Storage adapter for supabase-js auth session persistence. */
export const authStorage = {
  getItem: (key: string) => kv.getString(`auth.${key}`) ?? null,
  setItem: (key: string, value: string) => kv.set(`auth.${key}`, value),
  removeItem: (key: string) => {
    kv.remove(`auth.${key}`);
  },
};
