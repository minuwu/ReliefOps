import type { FormEvent, RefObject } from 'react';
import { Send } from 'lucide-react';
import { FormNotice } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export const MAX_REPLY_CHARS = 4000;

export interface StaffReplyFormProps {
  replyText: string;
  isSending: boolean;
  sendError: string | null;
  textareaRef: RefObject<HTMLTextAreaElement>;
  onTextChange: (text: string) => void;
  onSubmit: (e: FormEvent) => void;
}

export function StaffReplyForm({
  replyText,
  isSending,
  sendError,
  textareaRef,
  onTextChange,
  onSubmit,
}: StaffReplyFormProps) {
  const isTooLong = replyText.length > MAX_REPLY_CHARS;
  const isDisabled = !replyText.trim() || isTooLong || isSending;

  return (
    <form onSubmit={onSubmit} className="space-y-2.5 border-t border-[#09090B]/15 pt-3">
      <div className="flex items-center justify-between">
        <label
          htmlFor="staff-chat-reply-textarea"
          className="text-xs font-bold uppercase tracking-wide text-[#09090B]"
        >
          Send staff reply
        </label>
        <span
          className={cn(
            'font-mono text-xs',
            isTooLong ? 'font-bold text-[#FF334B]' : 'text-[#52525B]'
          )}
        >
          {replyText.length}/{MAX_REPLY_CHARS}
        </span>
      </div>

      <textarea
        ref={textareaRef}
        id="staff-chat-reply-textarea"
        rows={3}
        maxLength={MAX_REPLY_CHARS}
        value={replyText}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Type reply to victim..."
        disabled={isSending}
        className="w-full rounded-xl border border-[#09090B]/20 bg-[#F8F4E8] p-3 text-xs font-medium focus:outline-none focus:border-[#09090B]"
      />

      {sendError && <FormNotice tone="error">{sendError}</FormNotice>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[#52525B]">
          Visible to victim immediately. Clears pending flag and records audit log.
        </p>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          isLoading={isSending}
          disabled={isDisabled}
          className="shrink-0 gap-1.5"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" /> Send reply
        </Button>
      </div>
    </form>
  );
}
