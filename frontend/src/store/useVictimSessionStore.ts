import { create } from 'zustand';
import { VictimCase, ChatThread } from '@/types/api';
import { api } from '@/services/api';

interface VictimSessionState {
  victimCase: VictimCase | null;
  sessionToken: string | null;
  chatThread: ChatThread | null;
  isLoading: boolean;
  isChatSending: boolean;
  error: string | null;

  authenticate: (reference: string, accessCode: string) => Promise<void>;
  fetchChat: () => Promise<void>;
  sendMessage: (question: string) => Promise<void>;
  clearSession: () => void;
}

export const useVictimSessionStore = create<VictimSessionState>((set, get) => ({
  victimCase: null,
  sessionToken: null,
  chatThread: null,
  isLoading: false,
  isChatSending: false,
  error: null,

  authenticate: async (reference: string, accessCode: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.createVictimSession(reference, accessCode);
      set({
        victimCase: response.data.case,
        sessionToken: response.data.token,
        isLoading: false,
        error: null,
      });
      get().fetchChat();
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Invalid reference or access code. Try demo code.',
      });
      throw err;
    }
  },

  fetchChat: async () => {
    const vc = get().victimCase;
    if (!vc) return;
    try {
      const res = await api.getVictimChat(vc.reference);
      set({ chatThread: res.data });
    } catch (err: any) {
      console.error('Failed to load chat:', err);
    }
  },

  sendMessage: async (question: string) => {
    const vc = get().victimCase;
    if (!vc) return;
    set({ isChatSending: true, error: null });
    try {
      await api.sendVictimMessage(vc.reference, question);
      // Refresh chat thread
      const res = await api.getVictimChat(vc.reference);
      set({ chatThread: res.data, isChatSending: false });
    } catch (err: any) {
      set({ isChatSending: false, error: err.message || 'Failed to send message' });
      throw err;
    }
  },

  clearSession: () => {
    set({ victimCase: null, sessionToken: null, chatThread: null, error: null });
  },
}));
