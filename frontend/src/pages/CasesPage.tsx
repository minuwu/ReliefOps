import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCaseStore } from '@/store/useCaseStore';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { CaseSummary } from '@/types/api';
import { CaseDetailModal } from '@/components/cases/CaseDetailModal';
import { CaseIntakeModal } from '@/components/cases/CaseIntakeModal';
import { PATHS } from '@/routes/paths';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GlitchText } from '@/components/ui/GlitchText';
import { StickerBadge } from '@/components/ui/StickerBadge';
import { DEMO_BANKS } from '@/services/mockData';
import { formatCurrency, pluralize } from '@/lib/utils';
import {
  Search,
  Building2,
  BrainCircuit,
  ChevronRight,
  PlusCircle,
  RefreshCw,
  TrendingUp,
  Clock,
  AlertOctagon,
  ArrowUpDown,
  Keyboard,
} from 'lucide-react';

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'ALL CLAIMS', value: '' },
  { label: '1. RECEIVED', value: 'received' },
  { label: '2. VERIFIED', value: 'verified' },
  { label: '3. ACCOUNT CHECK', value: 'account_check' },
  { label: '4. NOTICE PUB', value: 'notice_published' },
  { label: '5. PAYOUT REV', value: 'payout_review' },
  { label: '6. CLOSED', value: 'closed' },
];

