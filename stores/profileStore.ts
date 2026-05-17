import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const IS_PRO_KEY = '@wirdd/isPro';

interface ProfileState {
  isPro: boolean;
  isLoaded: boolean;
  setIsPro: (value: boolean) => void;
  loadFromCache: () => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  isPro: false,
  isLoaded: false,

  setIsPro: (value) => {
    set({ isPro: value });
    AsyncStorage.setItem(IS_PRO_KEY, value ? '1' : '0').catch(() => {});
  },

  loadFromCache: async () => {
    const cached = await AsyncStorage.getItem(IS_PRO_KEY);
    set({ isPro: cached === '1', isLoaded: true });
  },
}));
