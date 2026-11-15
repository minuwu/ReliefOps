import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { Toaster } from '@/components/ui/Toaster';
import { CustomCursor } from '@/components/ui/CustomCursor';
import { NoiseOverlay } from '@/components/ui/NoiseOverlay';
import { DemoWalkthroughModal } from '@/components/walkthrough/DemoWalkthroughModal';
import { DemoInbox } from '@/components/auth/DemoInbox';
import { USE_MOCK } from '@/services/http';

/** Shell shared by every route: navigation, page outlet, toasts, footer. */
export function AppLayout() {
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
  // The walkthrough switches between seeded demo accounts, so it only exists in mock mode.
  const openWalkthrough = USE_MOCK ? () => setIsWalkthroughOpen(true) : undefined;

  return (
    <div className="min-h-screen bg-[#F8F4E8] text-[#09090B] flex flex-col font-['Space_Grotesk',sans-serif] selection:bg-[#D2E823] selection:text-[#09090B] relative overflow-x-hidden w-full max-w-full">
      <CustomCursor />
      <NoiseOverlay />
      <Navbar onOpenWalkthrough={openWalkthrough} />
      <Toaster />

      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        <Outlet />
      </main>

      {openWalkthrough && (
        <>
          <div className="fixed bottom-4 right-4 z-40 hidden sm:block">
            <button
              type="button"
              onClick={openWalkthrough}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#09090B] text-[#D2E823] border-2 border-[#D2E823] shadow-hard-acid hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm transition-all cursor-pointer font-bold text-xs uppercase tracking-wider group"
              title="Open Demo Walkthrough & Scenario Guide"
            >
              <Sparkles className="w-4 h-4 text-[#D2E823] group-hover:rotate-12 transition-transform" />
              <span>DEMO WALKTHROUGH & SCENARIOS</span>
            </button>
          </div>
          <DemoWalkthroughModal isOpen={isWalkthroughOpen} onClose={() => setIsWalkthroughOpen(false)} />
          <DemoInbox />
        </>
      )}

      <Footer />
    </div>
  );
}
