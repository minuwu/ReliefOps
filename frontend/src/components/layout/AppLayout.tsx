import { useState } from 'react';
import { Outlet, useNavigation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { Toaster } from '@/components/ui/Toaster';
import { DemoWalkthroughModal } from '@/components/walkthrough/DemoWalkthroughModal';
import { DemoInbox } from '@/components/auth/DemoInbox';
import { USE_MOCK } from '@/services/http';

/** Shell shared by every route: navigation, page outlet, toasts, footer. */
export function AppLayout() {
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState(false);
  const navigation = useNavigation();
  const isLoading = navigation.state === 'loading';
  // The walkthrough switches between seeded demo accounts, so it only exists in mock mode.
  const openWalkthrough = USE_MOCK ? () => setIsWalkthroughOpen(true) : undefined;

  return (
    <div className="min-h-screen bg-[#F8F4E8] text-[#09090B] flex flex-col font-['Space_Grotesk',sans-serif] selection:bg-[#D2E823] selection:text-[#09090B] relative overflow-x-hidden w-full max-w-full">
      {isLoading && (
        <div
          className="fixed top-0 left-0 right-0 h-[2px] bg-[#09090B] z-50 pointer-events-none"
          role="progressbar"
          aria-label="Loading page"
        />
      )}
      <Navbar onOpenWalkthrough={openWalkthrough} />
      <Toaster />

      <main className="flex-1 w-full max-w-full overflow-x-hidden">
        <Outlet />
      </main>

      {openWalkthrough && (
        <>
          <DemoWalkthroughModal isOpen={isWalkthroughOpen} onClose={() => setIsWalkthroughOpen(false)} />
          <DemoInbox />
        </>
      )}

      <Footer />
    </div>
  );
}
