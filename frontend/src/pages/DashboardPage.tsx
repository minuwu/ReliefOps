import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { errorMessage } from '@/services/http';
import { DashboardStats, SharedAccountAlert, CaseSummary } from '@/types/api';
import { useCaseStore } from '@/store/useCaseStore';
import { useAuthStore } from '@/store/useAuthStore';
import { HeroCommandSection } from '@/components/dashboard/HeroCommandSection';
import { BentoMetricsGrid } from '@/components/dashboard/BentoMetricsGrid';
import { UrgentCasesCarousel } from '@/components/dashboard/UrgentCasesCarousel';
import { FraudRingVisualizer } from '@/components/dashboard/FraudRingVisualizer';
import { Marquee } from '@/components/ui/Marquee';
import { CaseIntakeModal } from '@/components/cases/CaseIntakeModal';
import { PATHS } from '@/routes/paths';

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<SharedAccountAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);

  const { cases, fetchCases } = useCaseStore();
  const role = useAuthStore((s) => s.user?.role);
  // Shared-account alerts are supervisor-only; bank viewers read stats but cannot create cases.
  const isSupervisor = role === 'supervisor';

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [statsRes, alertsRes] = await Promise.all([
          api.getDashboardStats(),
          isSupervisor ? api.getSharedAccountAlerts() : Promise.resolve({ data: [] as SharedAccountAlert[] }),
        ]);
        setStats(statsRes.data);
        setAlerts(alertsRes.data);
        await fetchCases();
      } catch (err) {
        setLoadError(errorMessage(err, 'Could not load the dashboard.'));
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const totalClaimedJPY = cases.reduce((acc, c) => acc + (c.amount || 0), 0);

  const openCase = (caseId: string) => navigate(PATHS.caseDetail(caseId));
  const goToCases = () => navigate(PATHS.cases);
  const goToReview = () => navigate(PATHS.review);

  if (loadError) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center" role="alert">
        <p className="font-['Dela_Gothic_One'] text-2xl uppercase text-[#09090B]">DASHBOARD UNAVAILABLE</p>
        <p className="text-sm font-medium text-[#52525B] mt-2">{loadError}</p>
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <p className="font-['Dela_Gothic_One'] text-2xl uppercase tracking-tighter text-[#09090B]">
          SYNCHRONIZING 5-BANK CLEARINGHOUSE...
        </p>
        <p className="text-xs font-mono text-[#52525B] mt-2">Connecting to distributed ledger nodes</p>
      </div>
    );
  }

  // Marquee Alert Items
  const marqueeItems = [
    `CRITICAL ESCALATION: ${stats.overdue_cases} CASES EXCEEDED STATUTORY DEADLINE`,
    `AI OCR QUEUE: ${stats.ai_review_pending} WIRE VOUCHERS AWAITING HUMAN CONFIRMATION`,
    `FIVE-BANK ALLIANCE: TOKYO • OSAKA • NAGOYA • FUKUOKA • SAPPORO NODES ACTIVE`,
    `MULE SYNDICATE THREAT DETECTED: 3 BENEFICIARY ACCOUNTS FLAGGED ACROSS BANKS`,
    `TOTAL VALUE PROTECTED: ¥${(totalClaimedJPY / 1000000).toFixed(1)}M PRO-RATA RECOVERY`,
  ];

  return (
    <div className="space-y-6 sm:space-y-8 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Continuous Marquee Banner */}
      <Marquee items={marqueeItems} speed="24s" />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-8 sm:space-y-12">
        {/* Hero Command Section (12 Columns) */}
        <HeroCommandSection
          onOpenIntake={isSupervisor ? () => setIsIntakeOpen(true) : undefined}
          onOpenReview={goToReview}
          overdueCount={stats.overdue_cases}
        />

        {/* Bento Category Grid */}
        <div>
          <div className="border-b-2 border-[#09090B] pb-2 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-2xl font-['Dela_Gothic_One'] uppercase text-[#09090B]">
              CONSORTIUM TELEMETRY BENTO
            </h2>
          </div>
          <BentoMetricsGrid
            stats={stats}
            totalClaimedJPY={totalClaimedJPY}
            onNavigateToCases={goToCases}
            onNavigateToReview={goToReview}
          />
        </div>

        {/* Urgent Escalation Horizontal Scrolling Section */}
        <UrgentCasesCarousel cases={cases} onSelectCase={(c: CaseSummary) => openCase(c.id)} />

        {/* Fraud Ring Visualizer */}
        <FraudRingVisualizer alerts={alerts} onInspectCase={openCase} />
      </div>

      {/* Case Intake Modal */}
      {isIntakeOpen && (
        <CaseIntakeModal
          isOpen={isIntakeOpen}
          onClose={() => setIsIntakeOpen(false)}
          onCaseCreated={(created) => {
            setIsIntakeOpen(false);
            openCase(created.id);
          }}
        />
      )}
    </div>
  );
}
