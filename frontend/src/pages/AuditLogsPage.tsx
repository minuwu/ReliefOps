import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { errorMessage } from '@/services/http';
import { AuditEntry } from '@/types/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn, formatDateTime } from '@/lib/utils';
import { User, Bot, Globe, Shield, RefreshCw } from 'lucide-react';

const PAGE_SIZE = 10;

const ACTION_FILTERS: { label: string; value: string }[] = [
  { label: 'All actions', value: 'all' },
  { label: 'Status changes', value: 'case.status_changed' },
  { label: 'AI extractions', value: 'ai.extraction_completed' },
  { label: 'Chat escalations', value: 'chat.escalated' },
  { label: 'Case creations', value: 'case.created' },
];

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadLogs() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.getAuditLogs({
        page,
        page_size: PAGE_SIZE,
        action: actionFilter === 'all' ? undefined : (actionFilter as AuditEntry['action']),
      });
      setLogs(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      setLoadError(errorMessage(err, 'We could not load the audit logs. Check your connection and try again.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, [page, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const getActorIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="w-3.5 h-3.5 text-[#09090B]" />;
      case 'ai':
        return <Bot className="w-3.5 h-3.5 text-[#2563EB]" />;
      case 'victim':
        return <Shield className="w-3.5 h-3.5 text-[#16A34A]" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-[#52525B]" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 font-['Space_Grotesk',sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#09090B] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-['Dela_Gothic_One'] text-[#09090B]">
            Audit log
          </h1>
          <p className="text-sm text-[#52525B] mt-1">
            Every action taken on a case, newest first.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadLogs}
          isLoading={isLoading}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> REFRESH LOG
        </Button>
      </div>

      {/* Error banner */}
      {loadError && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[#FF334B]/30 bg-[#FF334B]/10 text-xs text-[#09090B]"
        >
          <span className="font-bold text-[#FF334B]">{loadError}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadLogs}
            className="self-start sm:self-auto shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {ACTION_FILTERS.map((f) => {
            const isActive = actionFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  if (actionFilter !== f.value) {
                    setActionFilter(f.value);
                    setPage(1);
                  }
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap border',
                  isActive
                    ? 'border-[#09090B] bg-[#09090B] text-[#D2E823]'
                    : 'border-[#09090B]/20 bg-transparent text-[#09090B] hover:bg-[#EDE8D5]'
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <label htmlFor="audit-action-select" className="sr-only">
            Filter by action
          </label>
          <select
            id="audit-action-select"
            aria-label="Filter by action"
            value={actionFilter}
            onChange={(e) => {
              if (actionFilter !== e.target.value) {
                setActionFilter(e.target.value);
                setPage(1);
              }
            }}
            className="text-xs bg-[#EDE8D5]/40 border border-[#09090B]/20 rounded-xl px-3 py-1.5 font-bold uppercase cursor-pointer text-[#09090B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B]"
          >
            {ACTION_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ledger Table Panel */}
      <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#09090B]/10 text-xs font-bold uppercase tracking-wide text-[#52525B] bg-transparent">
                <th scope="col" className="whitespace-nowrap py-3.5 px-4 font-mono">Timestamp</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Actor</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Action</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4 font-mono">Case</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Summary</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4 font-mono">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#09090B]/10 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-[#52525B]">
                    Loading audit log…
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-[#52525B]">
                    No audit events recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#EDE8D5]/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-[#52525B] whitespace-nowrap">
                      {formatDateTime(entry.at)}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 font-bold text-[#09090B]">
                        {getActorIcon(entry.actor.type)}
                        <span>{entry.actor.name}</span>
                      </div>
                      <span className="text-xs text-[#52525B]">
                        {entry.actor.role || entry.actor.type}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge variant="outline" className="font-mono text-xs">
                        {entry.action}
                      </Badge>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-[#09090B] whitespace-nowrap">
                      {entry.case_reference || '—'}
                    </td>

                    <td className="py-3 px-4 text-[#09090B] min-w-[16rem]">
                      {entry.summary}
                    </td>

                    <td className="py-3 px-4 font-mono text-xs max-w-xs truncate text-[#52525B]">
                      {entry.changes || entry.metadata
                        ? JSON.stringify(entry.changes || entry.metadata)
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-t border-[#09090B]/10 bg-[#EDE8D5]/30 text-xs">
          <span className="font-medium text-[#52525B]">
            Page {page} of {totalPages} · {total} entries
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
