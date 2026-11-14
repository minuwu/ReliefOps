import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { AuditEntry } from '@/types/api';
import { formatDateTime } from '@/lib/utils';
import { History, User, Bot, Globe, Shield } from 'lucide-react';

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      setIsLoading(true);
      try {
        const res = await api.getAuditLogs();
        setLogs(res.data);
      } finally {
        setIsLoading(false);
      }
    }
    loadLogs();
  }, []);

  const getActorIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="w-3.5 h-3.5 text-primary" />;
      case 'ai':
        return <Bot className="w-3.5 h-3.5 text-blue-500" />;
      case 'victim':
        return <Shield className="w-3.5 h-3.5 text-teal-600" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <History className="w-6 h-6 text-primary" />
          Regulatory & Operations Audit Trail
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Immutable log of all case actions, status transitions, AI extractions, and victim interactions
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Case Reference</th>
                <th className="py-3 px-4">Operational Summary</th>
                <th className="py-3 px-4">Audit Metadata / Diffs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Loading audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground italic">
                    No audit records logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                      {formatDateTime(entry.at)}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        {getActorIcon(entry.actor.type)}
                        <span>{entry.actor.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {entry.actor.role || entry.actor.type}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-primary">
                      {entry.action}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-foreground">
                      {entry.case_reference || '—'}
                    </td>

                    <td className="py-3 px-4 text-foreground/90 font-medium">
                      {entry.summary}
                    </td>

                    <td className="py-3 px-4 text-[11px] font-mono text-muted-foreground">
                      {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
