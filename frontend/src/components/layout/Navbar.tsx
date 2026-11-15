import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { StickerBadge } from '@/components/ui/StickerBadge';
import { GlitchText } from '@/components/ui/GlitchText';
import { DEMO_USERS } from '@/services/mockData';
import { cn } from '@/lib/utils';
import {
  ShieldAlert,
  Inbox,
  BrainCircuit,
  BarChart3,
  History,
  LifeBuoy,
  ChevronDown,
  Layers,
  Sparkles,
  ArrowRight,
  Menu,
  X,
} from 'lucide-react';

type Tab = 'cases' | 'review' | 'dashboard' | 'audit' | 'victim';

interface NavbarProps {
  currentTab: Tab;
  onSelectTab: (tab: Tab) => void;
  onOpenWalkthrough?: () => void;
}

const TABS: { id: Tab; label: string; icon: LucideIcon; roles?: string[] }[] = [
  { id: 'dashboard', label: 'CONTROL TOWER', icon: BarChart3, roles: ['supervisor', 'operator'] },
  { id: 'cases', label: 'CASE WORKSTATION', icon: Inbox, roles: ['operator', 'supervisor', 'bank_viewer'] },
  { id: 'review', label: 'HITL AI OCR', icon: BrainCircuit, roles: ['operator', 'supervisor'] },
  { id: 'audit', label: 'AUDIT LEDGER', icon: History, roles: ['operator', 'supervisor', 'bank_viewer'] },
  { id: 'victim', label: 'VICTIM PORTAL', icon: LifeBuoy },
];

