import type { Case, User } from '@/types/api';
import { Badge } from '@/components/ui/Badge';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Building2, Calendar, Clock } from 'lucide-react';

export interface CaseDetailHeaderProps {
  caseItem: Case;
  canWrite: boolean;
  assignable: User[];
  currentUserId?: string;
  onAssign: (operatorId: string | null) => Promise<void> | void;
}

export function CaseDetailHeader({
  caseItem,
  canWrite,
  assignable,
  currentUserId,
  onAssign,
}: CaseDetailHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-[#EDE8D5]/60 border border-[#09090B]/15">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xl font-bold tracking-tight text-[#09090B]">
            {caseItem.reference}
          </span>
          <Badge status={caseItem.status}>{caseItem.status.replace('_', ' ')}</Badge>
          <Badge deadlineState={caseItem.deadline_state}>
            {caseItem.deadline_state.replace('_', ' ')}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-[#52525B]">
          <span className="flex items-center gap-1 text-[#09090B]">
            <Building2 className="w-3.5 h-3.5" />
            {caseItem.bank_name}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            Reported {formatDate(caseItem.reported_date)}
          </span>
          {caseItem.deadline && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1 text-[#FF334B]">
                <Clock className="w-3.5 h-3.5" />
                Deadline: {formatDateTime(caseItem.deadline)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Operator Assignment */}
      <div className="flex items-center gap-2">
        <span id="case-operator-label" className="text-xs font-bold uppercase text-[#52525B]">
          Operator:
        </span>
        {canWrite ? (
          <select
            id="case-operator"
            aria-labelledby="case-operator-label"
            value={caseItem.assigned_operator?.id || ''}
            onChange={(e) => void onAssign(e.target.value || null)}
            className="text-xs font-bold bg-[#F8F4E8] border border-[#09090B]/20 rounded-lg px-2.5 py-1 focus:outline-none focus:border-[#09090B] cursor-pointer text-[#09090B]"
          >
            <option value="">Unassigned</option>
            {caseItem.assigned_operator && !assignable.some((u) => u.id === caseItem.assigned_operator?.id) && (
              <option value={caseItem.assigned_operator.id} disabled>
                {caseItem.assigned_operator.name}
              </option>
            )}
            {assignable.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === currentUserId ? `${u.name} (me)` : u.name}
              </option>
            ))}
          </select>
        ) : (
          <span id="case-operator" className="text-xs font-bold text-[#09090B]">
            {caseItem.assigned_operator?.name ?? 'Unassigned'}
          </span>
        )}
      </div>
    </div>
  );
}
