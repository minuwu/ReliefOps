import React, { useCallback, useId, useRef } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useWindowEvent } from '@/lib/hooks/useEventListener';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '5xl';
}

const openModals: HTMLElement[] = [];

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const elements = Array.from(container.querySelectorAll<HTMLElement>(selector));
  return elements.filter((el) => {
    return (
      (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0) &&
      window.getComputedStyle(el).visibility !== 'hidden'
    );
  });
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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  const setDialogRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      dialogRef.current = node;
      previousActiveElementRef.current = (document.activeElement as HTMLElement) || null;
      openModals.push(node);
      document.body.style.overflow = 'hidden';

      const focusables = getFocusableElements(node);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        node.focus();
      }
    } else {
      const dialogEl = dialogRef.current;
      if (dialogEl) {
        const idx = openModals.indexOf(dialogEl);
        if (idx !== -1) {
          openModals.splice(idx, 1);
        }
        if (openModals.length === 0) {
          document.body.style.overflow = 'unset';
        }
        dialogRef.current = null;
      }
      const prevEl = previousActiveElementRef.current;
      if (prevEl && prevEl.isConnected && typeof prevEl.focus === 'function') {
        try {
          prevEl.focus();
        } catch (error) {
          void error;
        }
      }
      previousActiveElementRef.current = null;
    }
  }, []);

  useWindowEvent(
    'keydown',
    (e) => {
      const dialogEl = dialogRef.current;
      if (!dialogEl) return;
      const isTopmost = openModals[openModals.length - 1] === dialogEl;
      if (!isTopmost) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusables = getFocusableElements(dialogEl);
        if (focusables.length === 0) {
          e.preventDefault();
          dialogEl.focus();
          return;
        }

        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        const activeEl = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (
            !activeEl ||
            !dialogEl.contains(activeEl) ||
            activeEl === firstEl ||
            (activeEl !== dialogEl &&
              Boolean(activeEl.compareDocumentPosition(firstEl) & Node.DOCUMENT_POSITION_FOLLOWING))
          ) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          if (
            !activeEl ||
            !dialogEl.contains(activeEl) ||
            activeEl === lastEl ||
            Boolean(lastEl.compareDocumentPosition(activeEl) & Node.DOCUMENT_POSITION_FOLLOWING)
          ) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    },
    isOpen,
  );

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
        ref={setDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] text-[#09090B] p-6 sm:p-8 shadow-hard-lg max-h-[90vh] overflow-y-auto overscroll-contain animate-in focus:outline-none',
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
                className="text-lg sm:text-xl font-['Dela_Gothic_One'] tracking-tight text-[#09090B]"
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