export function Navbar({ currentTab, onSelectTab, onOpenWalkthrough }: NavbarProps) {
  const { user, login } = useAuthStore();
  const { queue } = useReviewQueueStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const pendingReviewCount = queue.length;

  useEffect(() => {
    if (!showUserMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowUserMenu(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showUserMenu]);

  return (
    <header className="sticky top-2 sm:top-4 z-40 mx-2 sm:mx-6 lg:mx-8 mb-4 sm:mb-6">
      <div className="rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard px-3 sm:px-6 py-2.5 sm:py-3 transition-all duration-150">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo on Left */}
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <button
              type="button"
              className="flex shrink-0 items-center gap-2.5 sm:gap-3 cursor-pointer text-left group"
              onClick={() => onSelectTab(user?.role === 'supervisor' ? 'dashboard' : 'cases')}
              aria-label="ReliefOps home"
            >
              <span className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-[#09090B] text-[#D2E823] flex items-center justify-center border-2 border-[#09090B] shadow-hard-sm group-hover:bg-[#D2E823] group-hover:text-[#09090B] transition-colors shrink-0">
                <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <GlitchText as="span" className="font-['Dela_Gothic_One'] text-base sm:text-xl tracking-tight text-[#09090B] truncate">
                    RELIEFOPS
                  </GlitchText>
                  <span className="hidden xl:inline-block">
                    <StickerBadge variant="acid" rotate="-rotate-3" className="text-[10px] py-0 px-2">
                      5-BANK SYNDICATE
                    </StickerBadge>
                  </span>
                </div>
                <p className="hidden sm:block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#52525B] truncate">
                  Furikome Sagi Relief Act Operations
                </p>
              </div>
            </button>

            {/* Desktop Navigation Tabs */}
            <nav aria-label="Primary" className="hidden lg:flex items-center gap-1.5 ml-2">
              {TABS.filter((tab) => !tab.roles || (user && tab.roles.includes(user.role))).map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                const isVictim = tab.id === 'victim';

                return (
                  <button
                    key={tab.id}
                    onClick={() => onSelectTab(tab.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-120 cursor-pointer border-2',
                      isActive
                        ? 'bg-[#09090B] text-[#D2E823] border-[#09090B] shadow-hard-sm translate-x-[1px] translate-y-[1px]'
                        : isVictim
                          ? 'bg-[#D2E823] text-[#09090B] border-[#09090B] shadow-hard-sm hover:translate-x-[1px] hover:translate-y-[1px]'
                          : 'bg-transparent text-[#09090B] border-transparent hover:border-[#09090B] hover:bg-[#D2E823] hover:shadow-hard-sm'
                    )}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{tab.label}</span>
                    {tab.id === 'review' && pendingReviewCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#FF334B] text-[#09090B] border border-[#09090B]">
                        {pendingReviewCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Action Buttons on Right */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Bank Tenant Badge if Bank Viewer */}
            {user?.role === 'bank_viewer' && user.bank_id && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D2E823] text-[#09090B] font-bold text-xs border-2 border-[#09090B] shadow-hard-sm">
                <span>TENANT:</span>
                <span className="font-mono uppercase">{user.bank_id}</span>
              </div>
            )}

            {/* Quick Citizen Portal Button on mobile/tablet */}
            <button
              onClick={() => onSelectTab(currentTab === 'victim' ? 'cases' : 'victim')}
              className={cn(
                'hidden sm:flex lg:hidden items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 border-[#09090B] text-xs font-bold uppercase tracking-wider shadow-hard-sm transition-all hover:bg-[#D2E823]',
                currentTab === 'victim' ? 'bg-[#09090B] text-[#D2E823]' : 'bg-[#D2E823] text-[#09090B]'
              )}
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>{currentTab === 'victim' ? 'EXIT' : 'CITIZEN'}</span>
            </button>

            {/* Interactive Demo Walkthrough Trigger */}
            {onOpenWalkthrough && (
              <button
                type="button"
                onClick={onOpenWalkthrough}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border-2 border-[#09090B] bg-[#D2E823] text-[#09090B] shadow-hard-sm hover:bg-[#F8F4E8] hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer text-xs font-bold uppercase tracking-wider transition-all"
                title="Open Interactive Demo Walkthrough & Scenarios"
                aria-label="Open Demo Walkthrough"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#09090B]" />
                <span className="hidden sm:inline">DEMO TOUR</span>
                <span className="sm:hidden font-mono">TOUR</span>
              </button>
            )}

            {/* Account & Role Switcher */}
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowUserMenu((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={showUserMenu}
                  aria-label={`Role menu for ${user.name}`}
                  className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1.5 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard-sm hover:bg-[#D2E823] transition-colors cursor-pointer text-left"
                >
                  <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-[#09090B] text-[#D2E823] flex items-center justify-center font-['Dela_Gothic_One'] text-[11px] sm:text-xs border border-[#09090B] shrink-0">
                    {user.name.charAt(0)}
                  </span>
                  <div className="hidden sm:block">
                    <span className="block text-xs font-bold leading-tight uppercase text-[#09090B] truncate max-w-[100px]">{user.name}</span>
                    <span className="text-[10px] font-bold uppercase text-[#52525B]">
                      {user.role} {user.bank_id ? `(${user.bank_id})` : ''}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#09090B] transition-transform duration-150', showUserMenu && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>

                {/* Role Switcher Menu */}
                {showUserMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-3 w-72 sm:w-80 origin-top-right rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-4 shadow-hard-lg z-50 animate-in"
                  >
                    <div className="pb-3 border-b-2 border-[#09090B]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#52525B]">CURRENT OPERATOR</p>
                      <p className="text-sm font-['Dela_Gothic_One'] uppercase text-[#09090B]">{user.name}</p>
                      <p className="text-xs font-mono text-[#52525B] truncate">{user.email}</p>
                    </div>

                    <div className="py-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#09090B] mb-2 flex items-center gap-1.5">
                        <Layers className="w-4 h-4" /> SWITCH SIMULATED ROLE
                      </p>
                      <div className="space-y-1.5">
                        {DEMO_USERS.map((demo) => {
                          const isCurrent = user.id === demo.id;
                          return (
                            <button
                              key={demo.id}
                              role="menuitem"
                              onClick={() => {
                                login(demo.email, 'password');
                                setShowUserMenu(false);
                                if (demo.role === 'supervisor') onSelectTab('dashboard');
                                else if (demo.role === 'operator') onSelectTab('cases');
                                else if (demo.role === 'bank_viewer') onSelectTab('cases');
                              }}
                              className={cn(
                                'w-full flex items-center justify-between p-2 rounded-lg text-left text-xs font-bold border-2 transition-all cursor-pointer',
                                isCurrent
                                  ? 'bg-[#09090B] text-[#D2E823] border-[#09090B] shadow-hard-sm'
                                  : 'bg-transparent text-[#09090B] border-transparent hover:border-[#09090B] hover:bg-[#D2E823]'
                              )}
                            >
                              <div>
                                <span className="block font-bold uppercase">{demo.name}</span>
                                <span className="text-[10px] font-mono text-[#52525B]">
                                  {demo.role} {demo.bank_id ? `· ${demo.bank_id}` : '· Operations Center'}
                                </span>
                              </div>
                              {isCurrent && <ArrowRight className="w-3.5 h-3.5 text-[#D2E823]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Mobile Hamburger Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="lg:hidden flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl border-2 border-[#09090B] bg-[#D2E823] text-[#09090B] shadow-hard-sm hover:bg-[#EDE8D5] transition-all cursor-pointer"
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {isMobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>

        {/* Collapsible Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden pt-4 mt-3 border-t-2 border-[#09090B] space-y-3 animate-in">
            {onOpenWalkthrough && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onOpenWalkthrough();
                }}
                className="w-full py-2.5 px-3 rounded-xl border-2 border-[#09090B] bg-[#D2E823] text-[#09090B] shadow-hard-sm flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider hover:bg-[#F8F4E8] cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>OPEN DEMO WALKTHROUGH & SCENARIOS</span>
              </button>
            )}

            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#52525B]">
              OPERATIONS NAVIGATION
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {TABS.filter((tab) => !tab.roles || (user && tab.roles.includes(user.role))).map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                const isVictim = tab.id === 'victim';

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onSelectTab(tab.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={cn(
                      'flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border-2 transition-all cursor-pointer',
                      isActive
                        ? 'bg-[#09090B] text-[#D2E823] border-[#09090B] shadow-hard-sm'
                        : isVictim
                          ? 'bg-[#D2E823] text-[#09090B] border-[#09090B] shadow-hard-sm'
                          : 'bg-[#F8F4E8] text-[#09090B] border-[#09090B] hover:bg-[#EDE8D5]'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </div>
                    {tab.id === 'review' && pendingReviewCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FF334B] text-[#09090B] border border-[#09090B]">
                        {pendingReviewCount} PENDING
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Mobile Role Switcher for Judges & Evaluators */}
            <div className="pt-2 border-t-2 border-[#09090B]">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#52525B] mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" /> SWITCH SIMULATED ROLE
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {DEMO_USERS.map((demo) => {
                  const isCurrent = user?.id === demo.id;
                  return (
                    <button
                      key={demo.id}
                      onClick={() => {
                        login(demo.email, 'password');
                        setIsMobileMenuOpen(false);
                        if (demo.role === 'supervisor') onSelectTab('dashboard');
                        else if (demo.role === 'operator') onSelectTab('cases');
                        else if (demo.role === 'bank_viewer') onSelectTab('cases');
                      }}
                      className={cn(
                        'p-2 rounded-xl text-left border-2 transition-all cursor-pointer text-xs font-bold',
                        isCurrent
                          ? 'bg-[#09090B] text-[#D2E823] border-[#09090B] shadow-hard-sm'
                          : 'bg-[#F8F4E8] text-[#09090B] border-[#09090B] hover:bg-[#D2E823]'
                      )}
                    >
                      <span className="block truncate text-[11px] uppercase">{demo.name}</span>
                      <span className="block text-[9px] font-mono text-[#52525B] truncate">{demo.role}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile Tenant Display if bank viewer */}
            {user?.role === 'bank_viewer' && user.bank_id && (
              <div className="p-2.5 rounded-xl bg-[#D2E823] text-[#09090B] font-bold text-xs border-2 border-[#09090B] flex items-center justify-between">
                <span>ASSIGNED TENANT BANK:</span>
                <span className="font-mono uppercase">{user.bank_id}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
