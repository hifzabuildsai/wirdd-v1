import { create } from 'zustand';

interface ProfileState {
  isPro: boolean;
  setIsPro: (value: boolean) => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  isPro: false,
  setIsPro: (value) => set({ isPro: value }),
}));
