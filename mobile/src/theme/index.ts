import { useMemo } from 'react';
import { useSettings } from '../store/settingsStore';

const base = {
  night: '#0B0A1A',
  night2: '#14122B',
  panel: 'rgba(24, 21, 52, 0.92)',
  panelSolid: '#1B1838',
  panelBorder: '#3B3470',
  navy: '#1E1B45',
  purple: '#7C3AED',
  purpleSoft: '#A78BFA',
  purpleDeep: '#4C1D95',
  gold: '#FBBF24',
  goldDeep: '#D97706',
  orange: '#F97316',
  green: '#22C55E',
  red: '#EF4444',
  blue: '#60A5FA',
  parchment: '#F3DFB0',
  parchmentInk: '#3B2A14',
  text: '#F5F3FF',
  textMuted: '#B9B3DA',
  textFaint: '#7E78A8',
  overlay: 'rgba(5, 4, 15, 0.72)',
};

export type Palette = typeof base;

const highContrast: Palette = {
  ...base,
  panel: '#120F2A',
  panelBorder: '#C4B5FD',
  textMuted: '#E9E5FF',
  textFaint: '#CFC8F5',
  overlay: 'rgba(0, 0, 0, 0.86)',
};

export const colors = base;

export const radii = { sm: 8, md: 14, lg: 20, xl: 28, pill: 999 };
export const spacing = (n: number) => n * 4;

export const difficultyColors: Record<string, string> = {
  easy: base.green,
  medium: base.gold,
  hard: base.orange,
  boss: base.purpleSoft,
};

export const stateColors: Record<string, string> = {
  locked: '#6B7280',
  abandoned: base.purple,
  awakening: base.goldDeep,
  restoration: base.blue,
  restored: base.green,
};

export const font = {
  display: { fontWeight: '900' as const, letterSpacing: 0.5 },
  title: { fontWeight: '800' as const },
  body: { fontWeight: '500' as const },
};

/** Palette that honours the High Contrast accessibility setting. */
export function usePalette(): Palette {
  const high = useSettings(s => s.highContrast);
  return useMemo(() => (high ? highContrast : base), [high]);
}
