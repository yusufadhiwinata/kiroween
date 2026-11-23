import { create } from 'zustand';
import { kv } from '../storage/mmkv';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn' | 'guest';

interface SessionState {
  status: SessionStatus;
  userId: string | null;
  email: string | null;
  setSignedIn: (userId: string, email: string | null) => void;
  setGuest: () => void;
  setSignedOut: () => void;
}

const GUEST_FLAG = 'session.guest';

export const GUEST_ID = 'guest';

export const useSession = create<SessionState>(set => ({
  status: 'loading',
  userId: null,
  email: null,
  setSignedIn: (userId, email) => {
    kv.remove(GUEST_FLAG);
    set({ status: 'signedIn', userId, email });
  },
  setGuest: () => {
    kv.set(GUEST_FLAG, true);
    set({ status: 'guest', userId: GUEST_ID, email: null });
  },
  setSignedOut: () => {
    kv.remove(GUEST_FLAG);
    set({ status: 'signedOut', userId: null, email: null });
  },
}));

export const wasGuest = () => kv.getBoolean(GUEST_FLAG) === true;
