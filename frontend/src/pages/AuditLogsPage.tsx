import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { AuditEntry } from '@/types/api';
import { GlitchText } from '@/components/ui/GlitchText';
import { StickerBadge } from '@/components/ui/StickerBadge';
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
      setLogs(res.data);
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
        return <User className="w-4 h-4 text-[#09090B]" />;
      case 'ai':
        return <Bot className="w-4 h-4 text-[#2563EB]" />;
      case 'victim':
        return <Shield className="w-4 h-4 text-[#16A34A]" />;
      default:
        return <Globe className="w-4 h-4 text-[#52525B]" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 font-['Space_Grotesk',sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#09090B] pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <GlitchText as="h1" className="text-xl sm:text-3xl font-['Dela_Gothic_One'] text-[#09090B] break-words">
              REGULATORY AUDIT LEDGER
            </GlitchText>
            <StickerBadge variant="acid" rotate="rotate-1" className="text-xs">
              IMMUTABLE HASH CHAIN
            </StickerBadge>
          </div>
          <p className="text-xs sm:text-sm font-medium text-[#52525B] mt-1">
            Cryptographically sealed log of every operator triage decision, AI model output, and inter-bank freeze broadcast.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadLogs} isLoading={isLoading} className="gap-2 shadow-hard-sm self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5" /> REFRESH LEDGER
        </Button>
      </div>

      {/* Ledger Table */}
      <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-[#09090B] bg-[#09090B] text-[#D2E823] font-bold uppercase tracking-wider">
                <th scope="col" className="whitespace-nowrap py-3.5 px-4 font-mono">Timestamp</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Actor</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Action Type</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Case Reference</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Operational Summary</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4 font-mono">Payload / Diffs</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#09090B] font-medium text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#52525B] font-mono">
                    <p className="font-['Dela_Gothic_One'] text-base uppercase text-[#09090B]">VERIFYING CRYPTOGRAPHIC BLOCKS...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#52525B] font-mono">
                    <p className="font-['Dela_Gothic_One'] text-base uppercase text-[#09090B]">LEDGER EMPTY</p>
                  </td>
                </tr>
              ) : (
                logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#EDE8D5] transition-colors">
                    <td className="py-3 px-4 font-mono text-[#52525B] whitespace-nowrap">
                      {formatDateTime(entry.at)}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 font-bold text-[#09090B]">
                        {getActorIcon(entry.actor.type)}
                        <span className="whitespace-nowrap uppercase">{entry.actor.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#52525B] uppercase block">
                        {entry.actor.role || entry.actor.type}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-[#09090B] text-[#D2E823] font-mono font-bold text-[11px] border border-[#09090B]">
                        {entry.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-[#09090B] whitespace-nowrap">
                      {entry.case_reference || '—'}
                    </td>

                    <td className="py-3 px-4 text-[#09090B] font-bold min-w-[16rem]">
                      {entry.summary}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] max-w-xs truncate text-[#52525B]">
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
