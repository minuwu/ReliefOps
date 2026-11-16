import { X } from 'lucide-react';
import { useToastStore, type Toast, type ToastTone } from '@/store/useToastStore';
import { cn } from '@/lib/utils';
import { useTimeout } from '@/lib/hooks/useTimers';

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'bg-[#F8F4E8] text-[#09090B]',
  success: 'bg-[#D2E823] text-[#09090B]',
  error: 'bg-[#FF334B] text-[#09090B]',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useTimeout(() => onDismiss(toast.id), toast.durationMs, toast.id);
  return (
    <div
      className={cn(
      'pointer-events-auto flex items-start gap-3 rounded-xl border-2 border-[#09090B] shadow-hard px-4 py-3 text-sm font-bold animate-in w-full',
      TONE_CLASS[toast.tone]
      )}
    >
    <p className="flex-1">{toast.message}</p>
    <button
      type="button"
      onClick={() => onDismiss(toast.id)}
      aria-label="Dismiss notification"
      className="shrink-0 rounded-md border-2 border-[#09090B] bg-[#F8F4E8] p-0.5 hover:bg-[#09090B] hover:text-[#D2E823] cursor-pointer"
    >
      <X className="w-3.5 h-3.5" />
    </button>
    </div>
  );
}

/** Global toast stack positioned bottom-center to avoid covering modal controls and corner buttons. */
export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  const visibleToasts = toasts.slice(-3);

  return (
    <div
      aria-live="polite"
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 w-[calc(100%-2rem)] max-w-md pointer-events-none"
    >
      {visibleToasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
