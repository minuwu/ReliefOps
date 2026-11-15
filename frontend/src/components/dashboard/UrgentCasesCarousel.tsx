import { useRef } from 'react';
import { CaseSummary } from '@/types/api';
import { Badge } from '@/components/ui/Badge';
import { GlitchText } from '@/components/ui/GlitchText';
import { StickerBadge } from '@/components/ui/StickerBadge';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Building2,
  ArrowRight,
  Flame,
} from 'lucide-react';

interface UrgentCasesCarouselProps {
  cases: CaseSummary[];
  onSelectCase: (caseItem: CaseSummary) => void;
}

export function UrgentCasesCarousel({ cases, onSelectCase }: UrgentCasesCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const urgentCases = cases.filter(
    (c) => c.deadline_state === 'overdue' || c.deadline_state === 'due_soon' || (c.amount || 0) >= 3000000
  );

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -340 : 340;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  if (urgentCases.length === 0) return null;

  return (
    <div className="my-6 sm:my-10 font-['Space_Grotesk',sans-serif] w-full max-w-full overflow-hidden min-w-0">
      {/* Header with Arrow Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-start sm:items-center gap-3">
          <span className="p-2 rounded-xl bg-[#D2E823] text-[#09090B] border-2 border-[#09090B] shadow-hard-sm shrink-0">
            <Flame className="w-5 h-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <GlitchText as="h3" className="text-base sm:text-2xl font-['Dela_Gothic_One'] text-[#09090B] break-words">
                STATUTORY ESCALATION PIPELINE
              </GlitchText>
              <StickerBadge variant="coral" rotate="-rotate-1" className="text-[10px] py-0.5">
                URGENT
              </StickerBadge>
            </div>
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#52525B]">
              High-velocity claims facing statutory 30-day forfeiture or pro-rata notice deadlines
            </p>
          </div>
        </div>

        {/* Arrow Navigation */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            onClick={() => scroll('left')}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] text-[#09090B] shadow-hard-sm hover:bg-[#D2E823] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none flex items-center justify-center cursor-pointer transition-all"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] text-[#09090B] shadow-hard-sm hover:bg-[#D2E823] hover:translate-x-[1px] hover:translate-y-[1px] active:shadow-none flex items-center justify-center cursor-pointer transition-all"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrolling Cards Container */}
      <div
        ref={scrollRef}
        className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 sm:pb-6 pt-2 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x"
      >
        {urgentCases.map((caseItem) => {
          return (
            <div
              key={caseItem.id}
              onClick={() => onSelectCase(caseItem)}
              className="w-[280px] sm:w-[320px] shrink-0 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-4 sm:p-5 shadow-hard sm:shadow-hard-lg hover:translate-x-1 hover:translate-y-1 hover:shadow-hard transition-all duration-150 cursor-pointer flex flex-col justify-between group"
            >
              <div>
                {/* Top Badge & Identifier */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#09090B] text-[#D2E823] border border-[#09090B]">
                    {caseItem.reference}
                  </span>
                  <Badge deadlineState={caseItem.deadline_state}>
                    {caseItem.deadline_state.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Case Subject */}
                <p className="font-bold text-sm text-[#09090B] line-clamp-1 uppercase">
                  {caseItem.victim_name}
                </p>
                <div className="flex items-center gap-2 text-xs font-mono text-[#52525B] mt-1">
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="uppercase">{caseItem.bank_id}</span>
                  <span>•</span>
                  <span>{formatDate(caseItem.reported_date)}</span>
                </div>

                {/* Value Container */}
                <div className="my-4 p-3 rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] shadow-[2px_2px_0px_0px_#09090B]">
                  <p className="text-[10px] font-mono font-bold uppercase text-[#52525B]">RELIEF CLAIM VALUE</p>
                  <p className="text-xl font-['Dela_Gothic_One'] text-[#09090B] tracking-tight mt-0.5">
                    {formatCurrency(caseItem.amount || 0, 'JPY')}
                  </p>
                </div>

                {/* Statutory Milestone */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#52525B] font-bold uppercase text-[11px]">STAGE:</span>
                  <Badge status={caseItem.status}>{caseItem.status.replace('_', ' ')}</Badge>
                </div>
              </div>

              {/* Action Link */}
              <div className="pt-4 mt-4 border-t-2 border-[#09090B] flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#09090B] group-hover:text-[#D2E823] group-hover:bg-[#09090B] p-2 -mx-2 -mb-2 rounded-lg transition-colors">
                <span>INSPECT CASE</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
