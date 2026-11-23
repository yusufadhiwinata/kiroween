import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { kv } from '../storage/mmkv';

export interface SettingsValues {
  soundEnabled: boolean;
  musicVolume: number;
  ambienceVolume: number;
  sfxVolume: number;
  reduceMotion: boolean;
  highContrast: boolean;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  ritualReminders: boolean;
  onboardingDone: boolean;
  soundIntroDone: boolean;
  equippedCosmetic: string;
}

/** PRD 7: initial audio defaults (configurable). */
export const DEFAULT_SETTINGS: SettingsValues = {
  soundEnabled: true,
  musicVolume: 0.45,
  ambienceVolume: 0.35,
  sfxVolume: 0.65,
  reduceMotion: false,
  highContrast: false,
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  ritualReminders: true,
  onboardingDone: false,
  soundIntroDone: false,
  equippedCosmetic: 'default',
};

interface SettingsState extends SettingsValues {
  update: (patch: Partial<SettingsValues>) => void;
  reset: () => void;
}

const mmkvStorage = {
  getItem: (name: string) => kv.getString(name) ?? null,
  setItem: (name: string, value: string) => kv.set(name, value),
  removeItem: (name: string) => {
    kv.remove(name);
  },
};

export const useSettings = create<SettingsState>()(
  persist(
    set => ({
      ...DEFAULT_SETTINGS,
      update: patch => set(patch),
      reset: () => set({ ...DEFAULT_SETTINGS, onboardingDone: true, soundIntroDone: true }),
    }),
    {
      name: 'settings.v1',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: ({ update: _u, reset: _r, ...values }) => values,
    },
  ),
);
