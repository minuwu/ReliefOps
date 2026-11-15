import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CasesPage } from '@/pages/CasesPage';
import { ReviewQueuePage } from '@/pages/ReviewQueuePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AuditLogsPage } from '@/pages/AuditLogsPage';
import { VictimPortalPage } from '@/pages/VictimPortalPage';
import { CustomCursor } from '@/components/ui/CustomCursor';
import { NoiseOverlay } from '@/components/ui/NoiseOverlay';
import { DemoWalkthroughModal } from '@/components/walkthrough/DemoWalkthroughModal';
import { Sparkles } from 'lucide-react';

export function App() {
  const { user, initialize } = useAuthStore();
  const [currentTab, setCurrentTab] = useState<'cases' | 'review' | 'dashboard' | 'audit' | 'victim'>('dashboard');
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);

  useEffect(() => {
    initialize();
  }, []);

  // When user role changes, prioritize relevant view
  useEffect(() => {
    if (user?.role === 'supervisor') {
      setCurrentTab('dashboard');
    } else if (user?.role === 'operator') {
      setCurrentTab('cases');
    } else if (user?.role === 'bank_viewer') {
      setCurrentTab('cases');
    }
  }, [user?.role]);

  return (
    <div className="min-h-screen bg-[#F8F4E8] text-[#09090B] flex flex-col font-['Space_Grotesk',sans-serif] selection:bg-[#D2E823] selection:text-[#09090B] relative overflow-x-hidden w-full max-w-full">
      {/* Global Interactive Custom Cursor */}
      <CustomCursor />

      {/* Global SVG Noise Texture Overlay */}
      <NoiseOverlay />

      {/* Sticky Neo-Brutalist Navigation Bar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenWalkthrough={() => setIsWalkthroughOpen(true)}
      />

      {/* Main Dynamic Operations Workstation */}
      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        {currentTab === 'dashboard' && (
          <DashboardPage
            onNavigateToCases={() => {
              setCurrentTab('cases');
            }}
            onNavigateToReview={() => {
              setCurrentTab('review');
            }}
          />
        )}
        {currentTab === 'cases' && (
          <CasesPage onOpenIntake={() => setCurrentTab('victim')} />
        )}
        {currentTab === 'review' && <ReviewQueuePage />}
        {currentTab === 'audit' && <AuditLogsPage />}
        {currentTab === 'victim' && <VictimPortalPage />}
      </main>

      {/* Persistent Floating Demo Walkthrough Launcher */}
      <div className="fixed bottom-4 right-4 z-40 hidden sm:block">
        <button
          onClick={() => setIsWalkthroughOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#09090B] text-[#D2E823] border-2 border-[#D2E823] shadow-hard-acid hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm transition-all cursor-pointer font-bold text-xs uppercase tracking-wider group"
          title="Open Demo Walkthrough & Scenario Guide"
        >
          <Sparkles className="w-4 h-4 text-[#D2E823] group-hover:rotate-12 transition-transform" />
          <span>DEMO WALKTHROUGH & SCENARIOS</span>
        </button>
      </div>

      {/* In-App Demo Walkthrough Modal */}
      <DemoWalkthroughModal
        isOpen={isWalkthroughOpen}
        onClose={() => setIsWalkthroughOpen(false)}
        onSelectTab={setCurrentTab}
      />

      {/* Inverted Neo-Brutalist Footer */}
      <Footer />
    </div>
  );
}

export default App;
