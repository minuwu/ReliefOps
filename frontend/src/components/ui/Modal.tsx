import React, { useEffect, useId } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl';
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'lg',
}: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidths = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-['Space_Grotesk',sans-serif]">
      {/* Heavy Backdrop */}
      <div
        className="fixed inset-0 bg-[#09090B]/70 backdrop-blur-sm animate-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={cn(
          'relative z-10 w-full rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] text-[#09090B] p-6 sm:p-8 shadow-hard-lg max-h-[90vh] overflow-y-auto overscroll-contain animate-in',
          maxWidths[maxWidth]
        )}
      >
        <div
          className={cn(
            'flex items-start justify-between gap-4',
            title || description ? 'pb-4 border-b-2 border-[#09090B] mb-5' : '-mt-2 -mr-2 mb-2 justify-end'
          )}
        >
          <div className="min-w-0">
            {title && (
              <h2
                id={titleId}
                className="text-lg sm:text-xl font-['Dela_Gothic_One'] uppercase tracking-tight text-[#09090B]"
              >
                {title}
              </h2>
            )}
            {description && <p className="text-xs sm:text-sm font-medium text-[#52525B] mt-1">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] text-[#09090B] shadow-hard-sm hover:bg-[#D2E823] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
