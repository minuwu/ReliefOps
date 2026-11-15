import { CaseSummary } from '@/types/api';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils';

interface UrgentCasesListProps {
  cases: CaseSummary[];
  onSelectCase: (caseItem: CaseSummary) => void;
}

export function UrgentCasesList({ cases, onSelectCase }: UrgentCasesListProps) {
  const allUrgentCases = cases
    .filter(
      (c) =>
        c.deadline_state === 'overdue' ||
        c.deadline_state === 'due_soon' ||
        (c.amount || 0) >= 3000000
    )
    .sort((a, b) => {
      const priority = (c: CaseSummary) => {
        if (c.deadline_state === 'overdue') return 3;
        if (c.deadline_state === 'due_soon') return 2;
        return 1;
      };
      const diff = priority(b) - priority(a);
      if (diff !== 0) return diff;
      return (b.amount || 0) - (a.amount || 0);
    });

  const totalUrgentCount = allUrgentCases.length;
  const urgentCases = allUrgentCases.slice(0, 5);

  if (totalUrgentCount === 0) {
    return (
      <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard p-4 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#09090B]">
          Needs attention (0)
        </h2>
        <p className="text-sm text-[#52525B] mt-3">No urgent cases.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#09090B]">
          Needs attention ({totalUrgentCount})
        </h2>
        <span className="text-xs font-mono text-[#52525B]">
          {urgentCases.length < totalUrgentCount
            ? `Top ${urgentCases.length} of ${totalUrgentCount}`
            : `${totalUrgentCount} ${totalUrgentCount === 1 ? 'case' : 'cases'}`}
        </span>
      </div>

      <div className="space-y-2">
        {urgentCases.map((caseItem) => (
          <button
            key={caseItem.id}
            type="button"
            onClick={() => onSelectCase(caseItem)}
            className="w-full text-left p-3 rounded-lg border border-[#09090B]/15 hover:bg-[#09090B]/5 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
          >
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#09090B] text-[#D2E823]">
                {caseItem.reference}
              </span>
              <span className="text-sm font-medium text-[#09090B] truncate">
                {caseItem.victim_name}
              </span>
              <span className="text-xs text-[#52525B] uppercase">
                {caseItem.bank_name || caseItem.bank_id}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
              <Badge status={caseItem.status}>
                {caseItem.status.replace('_', ' ')}
              </Badge>
              {caseItem.deadline_state === 'overdue' || caseItem.deadline_state === 'due_soon' ? (
                <Badge deadlineState={caseItem.deadline_state}>
                  {caseItem.deadline_state.replace('_', ' ')}
                </Badge>
              ) : null}
              <span className="font-mono text-xs font-bold text-[#09090B]">
                {formatCurrency(caseItem.amount || 0, 'JPY')}
              </span>
              <span className="text-xs text-[#52525B]">
                Reported <span className="font-mono">{formatDate(caseItem.reported_date)}</span>
              </span>
              {caseItem.deadline && (
                <span className="text-xs text-[#52525B]">
                  Due <span className="font-mono">{formatDate(caseItem.deadline)}</span>
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
