import { create } from 'zustand';

import { insertSession, endSession, refreshDailySummary } from '@/services/database';

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
  startSession: () => void;
  stopSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  increment: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  isActive: false,
  isPaused: false,
  count: 0,
  startedAt: null,
  localId: null,
  phraseId: 'astaghfirullah',

  startSession: () => {
    const localId = makeLocalId();
    const startedAt = Date.now();
    insertSession(localId, startedAt, get().phraseId);
    set({ isActive: true, isPaused: false, count: 0, startedAt, localId });
  },

  stopSession: () => {
    const { localId, count, startedAt } = get();
    if (!localId || startedAt === null) return;
    const endedAt = Date.now();
    endSession(localId, endedAt, count);
    const date = new Date(endedAt).toISOString().slice(0, 10);
    refreshDailySummary(date);
    set({ isActive: false, isPaused: false, startedAt: null, localId: null });
  },

  pauseSession: () => set({ isPaused: true }),
  resumeSession: () => set({ isPaused: false }),

  increment: () => set((s) => ({ count: s.count + 1 })),
}));
