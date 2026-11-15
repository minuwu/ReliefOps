import { SharedAccountAlert } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface SharedAccountsListProps {
  alerts: SharedAccountAlert[];
  onInspectCase?: (caseId: string) => void;
}

export function SharedAccountsList({ alerts, onInspectCase }: SharedAccountsListProps) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard p-4 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#09090B]">
          Shared beneficiary accounts
        </h2>
        <p className="text-sm text-[#52525B] mt-3">No shared beneficiary account alerts.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#09090B]">
            Shared beneficiary accounts
          </h2>
          <p className="text-xs text-[#52525B] mt-0.5">
            Accounts flagged across multiple claims in fraudulent transfers.
          </p>
        </div>
        <span className="text-xs font-mono text-[#52525B]">
          {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
        </span>
      </div>

      <div className="divide-y divide-[#09090B]/10">
        {alerts.map((alert) => (
          <div
            key={`${alert.bank_id}:${alert.account_number}`}
            className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-[#09090B]">
                  {alert.account_number}
                </span>
                <span className="text-xs font-medium text-[#52525B] uppercase">
                  {alert.bank_name || alert.bank_id}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#09090B]/5 text-[#09090B]">
                  {alert.case_count} linked {alert.case_count === 1 ? 'case' : 'cases'}
                </span>
              </div>

              {alert.cases.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs text-[#52525B]">Cases:</span>
                  {alert.cases.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onInspectCase?.(c.id)}
                      className="px-1.5 py-0.5 rounded text-xs font-mono font-medium border border-[#09090B]/15 bg-white/70 hover:bg-[#D2E823] transition-colors cursor-pointer"
                    >
                      {c.reference}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
              <span className="font-mono text-xs font-bold text-[#09090B]">
                {formatCurrency(alert.total_amount, 'JPY')}
              </span>
              {alert.cases.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onInspectCase?.(alert.cases[0].id)}
                  className="gap-1.5"
                >
                  <span>Inspect</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
