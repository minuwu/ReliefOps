import { AlertTriangle, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export function PendingBanner() {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl border border-[#FF334B]/40 bg-[#FF334B]/15 p-3 text-[#09090B]"
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-[#FF334B]" aria-hidden="true" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide">
            Victim response pending
          </p>
          <p className="text-xs text-[#52525B]">
            This thread has a question requiring human staff attention.
          </p>
        </div>
      </div>
      <Badge variant="destructive" className="shrink-0 text-xs">
        Action required
      </Badge>
    </div>
  );
}

export function ReadOnlyNotice() {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/40 p-3 text-xs text-[#52525B]">
      <Lock className="h-4 w-4 shrink-0 text-[#52525B]" aria-hidden="true" />
      <span>Read-only view. Only operators and supervisors can post replies to victims.</span>
    </div>
  );
}
