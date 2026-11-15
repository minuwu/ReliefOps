import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

let nextId = 1;

interface ToastState {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const current = get().toasts;
    // Skip a new toast whose message is already showing
    if (current.some((t) => t.message.trim() === trimmed)) {
      return;
    }
    const id = nextId++;
    // Max 3 visible (keep the newest up to 3)
    const nextToasts = [...current, { id, message, tone }].slice(-3);
    set({ toasts: nextToasts });

    // Success auto-dismiss 4s, errors 8s (or until dismissed), info 4s
    const durationMs = tone === 'error' ? 8000 : 4000;
    setTimeout(() => {
      get().dismiss(id);
    }, durationMs);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Shorthand for non-React code (stores). */
export const toast = (message: string, tone?: ToastTone): void =>
  useToastStore.getState().push(message, tone);
