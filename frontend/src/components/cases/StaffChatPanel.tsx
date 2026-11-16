import { useCallback, useRef, useState, type FormEvent } from 'react';
import { MessageSquare, RotateCw } from 'lucide-react';
import type { ChatMessage, ChatThread } from '@/types/api';
import { staffChatApi } from '@/services/staffChatApi';
import { errorMessage } from '@/services/http';
import { useToastStore } from '@/store/useToastStore';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { useTimeout } from '@/lib/hooks/useTimers';
import { FormNotice } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { MessageBubble } from './staffchat/MessageBubble';
import { StaffReplyForm } from './staffchat/StaffReplyForm';
import { PendingBanner, ReadOnlyNotice } from './staffchat/ChatNotices';

export function StaffChatPanel({
  caseId,
  canReply,
}: {
  caseId: string;
  canReply: boolean;
}) {
  return <StaffChatPanelContent key={caseId} caseId={caseId} canReply={canReply} />;
}

function StaffChatPanelContent({
  caseId,
  canReply,
}: {
  caseId: string;
  canReply: boolean;
}) {
  const pushToast = useToastStore((s) => s.push);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [focusNonce, setFocusNonce] = useState(0);

  const listRef = useRef<HTMLUListElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const userJustSentRef = useRef(false);
  const prevCountRef = useRef(0);

  const {
    data: fetchedThread,
    error: loadErr,
    loading: isLoading,
    reload,
  } = useAsyncResource<ChatThread>(
    caseId ? `staff-chat-${caseId}` : null,
    useCallback(async () => {
      const res = await staffChatApi.getThread(caseId);
      return res.data;
    }, [caseId])
  );

  const loadError = loadErr
    ? errorMessage(loadErr, 'Could not load chat conversation.')
    : null;

  useTimeout(
    () => {
      textareaRef.current?.focus({ preventScroll: true });
    },
    focusNonce > 0 ? 50 : null,
    focusNonce
  );

  const thread = fetchedThread
    ? {
        ...fetchedThread,
        messages: (() => {
          const map = new Map<string, ChatMessage>();
          for (const m of fetchedThread.messages) {
            map.set(m.id, m);
          }
          for (const m of localMessages) {
            map.set(m.id, m);
          }
          return Array.from(map.values());
        })(),
      }
    : null;

  const messageCount = thread?.messages.length ?? 0;

  const handleScroll = (e: React.UIEvent<HTMLUListElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= 80;
  };

  const bottomAnchorRef = (node: HTMLLIElement | null) => {
    if (!node) return;
    const currentCount = messageCount;
    const countChanged = currentCount !== prevCountRef.current;
    if (
      isInitialLoadRef.current ||
      userJustSentRef.current ||
      (countChanged && isNearBottomRef.current)
    ) {
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const smooth = !isInitialLoadRef.current && !prefersReduced;
      node.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
      isInitialLoadRef.current = false;
      userJustSentRef.current = false;
    }
    prevCountRef.current = currentCount;
  };

  const handleSendReply = async (e: FormEvent) => {
    e.preventDefault();
    const text = replyText.trim();
    if (!text || isSending || !canReply) return;

    setIsSending(true);
    setSendError(null);
    let success = false;
    try {
      userJustSentRef.current = true;
      const res = await staffChatApi.reply(caseId, text);
      setLocalMessages((prev) => [...prev, res.data]);
      setReplyText('');
      reload();
      success = true;
    } catch (err) {
      userJustSentRef.current = false;
      const msg = errorMessage(err, 'Failed to send staff reply.');
      setSendError(msg);
      pushToast(msg, 'error');
    } finally {
      setIsSending(false);
      if (success) {
        setFocusNonce((n) => n + 1);
      }
    }
  };

  const isRefreshing = isLoading && Boolean(fetchedThread);

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
          onClick={() => reload()}
          disabled={isLoading || isSending}
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

      {isLoading && !fetchedThread && (
        <p className="py-6 text-center text-xs text-[#52525B]">
          Loading conversation…
        </p>
      )}

      {loadError && (
        <div className="space-y-3">
          <FormNotice tone="error">{loadError}</FormNotice>
          <Button type="button" variant="outline" size="sm" onClick={() => reload()}>
            Retry loading
          </Button>
        </div>
      )}

      {!isLoading && !loadError && thread && thread.messages.length === 0 && (
        <p className="py-6 text-center text-xs italic text-[#52525B]">
          No messages in this case thread yet.
        </p>
      )}

      {!loadError && thread && thread.messages.length > 0 && (
        <ul
          ref={listRef}
          onScroll={handleScroll}
          className="h-[min(22rem,45vh)] space-y-2.5 overflow-y-auto pr-1"
          aria-label="Chat messages"
        >
          {thread.messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          <li
            key={`bottom-anchor-${thread.messages.length}`}
            ref={bottomAnchorRef}
            aria-hidden="true"
            className="h-0 w-0 p-0 m-0 list-none pointer-events-none"
          />
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
