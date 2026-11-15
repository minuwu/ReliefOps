import { create } from 'zustand';
import { User } from '@/types/api';
import { api, getStoredUser, getAuthToken } from '@/services/api';
import { DEMO_USERS } from '@/services/mockData';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser() || DEMO_USERS[0],
  token: getAuthToken() || 'demo_token_supervisor',
  isLoading: false,
  error: null,

  initialize: () => {
    const user = getStoredUser() || DEMO_USERS[0];
    const token = getAuthToken() || 'demo_token_supervisor';
    set({ user, token });
  },

  login: async (email: string, password?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.login(email, password);
      set({
        user: response.data.user,
        token: response.data.token,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Login failed. Please check your credentials.',
      });
      throw err;
    }
  },

  logout: async () => {
    await api.logout();
    set({ user: null, token: null, error: null });
  },
}));
