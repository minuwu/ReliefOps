import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { Role, User } from '@/types/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { toast } from '@/store/useToastStore';
import { StickerBadge } from '@/components/ui/StickerBadge';
import { GlitchText } from '@/components/ui/GlitchText';
import { USE_MOCK, errorMessage } from '@/services/http';
import { DEMO_PASSWORD, DEMO_USERS, DEMO_VICTIMS } from '@/services/mockData';
import { PATHS, homeFor } from '@/routes/paths';
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
  LogOut,
  LogIn,
  Users,
  FilePlus2,
} from 'lucide-react';

interface NavbarProps {
  onOpenWalkthrough?: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  badge?: 'review';
}

const NAV_ITEMS: NavItem[] = [
  { to: PATHS.dashboard, label: 'CONTROL TOWER', icon: BarChart3, roles: ['supervisor', 'bank_viewer'] },
  { to: PATHS.cases, label: 'CASE WORKSTATION', icon: Inbox, roles: ['operator', 'supervisor', 'bank_viewer'] },
  { to: PATHS.review, label: 'HITL AI OCR', icon: BrainCircuit, roles: ['operator', 'supervisor'], badge: 'review' },
  { to: PATHS.audit, label: 'AUDIT LEDGER', icon: History, roles: ['supervisor', 'bank_viewer'] },
  { to: PATHS.adminUsers, label: 'TEAM', icon: Users, roles: ['supervisor'] },
  { to: PATHS.portal, label: 'MY CASES', icon: LifeBuoy, roles: ['victim'] },
  { to: PATHS.portalReport, label: 'REPORT A SCAM', icon: FilePlus2, roles: ['victim'] },
];

/** Seeded accounts for the demo switcher. Unverified victim3 is left out: it cannot log in. */
const DEMO_ACCOUNTS: User[] = [...DEMO_USERS, ...DEMO_VICTIMS.filter((v) => v.email_verified)];

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-120 cursor-pointer border-2',
    isActive
      ? 'bg-[#09090B] text-[#D2E823] border-[#09090B] shadow-hard-sm translate-x-[1px] translate-y-[1px]'
      : 'bg-transparent text-[#09090B] border-transparent hover:border-[#09090B] hover:bg-[#D2E823] hover:shadow-hard-sm'
  );

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border-2 transition-all cursor-pointer',
    isActive
      ? 'bg-[#09090B] text-[#D2E823] border-[#09090B] shadow-hard-sm'
      : 'bg-[#F8F4E8] text-[#09090B] border-[#09090B] hover:bg-[#EDE8D5]'
  );

function ReviewBadge({ count, long }: { count: number; long?: boolean }) {
  if (count <= 0) return null;
  return (
    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#FF334B] text-[#09090B] border border-[#09090B]">
      {count}
      {long ? ' PENDING' : ''}
    </span>
  );
}

