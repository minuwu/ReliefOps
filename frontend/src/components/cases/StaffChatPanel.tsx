import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Bot,
  Lock,
  MessageSquare,
  RotateCw,
  Send,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { ChatMessage, ChatThread, Citation } from '@/types/api';
import { staffChatApi } from '@/services/staffChatApi';
import { errorMessage } from '@/services/http';
import { useToastStore } from '@/store/useToastStore';
import { FormNotice } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn, formatDateTime } from '@/lib/utils';

const MAX_REPLY_CHARS = 4000;

function scrollContainerToBottom(el: HTMLElement, smooth = true) {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!smooth || prefersReduced) {
    el.scrollTop = el.scrollHeight;
  } else {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 300);
  }
}

function CitationsList({ citations }: { citations: Citation[] }) {
  if (!citations || citations.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5" aria-label="Cited Sources">
      {citations.map((c, idx) => (
        <li
          key={`${c.document_id}-${c.section ?? ''}-${c.page ?? ''}-${idx}`}
          className="rounded-lg border border-[#09090B]/15 bg-[#F8F4E8] p-2 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-1 font-bold text-[#09090B]">
            <span>
              {c.document_title} · v{c.version}
            </span>
            {(c.section || c.page !== null) && (
              <span className="text-xs font-mono text-[#52525B]">
                {c.section && `Sec: ${c.section}`}
                {c.section && c.page !== null && ' · '}
                {c.page !== null && `p.${c.page}`}
              </span>
            )}
          </div>
          <p className="mt-1 italic text-[#52525B]">“{c.quote}”</p>
        </li>
      ))}
    </ul>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isVictim = message.role === 'victim';
  const isStaff = message.role === 'staff';

  return (
    <li className={`flex ${isVictim ? 'justify-start' : 'justify-end'}`}>
      <div
        className={cn(
          'max-w-[85%] rounded-xl border border-[#09090B]/20 p-3 text-xs',
          isVictim && 'bg-[#EDE8D5] text-[#09090B]',
          isStaff && 'bg-[#D2E823]/30 text-[#09090B] border-[#09090B]/30',
          !isVictim && !isStaff && 'bg-[#FFFFFF] text-[#09090B]'
        )}
      >
        <div
          className={cn(
            'mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider',
            isVictim ? 'justify-start text-[#52525B]' : 'justify-end text-[#09090B]'
          )}
        >
          {isVictim && <UserRound className="h-3.5 w-3.5 text-[#09090B]" aria-hidden="true" />}
          {isStaff && <ShieldCheck className="h-3.5 w-3.5 text-[#09090B]" aria-hidden="true" />}
          {!isVictim && !isStaff && <Bot className="h-3.5 w-3.5 text-[#09090B]" aria-hidden="true" />}

          <span>
            {isVictim
              ? 'Victim'
              : isStaff
                ? `Staff${message.author?.name ? ` (${message.author.name})` : ''}`
                : 'Assistant'}
          </span>
          <span>·</span>
          <span className="font-mono font-normal">{formatDateTime(message.created_at)}</span>
        </div>

        {message.needs_staff && (
          <span className="mb-1.5 inline-block rounded bg-[#FF334B] px-1.5 py-0.5 text-xs font-bold text-[#09090B]">
            Escalated to staff
          </span>
        )}

        <p className="whitespace-pre-wrap break-words font-medium">{message.body}</p>
        <CitationsList citations={message.citations} />
      </div>
    </li>
  );
}

function PendingBanner() {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl border border-[#FF334B]/40 bg-[#FF334B]/15 p-3 text-[#09090B]"
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[#FF334B]" aria-hidden="true" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide">
            Victim response pending
          </p>
          <p className="text-xs text-[#52525B]">
            This thread has a question requiring human staff attention.
          </p>
        </div>
      </div>
      <Badge variant="destructive" className="shrink-0 text-xs">
        Action required
      </Badge>
    </div>
  );
}

function ReadOnlyNotice() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/40 p-3 text-xs text-[#52525B]">
      <Lock className="h-4 w-4 shrink-0 text-[#52525B]" aria-hidden="true" />
      <span>Read-only view. Only operators and supervisors can post replies to victims.</span>
    </div>
  );
}

interface ReplyFormProps {
  replyText: string;
  isSending: boolean;
  sendError: string | null;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onTextChange: (text: string) => void;
  onSubmit: (e: FormEvent) => void;
}

function StaffReplyForm({
  replyText,
  isSending,
  sendError,
  textareaRef,
  onTextChange,
  onSubmit,
}: ReplyFormProps) {
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

export function StaffChatPanel({
  caseId,
  canReply,
}: {
  caseId: string;
  canReply: boolean;
}) {
  const pushToast = useToastStore((s) => s.push);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const listRef = useRef<HTMLUListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const userJustSentRef = useRef(false);
  const prevCountRef = useRef(0);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= 80;
  };

  useEffect(() => {
    isInitialLoadRef.current = true;
    prevCountRef.current = 0;
  }, [caseId]);

  const loadThread = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setLoadError(null);
      try {
        const res = await staffChatApi.getThread(caseId);
        setThread(res.data);
      } catch (err) {
        setLoadError(errorMessage(err, 'Could not load chat conversation.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [caseId]
  );

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  useEffect(() => {
    const el = listRef.current;
    const messagesCount = thread?.messages.length ?? 0;
    if (!el || isLoading || messagesCount === 0) return;

    const frameId = requestAnimationFrame(() => {
      const container = listRef.current;
      if (!container) return;
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        scrollContainerToBottom(container, false);
        isNearBottomRef.current = true;
      } else if (userJustSentRef.current) {
        userJustSentRef.current = false;
        scrollContainerToBottom(container, true);
        isNearBottomRef.current = true;
      } else if (messagesCount > prevCountRef.current && isNearBottomRef.current) {
        scrollContainerToBottom(container, true);
      }
      prevCountRef.current = messagesCount;
    });

    return () => cancelAnimationFrame(frameId);
  }, [thread?.messages.length, isLoading]);

  const handleSendReply = async (e: FormEvent) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text || isSending || !canReply) return;

    setIsSending(true);
    setSendError(null);
    let success = false;
    try {
      userJustSentRef.current = true;
      await staffChatApi.reply(caseId, text);
      setReplyText('');
      await loadThread(true);
      success = true;
    } catch (err) {
      userJustSentRef.current = false;
      const msg = errorMessage(err, 'Failed to send staff reply.');
      setSendError(msg);
      pushToast(msg, 'error');
    } finally {
      setIsSending(false);
      if (success) {
        setTimeout(() => {
          textareaRef.current?.focus({ preventScroll: true });
        }, 50);
      }
    }
  };

  return (
    <div className="space-y-4 font-['Space_Grotesk',sans-serif]">
      <div className="flex items-center justify-between border-b border-[#09090B]/15 pb-2.5">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#09090B]">
          <MessageSquare className="h-4 w-4 text-[#09090B]" aria-hidden="true" />
          Staff & victim messages
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => loadThread(true)}
          disabled={isLoading || isRefreshing || isSending}
          className="gap-1.5"
          aria-label="Refresh conversation"
        >
          <RotateCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {thread?.victim_question_pending && <PendingBanner />}

      {thread && !thread.assistant_available && (
        <div className="rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/50 p-2.5 text-xs text-[#09090B]">
          The automated assistant is currently offline. Staff should provide all updates here.
        </div>
      )}

      {isLoading && (
        <p className="py-6 text-center text-xs text-[#52525B]">
          Loading conversation…
        </p>
      )}

      {loadError && (
        <div className="space-y-3">
          <FormNotice tone="error">{loadError}</FormNotice>
          <Button type="button" variant="outline" size="sm" onClick={() => loadThread(false)}>
            Retry loading
          </Button>
        </div>
      )}

      {!isLoading && !loadError && thread && thread.messages.length === 0 && (
        <p className="py-6 text-center text-xs italic text-[#52525B]">
          No messages in this case thread yet.
        </p>
      )}

      {!isLoading && !loadError && thread && thread.messages.length > 0 && (
        <ul
          ref={listRef}
          onScroll={handleScroll}
          className="h-[min(22rem,45vh)] space-y-2.5 overflow-y-auto pr-1"
          aria-label="Chat messages"
        >
          {thread.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </ul>
      )}

      {canReply ? (
        <StaffReplyForm
          replyText={replyText}
          isSending={isSending}
          sendError={sendError}
          textareaRef={textareaRef}
          onTextChange={setReplyText}
          onSubmit={handleSendReply}
        />
      ) : (
        <ReadOnlyNotice />
      )}
    </div>
  );
}
