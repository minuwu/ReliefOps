import { X } from 'lucide-react';
import { useToastStore, type ToastTone } from '@/store/useToastStore';
import { cn } from '@/lib/utils';

const TONE_CLASS: Record<ToastTone, string> = {
  info: 'bg-[#F8F4E8] text-[#09090B]',
  success: 'bg-[#D2E823] text-[#09090B]',
  error: 'bg-[#FF334B] text-[#09090B]',
};

/** Global toast stack. Screen readers hear new toasts through the live region. */
export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div
      aria-live="polite"
      role="status"
      className="fixed top-20 sm:top-24 right-2 sm:right-6 z-[60] flex flex-col gap-2 w-[calc(100%-1rem)] max-w-sm pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-xl border-2 border-[#09090B] shadow-hard px-4 py-3 text-sm font-bold animate-in',
            TONE_CLASS[t.tone]
          )}
        >
          <p className="flex-1">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            className="shrink-0 rounded-md border-2 border-[#09090B] bg-[#F8F4E8] p-0.5 hover:bg-[#09090B] hover:text-[#D2E823] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
