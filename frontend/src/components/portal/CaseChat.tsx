import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, Send, ThumbsDown, ThumbsUp, UserRound } from 'lucide-react';
import type { ChatMessage, ChatThread, Citation } from '@/types/api';
import { victimApi } from '@/services/victimApi';
import { errorMessage, isApiError } from '@/services/http';
import { FormNotice } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';

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
        <li key={`${c.document_id}-${c.section}-${c.page}`} className="rounded-lg border border-[#09090B]/15 bg-[#F8F4E8] p-2 text-xs">
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
  const who = isVictim ? 'You' : message.role === 'staff' ? message.author?.name ?? 'Operations center' : 'Assistant';
  const note = message.answer_type ? ANSWER_NOTE[message.answer_type] : null;
  const Icon = isVictim ? UserRound : Bot;

  return (
    <li className={`flex ${isVictim ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-xl border border-[#09090B]/20 p-3 text-sm ${
          isVictim ? 'bg-[#09090B] text-[#F8F4E8]' : message.role === 'staff' ? 'bg-[#D2E823] text-[#09090B]' : 'bg-[#EDE8D5] text-[#09090B]'
        }`}
      >
        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider opacity-80">
          <Icon className="w-3.5 h-3.5" aria-hidden="true" /> {who} · {new Date(message.created_at).toLocaleString()}
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
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let isActive = true;
    victimApi
      .getChat(caseId)
      .then((res) => isActive && setThread(res.data))
      .catch((err) => isActive && setLoadError(errorMessage(err, 'Could not load the conversation.')));
    return () => {
      isActive = false;
    };
  }, [caseId]);

  useEffect(() => {
    if (waitSeconds <= 0) return;
    const timer = setTimeout(() => setWaitSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [waitSeconds]);

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' });
  }, [thread?.messages.length]);

  const appendMessages = (messages: ChatMessage[]) =>
    setThread((t) => (t ? { ...t, messages: [...t.messages, ...messages] } : t));

  const replaceMessage = (next: ChatMessage) =>
    setThread((t) => (t ? { ...t, messages: t.messages.map((m) => (m.id === next.id ? next : m)) } : t));

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const text = question.trim();
    if (!text || waitSeconds > 0) return;
    setIsSending(true);
    setSendError(null);
    try {
      const res = await victimApi.askAssistant(caseId, text);
      appendMessages([res.data.question, res.data.answer]);
      setQuestion('');
    } catch (err) {
      if (isApiError(err) && err.code === 'RATE_LIMITED') {
        const retry = (err as { retry_after?: number }).retry_after;
        setWaitSeconds(retry ?? DEFAULT_WAIT_SECONDS);
      }
      setSendError(errorMessage(err, 'Could not send your question. Try again.'));
    } finally {
      setIsSending(false);
    }
  };

  const handleRate = async (message: ChatMessage, feedback: 'helpful' | 'not_helpful') => {
    try {
      const res = await victimApi.rateAnswer(caseId, message.id, feedback);
      replaceMessage(res.data);
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
        <ul ref={listRef} className="max-h-[28rem] space-y-2 overflow-y-auto pr-1" aria-live="polite">
          {thread.messages.map((m) => (
            <Bubble key={m.id} message={m} onRate={handleRate} />
          ))}
        </ul>
      )}

      <form onSubmit={handleSend} className="space-y-2">
        <label htmlFor="chat-question" className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
          Your question
        </label>
        <textarea
          id="chat-question"
          rows={3}
          maxLength={MAX_QUESTION}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-3 py-2 text-sm font-medium shadow-[2px_2px_0px_0px_#09090B] focus:outline-none focus:shadow-hard"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-[#52525B]">
            {question.length}/{MAX_QUESTION}
          </span>
          <Button type="submit" variant="primary" size="sm" isLoading={isSending} disabled={!question.trim() || waitSeconds > 0} className="gap-1.5">
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
