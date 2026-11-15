import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  History,
  RotateCw,
} from 'lucide-react';
import type { AuditEntry } from '@/types/api';
import { historyApi } from '@/services/historyApi';
import { errorMessage } from '@/services/http';
import { useToastStore } from '@/store/useToastStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

const PAGE_SIZE = 10;

const gbDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    return Number.isNaN(d.getTime()) ? isoString : gbDateFormatter.format(d);
  } catch {
    return isoString;
  }
}

function getRoleBadgeVariant(
  role: string | null,
  type: string
): 'acid' | 'info' | 'warning' | 'secondary' | 'outline' {
  if (role === 'supervisor') return 'acid';
  if (role === 'operator') return 'info';
  if (role === 'bank_viewer') return 'warning';
  if (role === 'victim' || type === 'victim') return 'secondary';
  return 'outline';
}

function formatRoleLabel(role: string | null, type: string): string {
  if (role) return role.replace(/_/g, ' ');
  return type;
}

interface CaseHistoryPanelProps {
  caseId: string;
}

export function CaseHistoryPanel({ caseId }: CaseHistoryPanelProps) {
  const pushToast = useToastStore((s) => s.push);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(
    async (targetPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await historyApi.getCaseHistory(caseId, {
          page: targetPage,
          page_size: PAGE_SIZE,
        });
        setHistory(res.data.items);
        setPage(res.data.page);
        setTotal(res.data.total);
      } catch (err) {
        setError(errorMessage(err, 'Failed to load case history.'));
      } finally {
        setIsLoading(false);
      }
    },
    [caseId]
  );

  useEffect(() => {
    void fetchHistory(1);
  }, [fetchHistory]);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const { blob, filename } = await historyApi.downloadCaseHistoryCsv(caseId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      pushToast(`Exported ${filename}`, 'success');
    } catch (err) {
      pushToast(errorMessage(err, 'Failed to export CSV.'), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-5 sm:p-6 shadow-hard space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#09090B] pb-4">
        <div>
          <h2 className="text-xs font-['Dela_Gothic_One'] uppercase tracking-wider text-[#09090B]">
            Case Audit History
          </h2>
          <p className="mt-1 text-xs text-[#52525B] font-['Space_Grotesk',sans-serif]">
            Immutable chronological audit log for this case.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          isLoading={isExporting}
          disabled={isLoading || total === 0}
          aria-label="Export case history to CSV"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {isLoading && history.length === 0 && (
        <div className="py-12 text-center space-y-3">
          <RotateCw className="w-6 h-6 animate-spin mx-auto text-[#09090B]" />
          <p className="text-xs font-bold uppercase tracking-wider text-[#09090B]">
            Loading case history...
          </p>
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-xl border-2 border-[#FF334B] bg-[#FFF1F2] p-4 text-[#991B1B] space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Error</span>
          </div>
          <p className="text-xs font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchHistory(page)}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && history.length === 0 && (
        <div className="py-12 text-center space-y-2 rounded-xl border-2 border-dashed border-[#09090B]/30 bg-[#FFFDF5]">
          <History className="w-8 h-8 mx-auto text-[#71717A]" />
          <p className="text-xs font-bold uppercase tracking-wider text-[#09090B]">
            No Audit Records
          </p>
          <p className="text-xs text-[#52525B]">
            No history recorded for this case yet.
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#09090B]">
          {history.map((entry) => (
            <div key={entry.id} className="relative group">
              <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-[#D2E823] border-2 border-[#09090B] flex items-center justify-center shadow-[1px_1px_0px_0px_#09090B]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#09090B]" />
              </div>

              <div className="rounded-xl border-2 border-[#09090B] bg-[#FFFDF5] p-3.5 shadow-[2px_2px_0px_0px_#09090B] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#09090B]/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#09090B] font-['Space_Grotesk',sans-serif]">
                      {entry.actor.name || 'System'}
                    </span>
                    <Badge
                      variant={getRoleBadgeVariant(entry.actor.role, entry.actor.type)}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {formatRoleLabel(entry.actor.role, entry.actor.type)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#52525B] font-mono">
                    <Clock className="w-3 h-3 shrink-0" />
                    <time dateTime={entry.at}>{formatTimestamp(entry.at)}</time>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block rounded bg-[#EDE8D5] px-2 py-0.5 font-mono text-[11px] font-bold text-[#09090B] border border-[#09090B]/30">
                    {entry.action}
                  </span>
                  <p className="text-xs text-[#09090B] font-medium font-['Space_Grotesk',sans-serif]">
                    {entry.summary}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t-2 border-[#09090B] text-xs font-['Space_Grotesk',sans-serif]">
          <div className="text-[#52525B]">
            Showing <span className="font-bold text-[#09090B]">{startItem}</span>–
            <span className="font-bold text-[#09090B]">{endItem}</span> of{' '}
            <span className="font-bold text-[#09090B]">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchHistory(page - 1)}
              disabled={page <= 1 || isLoading}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Prev
            </Button>
            <span className="px-2.5 py-1 font-bold text-xs bg-[#EDE8D5] rounded-md border-2 border-[#09090B] shadow-[1px_1px_0px_0px_#09090B]">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchHistory(page + 1)}
              disabled={page >= totalPages || isLoading}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
