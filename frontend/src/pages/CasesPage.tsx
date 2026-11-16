import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCaseStore } from '@/store/useCaseStore';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from '@/store/useToastStore';
import { CaseSummary } from '@/types/api';
import { CaseDetailModal } from '@/components/cases/CaseDetailModal';
import { CaseIntakeModal } from '@/components/cases/CaseIntakeModal';
import { CaseStatStrip } from '@/components/cases/CaseStatStrip';
import { CaseTable } from '@/components/cases/CaseTable';
import { PATHS } from '@/routes/paths';
import { Button } from '@/components/ui/Button';
import { DEMO_BANKS } from '@/services/mockData';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { useWindowEvent } from '@/lib/hooks/useEventListener';
import {
  Search,
  PlusCircle,
  RefreshCw,
  ArrowUpDown,
  Keyboard,
} from 'lucide-react';

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All claims', value: '' },
  { label: '1. Received', value: 'received' },
  { label: '2. Verified', value: 'verified' },
  { label: '3. Account check', value: 'account_check' },
  { label: '4. Notice published', value: 'notice_published' },
  { label: '5. Payout review', value: 'payout_review' },
  { label: '6. Closed', value: 'closed' },
];

export function CasesPage() {
  const { user } = useAuthStore();
  const { cases, filters, setFilters, fetchCases, fetchCaseById, clearSelected, selectedCase, isLoading, error } =
    useCaseStore();
  const navigate = useNavigate();
  const { caseId } = useParams<{ caseId?: string }>();
  const isDetailOpen = Boolean(caseId);
  const canCreate = user?.role === 'operator' || user?.role === 'supervisor';

  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [sortBy, setSortBy] = useState<'deadline' | 'amount_desc' | 'amount_asc' | 'created_desc'>('deadline');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { reload: reloadCases } = useAsyncResource('cases:list', () => fetchCases());

  useAsyncResource(
    caseId ? `case:${caseId}` : null,
    async () => {
      if (!caseId) return null;
      const loaded = await fetchCaseById(caseId);
      if (!loaded) {
        toast('That case does not exist or you cannot open it.', 'error');
        navigate(PATHS.cases, { replace: true });
      }
      return loaded;
    }
  );

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

  // Keyboard Navigation: J/K, Enter, Slash
  useWindowEvent('keydown', (e) => {
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
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 font-['Space_Grotesk',sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#09090B] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-['Dela_Gothic_One'] text-[#09090B]">
            Cases
          </h1>
          <p className="text-sm text-[#52525B] mt-1">
            All relief claims across the partner banks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button variant="outline" size="sm" onClick={() => reloadCases()} isLoading={isLoading} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          {canCreate && (
            <Button variant="primary" size="sm" onClick={() => setIsIntakeOpen(true)} className="gap-1.5">
              <PlusCircle className="w-4 h-4" /> New case
            </Button>
          )}
        </div>
      </div>

      <CaseStatStrip
        totalClaimed={totalClaimed}
        aiPendingCount={aiPendingCount}
        dueSoonCount={dueSoonCount}
        overdueCount={overdueCount}
      />

      {/* Filters Toolbar */}
      <div className="p-4 sm:p-6 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 max-w-xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#52525B]" />
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
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#EDE8D5]/40 border border-[#09090B]/20 rounded-xl focus:outline-none focus:border-[#09090B] font-medium text-[#09090B] placeholder:text-[#71717A]"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 shrink-0 bg-[#EDE8D5]/40 border border-[#09090B]/20 rounded-xl px-3 py-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#52525B]" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'deadline' | 'amount_desc' | 'amount_asc' | 'created_desc')}
                aria-label="Sort cases"
                className="text-xs bg-transparent border-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B] font-bold uppercase cursor-pointer text-[#09090B]"
              >
                <option value="deadline">Statutory Urgency</option>
                <option value="amount_desc">Amount: High to Low</option>
                <option value="amount_asc">Amount: Low to High</option>
                <option value="created_desc">Most Recent</option>
              </select>
            </div>
          </div>

          {/* Bank selector pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {user?.role === 'bank_viewer' ? (
              <div className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider border border-[#09090B] bg-[#D2E823] text-[#09090B] flex items-center gap-1.5">
                <span>TENANT LOCKED:</span>
                <span>{user.bank_id?.toUpperCase() || 'ASSIGNED BANK'}</span>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setFilters({ bank_id: undefined })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap border ${
                    !filters.bank_id
                      ? 'border-[#09090B] bg-[#09090B] text-[#D2E823]'
                      : 'border-[#09090B]/20 bg-transparent text-[#09090B] hover:bg-[#EDE8D5]'
                  }`}
                >
                  All banks
                </button>
                {DEMO_BANKS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setFilters({ bank_id: b.id })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap border ${
                      filters.bank_id === b.id
                        ? 'border-[#09090B] bg-[#09090B] text-[#D2E823]'
                        : 'border-[#09090B]/20 bg-transparent text-[#09090B] hover:bg-[#EDE8D5]'
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
        <div className="flex items-center gap-1.5 border-t border-[#09090B]/10 pt-3 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const isActive = (filters.status || '') === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setFilters({ status: tab.value || undefined })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap border ${
                  isActive
                    ? 'border-[#09090B] bg-[#09090B] text-[#D2E823]'
                    : 'border-transparent text-[#52525B] hover:text-[#09090B] hover:bg-[#EDE8D5]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[#FF334B]/30 bg-[#FF334B]/10 text-xs text-[#09090B]"
        >
          <span className="font-bold text-[#FF334B]">{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCases()}
            className="self-start sm:self-auto shrink-0"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Cases Table */}
      {isLoading && cases.length === 0 ? (
        <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard p-12 text-center text-[#52525B]">
          <p className="font-bold text-sm uppercase text-[#09090B]">Loading relief claims…</p>
          <p className="text-xs text-[#52525B] mt-1">Fetching cases from the registry</p>
        </div>
      ) : (
        <CaseTable
          cases={sortedCases}
          focusedIndex={focusedIndex}
          onSelectCase={(caseItem, idx) => {
            setFocusedIndex(idx);
            handleSelectCase(caseItem);
          }}
        />
      )}

      {/* Keyboard Shortcuts Status Ribbon */}
      <div className="hidden sm:flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/40 text-xs text-[#52525B]">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5 font-bold text-[#09090B]">
            <Keyboard className="w-4 h-4 text-[#09090B]" /> Shortcuts:
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#F8F4E8] border border-[#09090B]/20 text-[#09090B] font-mono font-bold text-xs">J</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-[#F8F4E8] border border-[#09090B]/20 text-[#09090B] font-mono font-bold text-xs">K</kbd>
            <span className="text-[#52525B] ml-1">Navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#F8F4E8] border border-[#09090B]/20 text-[#09090B] font-mono font-bold text-xs">Enter</kbd>
            <span className="text-[#52525B] ml-1">Inspect</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[#F8F4E8] border border-[#09090B]/20 text-[#09090B] font-mono font-bold text-xs">/</kbd>
            <span className="text-[#52525B] ml-1">Search</span>
          </span>
        </div>
        <span className="text-xs text-[#52525B] font-mono">
          Active: <strong className="text-[#09090B]">{sortedCases.length > 0 && sortedCases[focusedIndex] ? sortedCases[focusedIndex].reference : 'None'}</strong>
        </span>
      </div>

      {/* Case Detail Modal */}
      {isDetailOpen && selectedCase && selectedCase.id === caseId && (
        <CaseDetailModal
          caseItem={selectedCase}
          isOpen={isDetailOpen}
          onClose={() => {
            clearSelected();
            navigate(PATHS.cases);
          }}
          onCaseUpdated={() => {
            reloadCases();
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
            reloadCases();
            navigate(PATHS.caseDetail(created.id));
          }}
        />
      )}
    </div>
  );
}
