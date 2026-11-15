import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { DashboardStats, SharedAccountAlert, CaseSummary } from '@/types/api';
import { useCaseStore } from '@/store/useCaseStore';
import { HeroCommandSection } from '@/components/dashboard/HeroCommandSection';
import { BentoMetricsGrid } from '@/components/dashboard/BentoMetricsGrid';
import { UrgentCasesCarousel } from '@/components/dashboard/UrgentCasesCarousel';
import { FraudRingVisualizer } from '@/components/dashboard/FraudRingVisualizer';
import { Marquee } from '@/components/ui/Marquee';
import { CaseDetailModal } from '@/components/cases/CaseDetailModal';
import { CaseIntakeModal } from '@/components/cases/CaseIntakeModal';
import { ExtractionReviewModal } from '@/components/extraction/ExtractionReviewModal';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';

interface DashboardPageProps {
  onNavigateToCases?: (filter?: string) => void;
  onNavigateToReview?: () => void;
}

export function DashboardPage({ onNavigateToCases, onNavigateToReview }: DashboardPageProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<SharedAccountAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { cases, fetchCases, fetchCaseById, selectedCase } = useCaseStore();
  const { activeExtraction, fetchExtraction, clearActive } = useReviewQueueStore();

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [statsRes, alertsRes] = await Promise.all([
          api.getDashboardStats(),
          api.getSharedAccountAlerts(),
        ]);
        setStats(statsRes.data);
        setAlerts(alertsRes.data);
        await fetchCases();
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const totalClaimedJPY = cases.reduce((acc, c) => acc + (c.amount || 0), 0);

  const handleSelectCase = async (c: CaseSummary) => {
    await fetchCaseById(c.id);
    setIsDetailOpen(true);
  };

  const handleInspectCaseById = async (caseId: string) => {
    await fetchCaseById(caseId);
    setIsDetailOpen(true);
  };

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
          onOpenIntake={() => setIsIntakeOpen(true)}
          onOpenReview={onNavigateToReview}
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
            onNavigateToCases={onNavigateToCases}
            onNavigateToReview={onNavigateToReview}
          />
        </div>

        {/* Urgent Escalation Horizontal Scrolling Section */}
        <UrgentCasesCarousel cases={cases} onSelectCase={handleSelectCase} />

        {/* Fraud Ring Visualizer */}
        <FraudRingVisualizer alerts={alerts} onInspectCase={handleInspectCaseById} />
      </div>

      {/* Case Intake Modal */}
      {isIntakeOpen && (
        <CaseIntakeModal
          isOpen={isIntakeOpen}
          onClose={() => setIsIntakeOpen(false)}
          onCaseCreated={() => {
            setIsIntakeOpen(false);
            fetchCases();
          }}
        />
      )}

      {/* Case Detail Inspection Modal */}
      {isDetailOpen && selectedCase && (
        <CaseDetailModal
          caseItem={selectedCase}
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          onCaseUpdated={() => {
            fetchCases();
            if (selectedCase) fetchCaseById(selectedCase.id);
          }}
          onOpenExtraction={(extractionId) => {
            fetchExtraction(extractionId);
          }}
        />
      )}

      {/* Extraction Review Modal */}
      {activeExtraction && (
        <ExtractionReviewModal
          extraction={activeExtraction}
          isOpen={Boolean(activeExtraction)}
          onClose={clearActive}
          onReviewed={() => {
            clearActive();
            fetchCases();
          }}
        />
      )}
    </div>
  );
}
