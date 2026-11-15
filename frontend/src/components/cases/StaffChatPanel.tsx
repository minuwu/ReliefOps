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

function CitationsList({ citations }: { citations: Citation[] }) {
  if (!citations || citations.length === 0) return null;
  return (
    <ul className="mt-2.5 space-y-1.5" aria-label="Cited Sources">
      {citations.map((c, idx) => (
        <li
          key={`${c.document_id}-${c.section ?? ''}-${c.page ?? ''}-${idx}`}
          className="rounded-lg border-2 border-[#09090B] bg-[#F8F4E8] p-2 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-1 font-bold text-[#09090B]">
            <span>
              {c.document_title} · v{c.version}
            </span>
            {(c.section || c.page !== null) && (
              <span className="text-[10px] font-mono text-[#52525B]">
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
          'max-w-[85%] rounded-xl border-2 border-[#09090B] p-3 text-sm shadow-[2px_2px_0px_0px_#09090B]',
          isVictim && 'bg-[#EDE8D5] text-[#09090B]',
          isStaff && 'bg-[#D2E823] text-[#09090B]',
          !isVictim && !isStaff && 'bg-[#FFFFFF] text-[#09090B]'
        )}
      >
        <div
          className={cn(
            'mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider',
            isVictim ? 'justify-start text-[#52525B]' : 'justify-end text-[#09090B]'
          )}
        >
          {isVictim && <UserRound className="h-3.5 w-3.5 text-[#09090B]" aria-hidden="true" />}
          {isStaff && <ShieldCheck className="h-3.5 w-3.5 text-[#09090B]" aria-hidden="true" />}
          {!isVictim && !isStaff && <Bot className="h-3.5 w-3.5 text-[#09090B]" aria-hidden="true" />}

          <span>
            {isVictim
              ? 'VICTIM'
              : isStaff
                ? `STAFF${message.author?.name ? ` (${message.author.name})` : ''}`
                : 'ASSISTANT'}
          </span>
          <span>·</span>
          <span>{formatDateTime(message.created_at)}</span>
        </div>

        {message.needs_staff && (
          <span className="mb-1.5 inline-block rounded bg-[#FF334B] px-1.5 py-0.5 text-[10px] font-bold text-[#09090B]">
            Escalated to Staff
          </span>
        )}

        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <CitationsList citations={message.citations} />
      </div>
    </li>
  );
}

function PendingBanner() {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#09090B] bg-[#FF334B] p-3 text-[#09090B] shadow-hard-sm"
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-5 w-5 shrink-0 text-[#09090B]" aria-hidden="true" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider">
            The victim is waiting for a person
          </p>
          <p className="text-xs font-medium">
            This thread has a pending question or escalation requiring human staff attention.
          </p>
        </div>
      </div>
      <Badge variant="default" className="shrink-0 bg-[#09090B] text-[10px] text-[#D2E823]">
        ACTION REQUIRED
      </Badge>
    </div>
  );
}

function ReadOnlyNotice() {
  return (
    <div className="flex items-center gap-2 rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] p-3 text-xs font-bold text-[#52525B]">
      <Lock className="h-4 w-4 shrink-0 text-[#52525B]" aria-hidden="true" />
      <span>Read-only view. Only operators and supervisors can post replies to victims.</span>
    </div>
  );
}

interface ReplyFormProps {
  replyText: string;
  isSending: boolean;
  sendError: string | null;
  onTextChange: (text: string) => void;
  onSubmit: (e: FormEvent) => void;
}

function StaffReplyForm({
  replyText,
  isSending,
  sendError,
  onTextChange,
  onSubmit,
}: ReplyFormProps) {
  const isTooLong = replyText.length > MAX_REPLY_CHARS;
  const isDisabled = !replyText.trim() || isTooLong || isSending;

  return (
    <form onSubmit={onSubmit} className="space-y-2.5 border-t-2 border-[#09090B]/15 pt-3">
      <div className="flex items-center justify-between">
        <label
          htmlFor="staff-chat-reply-textarea"
          className="text-xs font-bold uppercase tracking-wider text-[#09090B]"
        >
          Send Staff Reply
        </label>
        <span
          className={cn(
            'font-mono text-[11px]',
            isTooLong ? 'font-bold text-[#FF334B]' : 'text-[#52525B]'
          )}
        >
          {replyText.length}/{MAX_REPLY_CHARS}
        </span>
      </div>

      <textarea
        id="staff-chat-reply-textarea"
        rows={3}
        maxLength={MAX_REPLY_CHARS}
        value={replyText}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Type reply to victim... (e.g., We have received your police report and initiated verification.)"
        disabled={isSending}
        className="w-full rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] p-3 text-sm font-medium shadow-[2px_2px_0px_0px_#09090B] focus:shadow-hard focus:outline-none"
      />

      {sendError && <FormNotice tone="error">{sendError}</FormNotice>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-[#52525B]">
          Visible to victim immediately. Clears pending question flag and records an audit log.
        </p>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          isLoading={isSending}
          disabled={isDisabled}
          className="shrink-0 gap-1.5"
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" /> SEND REPLY
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
  const messagesEndRef = useRef<HTMLUListElement>(null);

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
    messagesEndRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [thread?.messages.length]);

  const handleSendReply = async (e: FormEvent) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text || isSending || !canReply) return;

    setIsSending(true);
    setSendError(null);
    try {
      await staffChatApi.reply(caseId, text);
      pushToast('Staff reply sent successfully.', 'success');
      setReplyText('');
      await loadThread(true);
    } catch (err) {
      setSendError(errorMessage(err, 'Failed to send staff reply.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-5 shadow-hard sm:p-6">
      <div className="flex items-center justify-between border-b-2 border-[#09090B]/10 pb-3">
        <h4 className="flex items-center gap-2 font-['Dela_Gothic_One'] text-xs uppercase tracking-wider text-[#09090B]">
          <MessageSquare className="h-4 w-4 text-[#09090B]" aria-hidden="true" />
          VICTIM ASSISTANT & STAFF CHAT
        </h4>
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
          REFRESH
        </Button>
      </div>

      {thread?.victim_question_pending && <PendingBanner />}

      {thread && !thread.assistant_available && (
        <div className="rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] p-2.5 text-xs font-semibold text-[#09090B]">
          The automated assistant is currently offline. Staff should provide all updates here.
        </div>
      )}

      {isLoading && (
        <p className="py-6 text-center text-sm font-medium text-[#52525B]">
          Loading conversation…
        </p>
      )}

      {loadError && (
        <div className="space-y-3">
          <FormNotice tone="error">{loadError}</FormNotice>
          <Button type="button" variant="outline" size="sm" onClick={() => loadThread(false)}>
            Retry Loading
          </Button>
        </div>
      )}

      {!isLoading && !loadError && thread && thread.messages.length === 0 && (
        <p className="py-6 text-center text-sm italic text-[#52525B]">
          No messages in this case thread yet.
        </p>
      )}

      {!isLoading && !loadError && thread && thread.messages.length > 0 && (
        <ul
          ref={messagesEndRef}
          className="max-h-[26rem] space-y-3 overflow-y-auto pr-1"
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
          onTextChange={setReplyText}
          onSubmit={handleSendReply}
        />
      ) : (
        <ReadOnlyNotice />
      )}
    </div>
  );
}
