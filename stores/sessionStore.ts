import { create } from 'zustand';

import { insertSession, endSession, changeSessionCount } from '@/services/database';

function makeLocalId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

interface SessionState {
  isActive: boolean;
  isPaused: boolean;
  count: number;
  startedAt: number | null;
  localId: string | null;
  phraseId: string;
  mode: 'voice' | 'manual';
  startSession: (mode?: 'voice' | 'manual') => void;
  stopSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  increment: () => void;
  decrement: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  isActive: false,
  isPaused: false,
  count: 0,
  startedAt: null,
  localId: null,
  phraseId: 'astaghfirullah',
  mode: 'voice',

  startSession: (mode = 'voice') => {
    if (get().isActive) return;
    const localId = makeLocalId();
    const startedAt = Date.now();
    insertSession(localId, startedAt, get().phraseId);
    set({ isActive: true, isPaused: false, count: 0, startedAt, localId, mode });
  },

  stopSession: () => {
    const { localId, count, startedAt } = get();
    if (!localId || startedAt === null) return;
    const endedAt = Date.now();
    endSession(localId, endedAt, count);
    set({ isActive: false, isPaused: false, startedAt: null, localId: null, mode: 'voice' });
  },

  pauseSession: () => { if (get().isActive) set({ isPaused: true }); },
  resumeSession: () => { if (get().isActive) set({ isPaused: false }); },

  increment: () => {
    const { isActive, localId } = get();
    if (isActive && localId) set({ count: changeSessionCount(localId, 1) });
  },
  decrement: () => {
    const { isActive, localId, count } = get();
    if (isActive && localId && count > 0) set({ count: changeSessionCount(localId, -1) });
  },
}));
