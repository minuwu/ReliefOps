import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { AuditEntry } from '@/types/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import { User, Bot, Globe, Shield, RefreshCw } from 'lucide-react';

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadLogs() {
    setIsLoading(true);
    try {
      const res = await api.getAuditLogs();
      setLogs(res.data.items);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

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

      {/* Ledger Table Panel */}
      <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#09090B]/10 text-xs uppercase text-[#52525B] font-bold">
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
      </div>
    </div>
  );
}
