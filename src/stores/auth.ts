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
    const data = await luxPowerService.login(account, password);

    // Salva credenciais para reautenticar automaticamente
    await SecureStore.setItemAsync('account', account);
    await SecureStore.setItemAsync('password', password);
    await SecureStore.setItemAsync('userId', String(data.user ?? account));
    await SecureStore.setItemAsync('username', data.user ?? account);

    set({
      userName: data.user,
      userId: String(data.user),
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
    const password = await SecureStore.getItemAsync('password');
    const userName = await SecureStore.getItemAsync('username');
    const userId = await SecureStore.getItemAsync('userId');

    console.log('[Auth] Restaurando sessão, userId:', userId);

    if (account && password) {
      try {
        // Refaz o login no proxy para renovar o cookie do servidor
        await luxPowerService.login(account, password);
        console.log('[Auth] Reautenticado com sucesso');
        set({ userName, userId, isAuthenticated: true });
        return true;
      } catch (e) {
        console.warn('[Auth] Falha ao reautenticar:', e);
        return false;
      }
    }
    return false;
  },
}));