export function Navbar({ onOpenWalkthrough }: NavbarProps) {
  const { user, login, logout } = useAuthStore();
  const pendingReviewCount = useReviewQueueStore((s) => s.queue.length);
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const items = user ? NAV_ITEMS.filter((item) => item.roles.includes(user.role)) : [];

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

  const closeMenus = () => {
    setShowUserMenu(false);
    setIsMobileMenuOpen(false);
  };

  const switchAccount = async (account: User) => {
    closeMenus();
    try {
      const next = await login(account.email, DEMO_PASSWORD);
      navigate(homeFor(next.role));
    } catch (err) {
      toast(errorMessage(err, 'Could not switch account.'), 'error');
    }
  };

  const handleLogout = async () => {
    closeMenus();
    await logout();
    navigate(PATHS.login);
  };

  const demoSwitcher = (compact: boolean) =>
    USE_MOCK && (
      <div className={compact ? 'pt-2 border-t-2 border-[#09090B]' : 'py-3'}>
        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#52525B] mb-2 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" /> DEMO ACCOUNTS (MOCK MODE)
        </p>
        <div className={compact ? 'grid grid-cols-2 gap-1.5' : 'space-y-1.5 max-h-64 overflow-y-auto'}>
          {DEMO_ACCOUNTS.map((demo) => {
            const isCurrent = user?.id === demo.id;
            return (
              <button
                key={demo.id}
                type="button"
                role="menuitem"
                onClick={() => void switchAccount(demo)}
                className={cn(
                  'w-full flex items-center justify-between p-2 rounded-lg text-left text-xs font-bold border-2 transition-all cursor-pointer',
                  isCurrent
                    ? 'bg-[#09090B] text-[#D2E823] border-[#09090B] shadow-hard-sm'
                    : 'bg-transparent text-[#09090B] border-transparent hover:border-[#09090B] hover:bg-[#D2E823]'
                )}
              >
                <div className="min-w-0">
                  <span className="block font-bold uppercase truncate">{demo.name}</span>
                  <span className="block text-[10px] font-mono text-[#52525B] truncate">
                    {demo.role} {demo.bank_id ? `· ${demo.bank_id}` : ''}
                  </span>
                </div>
                {isCurrent && <ArrowRight className="w-3.5 h-3.5 text-[#D2E823] shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    );

  return (
    <header className="sticky top-2 sm:top-4 z-40 mx-2 sm:mx-6 lg:mx-8 mb-4 sm:mb-6">
      <div className="rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard px-3 sm:px-6 py-2.5 sm:py-3 transition-all duration-150">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <Link
              to={homeFor(user?.role)}
              className="flex shrink-0 items-center gap-2.5 sm:gap-3 cursor-pointer text-left group"
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
            </Link>

            <nav aria-label="Primary" className="hidden lg:flex items-center gap-1.5 ml-2">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} end={item.to === PATHS.portal} className={desktopLinkClass}>
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.badge === 'review' && <ReviewBadge count={pendingReviewCount} />}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {user?.role === 'bank_viewer' && user.bank_id && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D2E823] text-[#09090B] font-bold text-xs border-2 border-[#09090B] shadow-hard-sm">
                <span>TENANT:</span>
                <span className="font-mono uppercase">{user.bank_id}</span>
              </div>
            )}

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

            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowUserMenu((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={showUserMenu}
                  aria-label={`Account menu for ${user.name}`}
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

                {showUserMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-3 w-72 sm:w-80 origin-top-right rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-4 shadow-hard-lg z-50 animate-in"
                  >
                    <div className="pb-3 border-b-2 border-[#09090B]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#52525B]">SIGNED IN AS</p>
                      <p className="text-sm font-['Dela_Gothic_One'] uppercase text-[#09090B]">{user.name}</p>
                      <p className="text-xs font-mono text-[#52525B] truncate">{user.email}</p>
                    </div>
                    {demoSwitcher(false)}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleLogout()}
                      className="mt-2 w-full flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-bold uppercase border-2 border-[#09090B] bg-[#09090B] text-[#D2E823] hover:bg-[#FF334B] hover:text-[#09090B] cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> LOG OUT
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to={PATHS.login}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-[#09090B] bg-[#09090B] text-[#D2E823] shadow-hard-sm text-xs font-bold uppercase tracking-wider hover:bg-[#D2E823] hover:text-[#09090B]"
              >
                <LogIn className="w-3.5 h-3.5" /> LOG IN
              </Link>
            )}

            {user && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                className="lg:hidden flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl border-2 border-[#09090B] bg-[#D2E823] text-[#09090B] shadow-hard-sm hover:bg-[#EDE8D5] transition-all cursor-pointer"
                aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            )}
          </div>
        </div>

        {isMobileMenuOpen && user && (
          <div className="lg:hidden pt-4 mt-3 border-t-2 border-[#09090B] space-y-3 animate-in">
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#52525B]">NAVIGATION</p>
            <nav aria-label="Primary mobile" className="grid grid-cols-1 gap-1.5">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === PATHS.portal}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={mobileLinkClass}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge === 'review' && <ReviewBadge count={pendingReviewCount} long />}
                  </NavLink>
                );
              })}
            </nav>

            {demoSwitcher(true)}

            {user.role === 'bank_viewer' && user.bank_id && (
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
