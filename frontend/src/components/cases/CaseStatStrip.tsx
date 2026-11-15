import { TrendingUp, BrainCircuit, Clock, AlertOctagon } from 'lucide-react';
import { formatCurrency, pluralize } from '@/lib/utils';

export interface CaseStatStripProps {
  totalClaimed: number;
  aiPendingCount: number;
  dueSoonCount: number;
  overdueCount: number;
}

export function CaseStatStrip({
  totalClaimed,
  aiPendingCount,
  dueSoonCount,
  overdueCount,
}: CaseStatStripProps) {
  return (
    <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard p-4 sm:p-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-0 lg:divide-x divide-[#09090B]/15">
        {/* Total Claims Value */}
        <div className="lg:px-5 first:pl-0 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#09090B] text-[#D2E823] shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[#52525B] truncate">
              Total claims value
            </p>
            <p className="text-base sm:text-lg font-bold font-mono text-[#09090B] mt-0.5 truncate">
              {formatCurrency(totalClaimed, 'JPY')}
            </p>
          </div>
        </div>

        {/* AI OCR Pending */}
        <div className="lg:px-5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#EDE8D5] text-[#09090B] border border-[#09090B]/20 shrink-0">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[#52525B] truncate">
              AI OCR pending
            </p>
            <p className="text-base sm:text-lg font-bold text-[#09090B] mt-0.5 truncate">
              {pluralize(aiPendingCount, 'document')}
            </p>
          </div>
        </div>

        {/* Due Soon */}
        <div className="lg:px-5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#FBBF24]/30 text-[#09090B] border border-[#09090B]/20 shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[#52525B] truncate">
              Due soon (&lt;48h)
            </p>
            <p className="text-base sm:text-lg font-bold text-[#09090B] mt-0.5 truncate">
              {pluralize(dueSoonCount, 'case')}
            </p>
          </div>
        </div>

        {/* Statutory Overdue */}
        <div className="lg:px-5 last:pr-0 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#FF334B]/20 text-[#FF334B] border border-[#FF334B]/40 shrink-0">
            <AlertOctagon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[#FF334B] truncate">
              Statutory overdue
            </p>
            <p className="text-base sm:text-lg font-bold text-[#FF334B] mt-0.5 truncate">
              {pluralize(overdueCount, 'case')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
