import { create } from 'zustand';

import { insertSession, endSession } from '@/services/database';

function makeLocalId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

interface SessionState {
  isActive: boolean;
  count: number;
  startedAt: number | null;
  localId: string | null;
  phraseId: string;
  startSession: () => void;
  stopSession: () => void;
  increment: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  isActive: false,
  count: 0,
  startedAt: null,
  localId: null,
  phraseId: 'astaghfirullah',

  startSession: () => {
    const localId = makeLocalId();
    const startedAt = Date.now();
    insertSession(localId, startedAt, get().phraseId);
    set({ isActive: true, count: 0, startedAt, localId });
  },

  stopSession: () => {
    const { localId, count, startedAt } = get();
    if (!localId || startedAt === null) return;
    endSession(localId, Date.now(), count);
    set({ isActive: false, startedAt: null, localId: null });
  },

  increment: () => set((s) => ({ count: s.count + 1 })),
}));