export function CasesPage() {
  const { user } = useAuthStore();
  const { cases, filters, setFilters, fetchCases, fetchCaseById, clearSelected, selectedCase, isLoading } =
    useCaseStore();
  const navigate = useNavigate();
  // The open case lives in the URL (/cases/:caseId), so it can be linked and survives a reload.
  const { caseId } = useParams<{ caseId?: string }>();
  const isDetailOpen = Boolean(caseId);
  const canCreate = user?.role === 'operator' || user?.role === 'supervisor';

  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [sortBy, setSortBy] = useState<'deadline' | 'amount_desc' | 'amount_asc' | 'created_desc'>('deadline');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCases();
  }, []);

  useEffect(() => {
    if (!caseId) {
      clearSelected();
      return;
    }
    let cancelled = false;
    void fetchCaseById(caseId).then((loaded) => {
      if (cancelled || loaded) return;
      toast('That case does not exist or you cannot open it.', 'error');
      navigate(PATHS.cases, { replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const handleSelectCase = (caseSummary: CaseSummary) => {
    navigate(PATHS.caseDetail(caseSummary.id));
  };

  const totalClaimed = cases.reduce((acc, c) => acc + (c.amount || 0), 0);
  const overdueCount = cases.filter((c) => c.deadline_state === 'overdue').length;
  const dueSoonCount = cases.filter((c) => c.deadline_state === 'due_soon').length;
  const aiPendingCount = cases.filter((c) => c.flags.ai_review_pending).length;

  const sortedCases = [...cases].sort((a, b) => {
    if (sortBy === 'amount_desc') return (b.amount || 0) - (a.amount || 0);
    if (sortBy === 'amount_asc') return (a.amount || 0) - (b.amount || 0);
    if (sortBy === 'created_desc') return new Date(b.reported_date).getTime() - new Date(a.reported_date).getTime();
    const deadlineWeight = (c: CaseSummary) => {
      if (c.deadline_state === 'overdue') return 0;
      if (c.deadline_state === 'due_soon') return 1;
      return 2;
    };
    const diff = deadlineWeight(a) - deadlineWeight(b);
    if (diff !== 0) return diff;
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    return 0;
  });

  // High-Velocity Keyboard Navigation: J/K, Enter, Space, Slash
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDetailOpen || isIntakeOpen) return;
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT';

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (isInput) {
        if (e.key === 'Escape') {
          searchInputRef.current?.blur();
        }
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, Math.max(sortedCases.length - 1, 0)));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (sortedCases[focusedIndex]) {
          handleSelectCase(sortedCases[focusedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sortedCases, focusedIndex, isDetailOpen, isIntakeOpen]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 font-['Space_Grotesk',sans-serif]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#09090B] pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <GlitchText as="h1" className="text-xl sm:text-3xl font-['Dela_Gothic_One'] text-[#09090B] break-words">
              CASE OPERATIONS ROSTER
            </GlitchText>
            <StickerBadge variant="acid" rotate="rotate-1" className="text-xs">
              5-BANK ALLIANCE
            </StickerBadge>
          </div>
          <p className="text-xs sm:text-sm font-medium text-[#52525B] mt-1">
            Real-time multi-bank claim triage and statutory milestone progression under Japan Law No. 133
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button variant="outline" size="sm" onClick={() => fetchCases()} isLoading={isLoading} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> REFRESH
          </Button>
          {canCreate && (
            <Button variant="primary" size="sm" onClick={() => setIsIntakeOpen(true)} className="gap-1.5">
              <PlusCircle className="w-4 h-4" /> NEW CASE INTAKE
            </Button>
          )}
        </div>
      </div>

      {/* Telemetry Summary Bar */}
      <div className="grid grid-cols-1 min-[450px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Claims */}
        <div className="p-4 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard flex items-center gap-4 bg-dot-pattern">
          <div className="p-2.5 rounded-xl bg-[#09090B] text-[#D2E823] border border-[#09090B]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#52525B]">TOTAL CLAIMS VALUE</p>
            <p className="text-lg sm:text-xl font-['Dela_Gothic_One'] text-[#09090B] tracking-tight">
              {formatCurrency(totalClaimed, 'JPY')}
            </p>
          </div>
        </div>

        {/* AI OCR Pending */}
        <div className="p-4 rounded-2xl border-2 border-[#09090B] bg-[#D2E823] text-[#09090B] shadow-hard flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-[#09090B] text-[#D2E823] border border-[#09090B]">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#09090B]">AI OCR PENDING</p>
            <p className="text-lg sm:text-xl font-['Dela_Gothic_One'] text-[#09090B]">
              {pluralize(aiPendingCount, 'document')}
            </p>
          </div>
        </div>

        {/* Due Soon */}
        <div className="p-4 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard flex items-center gap-4 bg-dot-pattern">
          <div className="p-2.5 rounded-xl bg-[#FBBF24] text-[#09090B] border border-[#09090B]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#52525B]">DUE SOON (&lt;48H)</p>
            <p className="text-lg sm:text-xl font-['Dela_Gothic_One'] text-[#09090B]">
              {pluralize(dueSoonCount, 'case')}
            </p>
          </div>
        </div>

        {/* Overdue */}
        <div className="p-4 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard flex items-center gap-4 bg-dot-pattern">
          <div className="p-2.5 rounded-xl bg-[#FF334B] text-[#09090B] border border-[#09090B]">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#FF334B]">STATUTORY OVERDUE</p>
            <p className="text-lg sm:text-xl font-['Dela_Gothic_One'] text-[#FF334B]">
              {pluralize(overdueCount, 'case')}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Ribbon: Banks, Search & Status */}
      <div className="p-5 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 max-w-xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#52525B]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setFilters({ search: e.target.value });
                }}
                placeholder="Search reference, victim, or account (Press '/' to focus)"
                aria-label="Search cases"
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl shadow-hard-sm focus:outline-none focus:shadow-hard font-bold text-[#09090B] placeholder:text-[#71717A]"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 shrink-0 bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl px-3 py-2 shadow-hard-sm">
              <ArrowUpDown className="w-4 h-4 text-[#09090B]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort cases"
                className="text-xs bg-transparent border-0 focus:outline-none font-bold uppercase cursor-pointer text-[#09090B]"
              >
                <option value="deadline">Statutory Urgency</option>
                <option value="amount_desc">Amount: High to Low</option>
                <option value="amount_asc">Amount: Low to High</option>
                <option value="created_desc">Most Recent</option>
              </select>
            </div>
          </div>

          {/* Bank selector pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {user?.role === 'bank_viewer' ? (
              <div className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider border-2 border-[#09090B] bg-[#D2E823] text-[#09090B] shadow-hard-sm flex items-center gap-1.5">
                <span>TENANT LOCKED:</span>
                <span>{user.bank_id?.toUpperCase() || 'ASSIGNED BANK'}</span>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setFilters({ bank_id: undefined })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border-2 border-[#09090B] ${!filters.bank_id
                      ? 'bg-[#09090B] text-[#D2E823] shadow-hard-sm'
                      : 'bg-[#F8F4E8] text-[#09090B] hover:bg-[#D2E823]'
                    }`}
                >
                  ALL 5 BANKS
                </button>
                {DEMO_BANKS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setFilters({ bank_id: b.id })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border-2 border-[#09090B] ${filters.bank_id === b.id
                        ? 'bg-[#09090B] text-[#D2E823] shadow-hard-sm'
                        : 'bg-[#F8F4E8] text-[#09090B] hover:bg-[#D2E823]'
                      }`}
                  >
                    {b.name.split(' ')[0]}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Status Tab Bar */}
        <div className="flex items-center gap-2 border-t-2 border-[#09090B] pt-4 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const isActive = (filters.status || '') === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setFilters({ status: tab.value || undefined })}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border-2 border-[#09090B] ${isActive
                    ? 'bg-[#09090B] text-[#D2E823] shadow-hard-sm translate-x-[1px] translate-y-[1px]'
                    : 'bg-transparent text-[#09090B] hover:bg-[#D2E823]'
                  }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cases Table */}
      <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-[#09090B] bg-[#09090B] text-[#D2E823] text-xs font-['Space_Grotesk'] font-bold uppercase tracking-wider">
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Case Reference</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Bank</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Victim</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Claim Amount</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Statutory Stage</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Statutory Clock</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Flags</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#09090B] text-xs">
              {sortedCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#52525B]">
                    <p className="font-['Dela_Gothic_One'] text-base uppercase text-[#09090B]">NO MATCHING CLAIMS</p>
                    <p className="text-xs font-mono mt-1">Adjust search terms or reset statutory stage filters</p>
                  </td>
                </tr>
              ) : (
                sortedCases.map((caseItem, idx) => {
                  const isFocused = idx === focusedIndex;
                  return (
                    <tr
                      key={caseItem.id}
                      onClick={() => {
                        setFocusedIndex(idx);
                        handleSelectCase(caseItem);
                      }}
                      className={`hover:bg-[#EDE8D5] transition-colors cursor-pointer group ${isFocused ? 'bg-[#EDE8D5] border-l-4 border-l-[#D2E823]' : ''
                        }`}
                    >
                      {/* Case Number */}
                      <td className="py-3 px-4 font-mono font-bold text-[#09090B]">
                        <span className="inline-flex items-center gap-1.5">
                          {isFocused && (
                            <span className="text-[#09090B] font-black text-xs">▶</span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-[#09090B] text-[#D2E823] border border-[#09090B]">
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
                      <td className="py-3 px-4 font-bold text-[#09090B] uppercase">
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
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#D2E823] text-[#09090B] border border-[#09090B] shadow-[1px_1px_0px_0px_#09090B]"
                            >
                              <BrainCircuit className="w-3 h-3" /> OCR PENDING
                            </span>
                          )}
                          {caseItem.flags.shared_account_case_count > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF334B] text-[#09090B] border border-[#09090B]">
                              SYNDICATE ({caseItem.flags.shared_account_case_count})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 font-bold text-xs text-[#09090B] group-hover:text-[#09090B] group-hover:underline">
                          INSPECT <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
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

      {/* Keyboard Shortcuts Status Ribbon (Desktop / Tablet) */}
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-xl border-2 border-[#09090B] bg-[#09090B] text-[#D2E823] text-xs font-mono shadow-hard-sm">
        <div className="flex items-center gap-5 flex-wrap">
          <span className="flex items-center gap-1.5 text-[#F8F4E8] font-bold">
            <Keyboard className="w-4 h-4 text-[#D2E823]" /> HOTKEYS:
          </span>
          <span className="flex items-center gap-1.5 text-[#F8F4E8]">
            <span className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[#3F3F46] text-[#D2E823] font-bold">J</span>
            <span className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[#3F3F46] text-[#D2E823] font-bold">K</span>
            <span className="text-[#A1A1AA]">Navigate</span>
          </span>
          <span className="flex items-center gap-1.5 text-[#F8F4E8]">
            <span className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[#3F3F46] text-[#D2E823] font-bold">Enter</span>
            <span className="text-[#A1A1AA]">Inspect Claim</span>
          </span>
          <span className="flex items-center gap-1.5 text-[#F8F4E8]">
            <span className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[#3F3F46] text-[#D2E823] font-bold">/</span>
            <span className="text-[#A1A1AA]">Focus Search</span>
          </span>
        </div>
        <span className="text-[#A1A1AA] text-[11px] font-bold">
          ACTIVE ROW: {sortedCases.length > 0 && sortedCases[focusedIndex] ? sortedCases[focusedIndex].reference : 'NONE'}
        </span>
      </div>

      {/* Case Detail Modal */}
      {isDetailOpen && selectedCase && selectedCase.id === caseId && (
        <CaseDetailModal
          caseItem={selectedCase}
          isOpen={isDetailOpen}
          onClose={() => navigate(PATHS.cases)}
          onCaseUpdated={() => {
            fetchCases();
            fetchCaseById(selectedCase.id);
          }}
          onOpenExtraction={(extractionId) => navigate(PATHS.reviewDetail(extractionId))}
        />
      )}

      {isIntakeOpen && (
        <CaseIntakeModal
          isOpen={isIntakeOpen}
          onClose={() => setIsIntakeOpen(false)}
          onCaseCreated={(created) => {
            setIsIntakeOpen(false);
            fetchCases();
            navigate(PATHS.caseDetail(created.id));
          }}
        />
      )}
    </div>
  );
}
