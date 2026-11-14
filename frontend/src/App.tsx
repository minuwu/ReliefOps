import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { Navbar } from '@/components/layout/Navbar';
import { CasesPage } from '@/pages/CasesPage';
import { ReviewQueuePage } from '@/pages/ReviewQueuePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AuditLogsPage } from '@/pages/AuditLogsPage';
import { VictimPortalPage } from '@/pages/VictimPortalPage';

export function App() {
  const { initialize } = useAuthStore();
  const [currentTab, setCurrentTab] = useState<'cases' | 'review' | 'dashboard' | 'audit' | 'victim'>('cases');

  useEffect(() => {
    initialize();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Navbar currentTab={currentTab} onSelectTab={setCurrentTab} />

      <main className="flex-1">
        {currentTab === 'cases' && (
          <CasesPage onOpenIntake={() => setCurrentTab('victim')} />
        )}
        {currentTab === 'review' && <ReviewQueuePage />}
        {currentTab === 'dashboard' && <DashboardPage />}
        {currentTab === 'audit' && <AuditLogsPage />}
        {currentTab === 'victim' && <VictimPortalPage />}
      </main>

      {/* Institutional Footer */}
      <footer className="border-t border-border bg-card py-6 mt-12 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            ReliefOps — Multi-Bank Operations Center • Built strictly to API Specification v0.3.0
          </p>
          <div className="flex items-center gap-4">
            <span>Aster Regional</span>
            <span>•</span>
            <span>Birch Regional</span>
            <span>•</span>
            <span>Cobalt Regional</span>
            <span>•</span>
            <span>Dune Regional</span>
            <span>•</span>
            <span>Ember Regional</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
