import type { Case } from '@/types/api';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export interface CaseFactsOverviewProps {
  caseItem: Case;
}

export function CaseFactsOverview({ caseItem }: CaseFactsOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Victim Information */}
      <div className="p-4 rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/30 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#09090B] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#09090B]" />
          Victim details
        </h3>
        <dl className="divide-y divide-[#09090B]/10 text-xs">
          <div className="flex justify-between py-2">
            <dt className="text-xs text-[#52525B]">Full name</dt>
            <dd className="text-sm font-medium text-[#09090B] uppercase">{caseItem.victim.name}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-xs text-[#52525B]">Phone</dt>
            <dd className="text-sm font-mono text-[#09090B]">{caseItem.victim.phone || '—'}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-xs text-[#52525B]">Email</dt>
            <dd className="text-sm font-mono text-[#09090B]">{caseItem.victim.email || '—'}</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-xs text-[#52525B]">Address</dt>
            <dd className="text-sm font-medium text-[#09090B] text-right">{caseItem.victim.address || '—'}</dd>
          </div>
          <div className="flex justify-between py-2 items-center">
            <dt className="text-xs text-[#52525B]">Preferred language</dt>
            <dd className="text-sm">
              <Badge variant="outline" className="uppercase font-mono text-xs">
                {caseItem.victim.preferred_language}
              </Badge>
            </dd>
          </div>
        </dl>
      </div>

      {/* Fraud Financial Facts */}
      <div className="p-4 rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/30 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#09090B] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#FF334B]" />
          Financial facts
        </h3>
        <dl className="divide-y divide-[#09090B]/10 text-xs">
          <div className="flex justify-between py-2 items-center">
            <dt className="text-xs text-[#52525B]">Amount lost</dt>
            <dd className="text-sm font-bold font-mono text-[#09090B]">
              {formatCurrency(caseItem.amount, caseItem.currency)}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-xs text-[#52525B]">Wire date</dt>
            <dd className="text-sm font-mono text-[#09090B]">
              {caseItem.transfer_date ? formatDate(caseItem.transfer_date) : '—'}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-xs text-[#52525B]">Suspect account</dt>
            <dd className="text-sm font-mono font-bold text-[#FF334B]">
              {caseItem.account_number || '—'}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-xs text-[#52525B]">Mule holder name</dt>
            <dd className="text-sm font-bold uppercase text-[#09090B]">
              {caseItem.account_holder_name || '—'}
            </dd>
          </div>
          <div className="flex justify-between py-2 items-center">
            <dt className="text-xs text-[#52525B]">Scam typology</dt>
            <dd className="text-sm">
              <Badge variant="acid" className="uppercase">
                {caseItem.scam_type || 'Unclassified'}
              </Badge>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
