import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { luxPowerService } from '../services/luxpower';

interface AuthState {
  userName: string | null;
  userId: string | null;
  isAuthenticated: boolean;
  login: (account: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  userName: null,
  userId: null,
  isAuthenticated: false,

  login: async (account, password) => {
    // Verifies the edge function is reachable; actual LuxPower credentials live server-side.
    const data = await luxPowerService.login(account, password);

    await SecureStore.setItemAsync('account', account);
    await SecureStore.setItemAsync('password', password);
    await SecureStore.setItemAsync('userId', String(data.user ?? account));
    await SecureStore.setItemAsync('username', String(data.user ?? account));

    set({
      userName: String(data.user ?? account),
      userId: String(data.user ?? account),
      isAuthenticated: true,
    });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('account');
    await SecureStore.deleteItemAsync('password');
    await SecureStore.deleteItemAsync('userId');
    await SecureStore.deleteItemAsync('username');
    set({ userName: null, userId: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    const account = await SecureStore.getItemAsync('account');
    const userName = await SecureStore.getItemAsync('username');
    const userId = await SecureStore.getItemAsync('userId');

    console.log('[Auth] Restaurando sessão, userId:', userId);

    if (account && userId) {
      // Session tokens live in the edge function — no re-auth needed here.
      set({ userName, userId, isAuthenticated: true });
      return true;
    }
    return false;
  },
}));
