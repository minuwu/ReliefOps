import { Building2, BrainCircuit, ChevronRight } from 'lucide-react';
import type { CaseSummary } from '@/types/api';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils';

export interface CaseTableProps {
  cases: CaseSummary[];
  focusedIndex: number;
  onSelectCase: (caseItem: CaseSummary, index: number) => void;
}

export function CaseTable({ cases, focusedIndex, onSelectCase }: CaseTableProps) {
  return (
    <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#09090B]/15 bg-[#EDE8D5]/60 text-xs font-bold uppercase tracking-wider text-[#52525B]">
              <th scope="col" className="whitespace-nowrap py-3.5 px-4">Case reference</th>
              <th scope="col" className="whitespace-nowrap py-3.5 px-4">Bank</th>
              <th scope="col" className="whitespace-nowrap py-3.5 px-4">Victim</th>
              <th scope="col" className="whitespace-nowrap py-3.5 px-4">Claim amount</th>
              <th scope="col" className="whitespace-nowrap py-3.5 px-4">Statutory stage</th>
              <th scope="col" className="whitespace-nowrap py-3.5 px-4">Statutory clock</th>
              <th scope="col" className="whitespace-nowrap py-3.5 px-4">Flags</th>
              <th scope="col" className="whitespace-nowrap py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#09090B]/10 text-xs">
            {cases.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[#52525B]">
                  <p className="font-bold text-sm uppercase text-[#09090B]">No matching claims</p>
                  <p className="text-xs text-[#52525B] mt-1">
                    Adjust search terms or reset filters
                  </p>
                </td>
              </tr>
            ) : (
              cases.map((caseItem, idx) => {
                const isFocused = idx === focusedIndex;
                return (
                  <tr
                    key={caseItem.id}
                    onClick={() => onSelectCase(caseItem, idx)}
                    className={`hover:bg-[#EDE8D5]/80 transition-colors cursor-pointer group ${
                      isFocused ? 'bg-[#EDE8D5] border-l-4 border-l-[#D2E823]' : ''
                    }`}
                  >
                    {/* Case Number */}
                    <td className="py-3 px-4 font-mono font-bold text-[#09090B]">
                      <span className="inline-flex items-center gap-1.5">
                        {isFocused && (
                          <span className="text-[#09090B] font-black text-xs" aria-hidden="true">
                            ▶
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-[#EDE8D5] text-[#09090B] border border-[#09090B]/20">
                          {caseItem.reference}
                        </span>
                      </span>
                    </td>

                    {/* Bank */}
                    <td className="py-3 px-4 font-mono font-bold uppercase text-[#09090B]">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#52525B]" />
                        {caseItem.bank_id}
                      </span>
                    </td>

                    {/* Victim */}
                    <td className="py-3 px-4 font-medium text-[#09090B] uppercase">
                      {caseItem.victim_name}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 font-mono font-bold text-[#09090B]">
                      {formatCurrency(caseItem.amount || 0, 'JPY')}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <Badge status={caseItem.status}>{caseItem.status.replace('_', ' ')}</Badge>
                    </td>

                    {/* Deadline */}
                    <td className="py-3 px-4">
                      <Badge deadlineState={caseItem.deadline_state}>
                        {caseItem.deadline_state.replace('_', ' ')}
                      </Badge>
                    </td>

                    {/* Flags */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {caseItem.flags.ai_review_pending && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-[#D2E823] text-[#09090B] border border-[#09090B]/30">
                            <BrainCircuit className="w-3 h-3" /> OCR pending
                          </span>
                        )}
                        {caseItem.flags.shared_account_case_count > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-[#FF334B]/20 text-[#FF334B] border border-[#FF334B]/40">
                            Syndicate ({caseItem.flags.shared_account_case_count})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 font-bold text-xs text-[#09090B] group-hover:underline">
                        Inspect <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
