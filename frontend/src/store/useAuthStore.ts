import { create } from 'zustand';
import type { User } from '@/types/api';
import { authApi } from '@/services/authApi';
import { errorMessage, getAuthToken, getStoredUser, isApiError, onUnauthorized } from '@/services/http';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  /** Code of the last login failure, e.g. EMAIL_NOT_VERIFIED, so the UI can offer a resend. */
  errorCode: string | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Clears the local session without calling the server (after a 401). */
  expire: () => void;
}

function initialSession(): Pick<AuthState, 'user' | 'token'> {
  const user = getStoredUser();
  const token = getAuthToken();
  // Never pretend to be logged in: no stored session means the login screen.
  return user && token ? { user, token } : { user: null, token: null };
}

export const useAuthStore = create<AuthState>((set) => ({
  ...initialSession(),
  isLoading: false,
  error: null,
  errorCode: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null, errorCode: null });
    try {
      const res = await authApi.login(email, password);
      set({ user: res.data.user, token: res.data.token, isLoading: false });
      return res.data.user;
    } catch (err) {
      set({
        isLoading: false,
        error: errorMessage(err, 'Login failed.'),
        errorCode: isApiError(err) ? String(err.code) : null,
      });
      throw err;
    }
  },

  logout: async () => {
    await authApi.logout();
    set({ user: null, token: null, error: null, errorCode: null });
  },

  expire: () => set({ user: null, token: null }),
}));

onUnauthorized(() => {
  useAuthStore.getState().expire();
});
