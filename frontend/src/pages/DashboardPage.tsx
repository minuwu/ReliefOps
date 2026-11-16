import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { errorMessage } from '@/services/http';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { DashboardStats, SharedAccountAlert, CaseSummary, DeadlineState, CaseStatus } from '@/types/api';
import { useCaseStore } from '@/store/useCaseStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';
import { CaseIntakeModal } from '@/components/cases/CaseIntakeModal';
import { PATHS } from '@/routes/paths';
import { Plus } from 'lucide-react';
import { StatStrip } from '@/components/dashboard/StatStrip';
import { CasesByStatus } from '@/components/dashboard/CasesByStatus';
import { UrgentCasesList } from '@/components/dashboard/UrgentCasesList';
import { SharedAccountsList } from '@/components/dashboard/SharedAccountsList';

export function DashboardPage() {
  const navigate = useNavigate();
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);

  const { cases, fetchCases, setFilters } = useCaseStore();
  const role = useAuthStore((s) => s.user?.role);
  // Shared-account alerts are supervisor-only; bank viewers read stats but cannot create cases.
  const isSupervisor = role === 'supervisor';

  const {
    data,
    loading: isLoading,
    error,
    reload: loadData,
  } = useAsyncResource(`dashboard:${isSupervisor}`, async () => {
    const alertsPromise = isSupervisor
      ? api.getSharedAccountAlerts().catch(() => ({ data: [] as SharedAccountAlert[] }))
      : Promise.resolve({ data: [] as SharedAccountAlert[] });

    const [statsRes, alertsRes] = await Promise.all([
      api.getDashboardStats(),
      alertsPromise,
      fetchCases(),
    ]);
    return {
      stats: statsRes.data,
      alerts: alertsRes.data,
    };
  });

  const stats: DashboardStats | null = data?.stats ?? null;
  const alerts = data?.alerts ?? [];
  const loadError = error
    ? errorMessage(error, 'We could not load the dashboard. Check your connection and try again.')
    : null;

  const totalClaimedJPY = cases.reduce((acc, c) => acc + (c.amount || 0), 0);

  const openCase = (caseId: string) => navigate(PATHS.caseDetail(caseId));

  const goToCases = (deadlineFilter?: DeadlineState) => {
    setFilters({ deadline_state: deadlineFilter });
    navigate(PATHS.cases);
  };

  const goToCasesWithStatus = (status: CaseStatus) => {
    setFilters({ status });
    navigate(PATHS.cases);
  };

  const goToReview = () => navigate(PATHS.review);

  if (loadError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center space-y-4" role="alert">
        <h1 className="font-['Dela_Gothic_One'] text-xl sm:text-2xl text-[#09090B]">
          Could not load the dashboard.
        </h1>
        <p className="text-sm text-[#52525B] max-w-md mx-auto">{loadError}</p>
        <div>
          <Button variant="primary" onClick={loadData}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        <p className="text-sm text-[#52525B]">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-['Dela_Gothic_One'] text-2xl sm:text-3xl text-[#09090B]">
            Dashboard
          </h1>
          <p className="text-sm text-[#52525B] mt-1">
            Case volume, deadlines and items waiting for review.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={goToReview}
            className="gap-2"
          >
            <span>Review queue</span>
            <span className="px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-[#EDE8D5] text-[#09090B] border border-[#09090B]">
              {stats.ai_review_pending}
            </span>
          </Button>
          {isSupervisor && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsIntakeOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New case</span>
            </Button>
          )}
        </div>
      </div>

      {/* Stat Strip */}
      <StatStrip
        stats={stats}
        totalClaimedJPY={totalClaimedJPY}
        onNavigateToCases={goToCases}
        onNavigateToReview={goToReview}
      />

      {/* Cases by Status Breakdown */}
      {stats.cases_by_status && (
        <CasesByStatus
          casesByStatus={stats.cases_by_status}
          onSelectStatus={goToCasesWithStatus}
        />
      )}

      {/* Needs Attention (Urgent Cases) */}
      <UrgentCasesList
        cases={cases}
        onSelectCase={(c: CaseSummary) => openCase(c.id)}
      />

      {/* Shared Beneficiary Accounts (Supervisor only) */}
      {isSupervisor && (
        <SharedAccountsList
          alerts={alerts}
          onInspectCase={openCase}
        />
      )}

      {/* Case Intake Modal */}
      {isIntakeOpen && (
        <CaseIntakeModal
          isOpen={isIntakeOpen}
          onClose={() => setIsIntakeOpen(false)}
          onCaseCreated={(created) => {
            setIsIntakeOpen(false);
            loadData();
            openCase(created.id);
          }}
        />
      )}
    </div>
  );
}
