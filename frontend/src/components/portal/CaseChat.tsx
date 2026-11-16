import { useCallback, useRef, useState, type FormEvent } from 'react';
import { Bot, Send, ThumbsDown, ThumbsUp, UserRound } from 'lucide-react';
import type { ChatMessage, ChatThread, Citation } from '@/types/api';
import { victimApi } from '@/services/victimApi';
import { errorMessage, isApiError } from '@/services/http';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { useInterval, useTimeout } from '@/lib/hooks/useTimers';
import { FormNotice } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';

const MAX_QUESTION = 1000;
const DEFAULT_WAIT_SECONDS = 30;

/** Plain-language label for each kind of assistant answer (contract AnswerType). */
const ANSWER_NOTE: Record<NonNullable<ChatMessage['answer_type']>, string | null> = {
  grounded: null,
  passages_only: 'The assistant could not write a full answer. These passages from bank rules may help.',
  no_answer: 'The assistant could not find an answer. A staff member will reply here.',
  refused: 'The assistant cannot help with this question. A staff member can.',
};

function Citations({ items }: { items: Citation[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5" aria-label="Sources">
      {items.map((c) => (
        <li
          key={`${c.document_id}-${c.section ?? ''}-${c.page ?? ''}`}
          className="rounded-lg border border-[#09090B]/15 bg-[#F8F4E8] p-2 text-xs"
        >
          <p className="font-bold">
            {c.document_title} · v{c.version}
            {c.section && ` · ${c.section}`}
            {c.page !== null && ` · p.${c.page}`}
          </p>
          <p className="italic text-[#52525B]">“{c.quote}”</p>
        </li>
      ))}
    </ul>
  );
}

interface BubbleProps {
  message: ChatMessage;
  onRate: (message: ChatMessage, feedback: 'helpful' | 'not_helpful') => void;
}

function Bubble({ message, onRate }: BubbleProps) {
  const isVictim = message.role === 'victim';
  const who = isVictim
    ? 'You'
    : message.role === 'staff'
      ? message.author?.name ?? 'Operations center'
      : 'Assistant';
  const note = message.answer_type ? ANSWER_NOTE[message.answer_type] : null;
  const Icon = isVictim ? UserRound : Bot;

  return (
    <li className={`flex ${isVictim ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-xl border border-[#09090B]/20 p-3 text-sm ${
          isVictim
            ? 'bg-[#09090B] text-[#F8F4E8]'
            : message.role === 'staff'
              ? 'bg-[#D2E823] text-[#09090B]'
              : 'bg-[#EDE8D5] text-[#09090B]'
        }`}
      >
        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider opacity-80">
          <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {who} · {formatDateTime(message.created_at)}
        </p>
        {note && <p className="mb-1 text-xs font-bold">{note}</p>}
        <p className="whitespace-pre-wrap">{message.body}</p>
        <Citations items={message.citations} />
        {message.role === 'assistant' && (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {message.feedback ? (
              <span className="font-bold">Thanks for your feedback.</span>
            ) : (
              <>
                <span className="font-bold">Was this helpful?</span>
                <button
                  type="button"
                  onClick={() => onRate(message, 'helpful')}
                  aria-label="Helpful"
                  className="rounded border border-[#09090B] p-1 hover:bg-[#D2E823] cursor-pointer"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onRate(message, 'not_helpful')}
                  aria-label="Not helpful"
                  className="rounded border border-[#09090B] p-1 hover:bg-[#FF334B] cursor-pointer"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Ask the assistant about your case. The answers are general information, never a decision. */
export function CaseChat({ caseId }: { caseId: string }) {
  return <CaseChatContent key={caseId} caseId={caseId} />;
}

function CaseChatContent({ caseId }: { caseId: string }) {
  const [question, setQuestion] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [focusNonce, setFocusNonce] = useState(0);

  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);
  const isInitialLoadRef = useRef(true);
  const userJustSentRef = useRef(false);
  const prevCountRef = useRef(0);

  const {
    data: fetchedThread,
    error: loadErr,
    reload,
  } = useAsyncResource<ChatThread>(
    caseId ? `victim-chat-${caseId}` : null,
    useCallback(async () => {
      const res = await victimApi.getChat(caseId);
      return res.data;
    }, [caseId])
  );

  const loadError = loadErr
    ? errorMessage(loadErr, 'Could not load the conversation.')
    : null;

  useInterval(
    () => {
      setWaitSeconds((s) => (s > 1 ? s - 1 : 0));
    },
    waitSeconds > 0 ? 1000 : null
  );

  useTimeout(
    () => {
      inputRef.current?.focus({ preventScroll: true });
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

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = question.trim();
    if (!text || waitSeconds > 0 || isSending) return;
    setIsSending(true);
    setSendError(null);
    let success = false;
    try {
      userJustSentRef.current = true;
      const res = await victimApi.askAssistant(caseId, text);
      setLocalMessages((prev) => [...prev, res.data.question, res.data.answer]);
      setQuestion('');
      reload();
      success = true;
    } catch (err) {
      userJustSentRef.current = false;
      if (isApiError(err) && err.code === 'RATE_LIMITED') {
        const retry = (err as { retry_after?: number }).retry_after;
        setWaitSeconds(retry ?? DEFAULT_WAIT_SECONDS);
      }
      setSendError(errorMessage(err, 'Could not send your question. Try again.'));
    } finally {
      setIsSending(false);
      if (success) {
        setFocusNonce((n) => n + 1);
      }
    }
  };

  const handleRate = async (message: ChatMessage, feedback: 'helpful' | 'not_helpful') => {
    try {
      const res = await victimApi.rateAnswer(caseId, message.id, feedback);
      setLocalMessages((prev) => [...prev.filter((m) => m.id !== res.data.id), res.data]);
      reload();
    } catch (err) {
      setSendError(errorMessage(err, 'Could not save your feedback.'));
    }
  };

  if (loadError) return <FormNotice tone="error">{loadError}</FormNotice>;
  if (!thread) return <p className="text-sm font-medium text-[#52525B]">Loading the conversation…</p>;

  return (
    <div className="space-y-3 font-['Space_Grotesk',sans-serif]">
      {!thread.assistant_available && (
        <FormNotice tone="info">The assistant is offline right now. Staff will answer your questions here.</FormNotice>
      )}
      {thread.messages.length === 0 ? (
        <p className="text-sm font-medium text-[#52525B]">
          Ask anything about your case or the relief process. For example: “What happens after verification?”
        </p>
      ) : (
        <ul
          ref={listRef}
          onScroll={handleScroll}
          className="max-h-[min(12.5rem,calc(100vh-18rem))] space-y-2 overflow-y-auto pr-1"
          aria-live="polite"
        >
          {thread.messages.map((m) => (
            <Bubble key={m.id} message={m} onRate={handleRate} />
          ))}
          <li
            key={`bottom-anchor-${thread.messages.length}`}
            ref={bottomAnchorRef}
            aria-hidden="true"
            className="h-0 w-0 p-0 m-0 list-none pointer-events-none"
          />
        </ul>
      )}

      <form onSubmit={handleSend} className="space-y-2">
        <label htmlFor="chat-question" className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
          Your question
        </label>
        <textarea
          id="chat-question"
          ref={inputRef}
          rows={3}
          maxLength={MAX_QUESTION}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your case"
          className="w-full rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-3 py-2 text-sm font-medium shadow-[2px_2px_0px_0px_#09090B] focus:outline-none focus:shadow-hard"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-[#52525B]">
            {question.length}/{MAX_QUESTION}
          </span>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSending}
            disabled={!question.trim() || waitSeconds > 0}
            className="gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> {waitSeconds > 0 ? `WAIT ${waitSeconds}s` : 'ASK'}
          </Button>
        </div>
        {sendError && <FormNotice tone="error">{sendError}</FormNotice>}
        <p className="text-xs text-[#52525B]">
          Answers come from published bank rules. They are general information, not a formal decision on your payout.
        </p>
      </form>
    </div>
  );
}
