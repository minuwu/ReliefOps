import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { Toaster } from '@/components/ui/Toaster';
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#09090B] text-[#F8F4E8] border border-[#09090B] text-xs font-medium cursor-pointer hover:bg-[#27272A] transition-colors"
              title="Open Demo Walkthrough & Scenario Guide"
              aria-label="Open Demo Walkthrough & Scenario Guide"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F8F4E8]" />
              <span>Demo guide</span>
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
