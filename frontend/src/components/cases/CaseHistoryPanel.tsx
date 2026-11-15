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
    <div className="space-y-4 font-['Space_Grotesk',sans-serif]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#09090B]/15 pb-2.5">
        <div>
          <h3 className="text-sm font-bold text-[#09090B]">
            Audit history
          </h3>
          <p className="mt-0.5 text-xs text-[#52525B]">
            Chronological audit log for this case.
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
        <div className="py-8 text-center space-y-2">
          <RotateCw className="w-5 h-5 animate-spin mx-auto text-[#09090B]" />
          <p className="text-xs font-semibold text-[#09090B]">
            Loading case history…
          </p>
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-xl border border-[#FF334B]/30 bg-[#FFF1F2] p-3.5 text-[#991B1B] space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold">Could not load the history</span>
          </div>
          <p className="text-xs font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchHistory(page)}
          >
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !error && history.length === 0 && (
        <div className="py-8 text-center space-y-2 rounded-xl border border-dashed border-[#09090B]/20 bg-[#EDE8D5]/30">
          <History className="w-6 h-6 mx-auto text-[#52525B]" />
          <p className="text-xs font-semibold text-[#09090B]">
            No audit records
          </p>
          <p className="text-xs text-[#52525B]">
            No history recorded for this case yet.
          </p>
        </div>
      )}

      {history.length > 0 && (
        <ol className="space-y-3.5" aria-label="Case history entries">
          {history.map((entry, idx) => (
            <li key={entry.id} className="relative pl-6">
              {/* Connector: from this dot's centre to the next dot's centre (top-5 = 20px; gap 14px + 20px). */}
              {idx < history.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-[7px] top-5 -bottom-[34px] w-0.5 bg-[#09090B]/20"
                />
              )}
              <span
                aria-hidden="true"
                className="absolute left-0 top-3 w-4 h-4 rounded-full bg-[#D2E823] border border-[#09090B] flex items-center justify-center"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#09090B]" />
              </span>

              <div className="rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/30 p-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#09090B]/10 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#09090B]">
                      {entry.actor.name || 'System'}
                    </span>
                    <Badge
                      variant={getRoleBadgeVariant(entry.actor.role, entry.actor.type)}
                      className="text-xs px-1.5 py-0"
                    >
                      {formatRoleLabel(entry.actor.role, entry.actor.type)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#52525B] font-mono">
                    <Clock className="w-3 h-3 shrink-0" />
                    <time dateTime={entry.at}>{formatTimestamp(entry.at)}</time>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block rounded bg-[#EDE8D5] px-2 py-0.5 font-mono text-xs font-bold text-[#09090B] border border-[#09090B]/20">
                    {entry.action}
                  </span>
                  <p className="text-xs text-[#09090B] font-medium">
                    {entry.summary}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#09090B]/15 text-xs">
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
            <span className="px-2 py-0.5 font-bold text-xs bg-[#EDE8D5] rounded border border-[#09090B]/20">
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
