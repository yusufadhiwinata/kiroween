import { create } from 'zustand';
import type { CelebrationEvent } from '../domain/types';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  tone: 'keeper' | 'error' | 'info';
  xp?: number;
}

interface UiState {
  toasts: Toast[];
  celebrations: CelebrationEvent[];
  showToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  pushCelebrations: (events: CelebrationEvent[]) => void;
  shiftCelebration: () => void;
}

let seq = 0;

export const useUi = create<UiState>(set => ({
  toasts: [],
  celebrations: [],
  showToast: t =>
    set(s => ({ toasts: [...s.toasts.slice(-2), { ...t, id: `t${++seq}` }] })),
  dismissToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  pushCelebrations: events =>
    events.length ? set(s => ({ celebrations: [...s.celebrations, ...events].slice(0, 8) })) : undefined,
  shiftCelebration: () => set(s => ({ celebrations: s.celebrations.slice(1) })),
}));

export const toast = (t: Omit<Toast, 'id'>) => useUi.getState().showToast(t);
