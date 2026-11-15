import { DashboardStats, DeadlineState } from '@/types/api';
import { formatCurrency, cn } from '@/lib/utils';

interface StatStripProps {
  stats: DashboardStats;
  totalClaimedJPY: number;
  onNavigateToCases?: (filter?: DeadlineState) => void;
  onNavigateToReview?: () => void;
}

export function StatStrip({
  stats,
  totalClaimedJPY,
  onNavigateToCases,
  onNavigateToReview,
}: StatStripProps) {
  return (
    <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard p-4 sm:p-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-0 lg:divide-x lg:divide-[#09090B]/15">
        <button
          type="button"
          onClick={() => onNavigateToCases?.()}
          className="text-left px-2 sm:px-4 py-2 hover:bg-[#09090B]/5 rounded-lg transition-colors cursor-pointer"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[#52525B]">Open cases</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold tabular-nums text-[#09090B] mt-1">
            {stats.open_cases}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateToCases?.('overdue')}
          className="text-left px-2 sm:px-4 py-2 hover:bg-[#09090B]/5 rounded-lg transition-colors cursor-pointer"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[#52525B]">Overdue</p>
          <p
            className={cn(
              "text-2xl sm:text-3xl font-mono font-bold tabular-nums mt-1",
              stats.overdue_cases > 0 ? 'text-[#FF334B]' : 'text-[#09090B]'
            )}
          >
            {stats.overdue_cases}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateToCases?.('due_soon')}
          className="text-left px-2 sm:px-4 py-2 hover:bg-[#09090B]/5 rounded-lg transition-colors cursor-pointer"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[#52525B]">Due within 48h</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold tabular-nums text-[#09090B] mt-1">
            {stats.due_soon_cases}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateToReview?.()}
          className="text-left px-2 sm:px-4 py-2 hover:bg-[#09090B]/5 rounded-lg transition-colors cursor-pointer"
        >
          <p className="text-xs font-bold uppercase tracking-wide text-[#52525B]">Awaiting review</p>
          <p className="text-2xl sm:text-3xl font-mono font-bold tabular-nums text-[#09090B] mt-1">
            {stats.ai_review_pending}
          </p>
        </button>

        <div className="px-2 sm:px-4 py-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[#52525B]">Total claimed</p>
          <p className="text-xl sm:text-2xl font-mono font-bold text-[#09090B] mt-1 truncate">
            {formatCurrency(totalClaimedJPY, 'JPY')}
          </p>
        </div>
      </div>
    </div>
  );
}
