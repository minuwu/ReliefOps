import { Bot, ShieldCheck, UserRound } from 'lucide-react';
import type { ChatMessage } from '@/types/api';
import { cn, formatDateTime } from '@/lib/utils';
import { CitationsList } from './CitationsList';

export function MessageBubble({ message }: { message: ChatMessage }) {
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
