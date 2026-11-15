import { CaseStatus } from '@/types/api';
import { Badge } from '@/components/ui/Badge';

interface CasesByStatusProps {
  casesByStatus: Record<CaseStatus, number>;
  onSelectStatus?: (status: CaseStatus) => void;
}

const STATUS_ITEMS: { key: CaseStatus; label: string }[] = [
  { key: 'received', label: 'Received' },
  { key: 'verified', label: 'Verified' },
  { key: 'account_check', label: 'Account check' },
  { key: 'notice_published', label: 'Notice pub' },
  { key: 'payout_review', label: 'Payout review' },
  { key: 'closed', label: 'Closed' },
];

export function CasesByStatus({ casesByStatus, onSelectStatus }: CasesByStatusProps) {
  return (
    <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard p-4 sm:p-6">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#09090B] mb-4">
        Cases by status
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATUS_ITEMS.map(({ key, label }) => {
          const count = casesByStatus[key] ?? 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectStatus?.(key)}
              className="flex items-center justify-between sm:flex-col sm:items-start p-2.5 rounded-lg border border-[#09090B]/15 hover:bg-[#09090B]/5 transition-colors cursor-pointer text-left"
            >
              <Badge status={key}>{label}</Badge>
              <span className="font-mono text-base font-bold text-[#09090B] mt-0 sm:mt-2">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
