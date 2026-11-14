import { useEffect, useState } from 'react';
import { useCaseStore } from '@/store/useCaseStore';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { CaseSummary } from '@/types/api';
import { CaseDetailModal } from '@/components/cases/CaseDetailModal';
import { ExtractionReviewModal } from '@/components/extraction/ExtractionReviewModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DEMO_BANKS } from '@/services/mockData';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Search,
  Building2,
  Calendar,
  AlertCircle,
  BrainCircuit,
  MessageSquare,
  Users,
  ChevronRight,
  PlusCircle,
  RefreshCw,
} from 'lucide-react';

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All Cases', value: '' },
  { label: 'Received', value: 'received' },
  { label: 'Verified', value: 'verified' },
  { label: 'Account Check', value: 'account_check' },
  { label: 'Notice Published', value: 'notice_published' },
  { label: 'Payout Review', value: 'payout_review' },
  { label: 'Closed', value: 'closed' },
];

interface CasesPageProps {
  onOpenIntake?: () => void;
}

export function CasesPage({ onOpenIntake }: CasesPageProps) {
  const { cases, filters, setFilters, fetchCases, fetchCaseById, selectedCase, isLoading } =
    useCaseStore();
  const { activeExtraction, fetchExtraction, clearActive } = useReviewQueueStore();

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(filters.search || '');

  useEffect(() => {
    fetchCases();
  }, []);

  const handleSelectCase = async (caseSummary: CaseSummary) => {
    await fetchCaseById(caseSummary.id);
    setIsDetailOpen(true);
  };

  const handleOpenExtraction = async (extractionId: string) => {
    await fetchExtraction(extractionId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Multi-Bank Case Operations Roster
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Operational triage across five regional banks adhering to statutory restitution deadlines
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => fetchCases()} isLoading={isLoading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" onClick={onOpenIntake} className="gap-1.5">
            <PlusCircle className="w-4 h-4" /> Open New Case Intake
          </Button>
        </div>
      </div>

      {/* Filter Ribbon: Banks & Search */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-4 shadow-xs">
        {/* Top Filter Row: Search & Bank Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setFilters({ search: e.target.value });
              }}
              placeholder="Search by reference (RFR-...), victim name, or bank..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            />
          </div>

          {/* Bank selector pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilters({ bank_id: undefined })}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                !filters.bank_id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              All 5 Banks
            </button>
            {DEMO_BANKS.map((b) => (
              <button
                key={b.id}
                onClick={() => setFilters({ bank_id: b.id })}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  filters.bank_id === b.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {b.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Status Tab Bar */}
        <div className="flex items-center gap-1 border-t border-border pt-3 overflow-x-auto">
          {STATUS_TABS.map((tab) => {
            const isActive = (filters.status || '') === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setFilters({ status: tab.value || undefined })}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-foreground text-background font-bold shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cases Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Case Reference</th>
                <th className="py-3 px-4">Bank</th>
                <th className="py-3 px-4">Victim</th>
                <th className="py-3 px-4">Amount (JPY)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Deadline</th>
                <th className="py-3 px-4">Flags & Indicators</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground italic">
                    No cases match the selected filters.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleSelectCase(c)}
                    className="hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    {/* Reference */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground group-hover:text-primary transition-colors">
                          {c.reference}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" /> {formatDate(c.reported_date)}
                      </span>
                    </td>

                    {/* Bank */}
                    <td className="py-3.5 px-4 font-medium text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-primary" />
                        {c.bank_name}
                      </span>
                    </td>

                    {/* Victim */}
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-foreground">{c.victim_name}</p>
                      <span className="text-[10px] text-muted-foreground capitalize">
                        {c.scam_type || 'Unclassified'}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                      {formatCurrency(c.amount, c.currency)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <Badge status={c.status}>{c.status.replace('_', ' ').toUpperCase()}</Badge>
                    </td>

                    {/* Deadline & State */}
                    <td className="py-3.5 px-4">
                      <Badge deadlineState={c.deadline_state}>
                        {c.deadline_state.replace('_', ' ')}
                      </Badge>
                    </td>

                    {/* Flags */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.flags.ai_review_pending && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-semibold"
                            title="AI document extraction ready for HITL review"
                          >
                            <BrainCircuit className="w-3 h-3" /> AI Review
                          </span>
                        )}
                        {c.flags.shared_account_case_count > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-bold"
                            title="Account linked to multiple fraud victims"
                          >
                            <Users className="w-3 h-3" /> {c.flags.shared_account_case_count} Shared
                          </span>
                        )}
                        {c.flags.victim_question_pending && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold animate-pulse"
                            title="Victim question escalated to center staff"
                          >
                            <MessageSquare className="w-3 h-3" /> Chat Escalated
                          </span>
                        )}
                        {c.flags.missing_fields.length > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px]"
                            title={`Missing: ${c.flags.missing_fields.join(', ')}`}
                          >
                            <AlertCircle className="w-3 h-3" /> {c.flags.missing_fields.length} Missing
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCase(c);
                        }}
                      >
                        Inspect <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Case Detail Modal */}
      <CaseDetailModal
        caseItem={selectedCase}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onOpenExtraction={handleOpenExtraction}
      />

      {/* Extraction Review Modal */}
      <ExtractionReviewModal
        extraction={activeExtraction}
        isOpen={Boolean(activeExtraction)}
        onClose={clearActive}
        onSuccess={() => {
          fetchCases();
          if (selectedCase) fetchCaseById(selectedCase.id);
        }}
      />
    </div>
  );
}
