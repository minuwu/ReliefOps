import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ShieldAlert, Inbox, BrainCircuit, BarChart3, History, LifeBuoy, ChevronDown,
  Layers, Sparkles, ArrowRight, Menu, X, LogOut, LogIn, Users, FilePlus2, BookOpen
} from 'lucide-react';
import type { Role, User } from '@/types/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { toast } from '@/store/useToastStore';
import { USE_MOCK, errorMessage } from '@/services/http';
import { DEMO_PASSWORD, DEMO_USERS, DEMO_VICTIMS } from '@/services/mockData';
import { PATHS, homeFor } from '@/routes/paths';
import { cn } from '@/lib/utils';

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
  { to: PATHS.dashboard, label: 'Dashboard', icon: BarChart3, roles: ['supervisor', 'bank_viewer'] },
  { to: PATHS.cases, label: 'Cases', icon: Inbox, roles: ['operator', 'supervisor', 'bank_viewer'] },
  { to: PATHS.review, label: 'Review queue', icon: BrainCircuit, roles: ['operator', 'supervisor'], badge: 'review' },
  { to: PATHS.audit, label: 'Audit log', icon: History, roles: ['supervisor', 'bank_viewer'] },
  { to: PATHS.knowledge, label: 'Knowledge base', icon: BookOpen, roles: ['operator', 'supervisor', 'bank_viewer'] },
  { to: PATHS.adminUsers, label: 'Team', icon: Users, roles: ['supervisor'] },
  { to: PATHS.portal, label: 'My cases', icon: LifeBuoy, roles: ['victim'] },
  { to: PATHS.portalReport, label: 'Report a scam', icon: FilePlus2, roles: ['victim'] },
];

/** Seeded accounts for demo switcher. Unverified victim3 cannot log in. */
const DEMO_ACCOUNTS: User[] = [...DEMO_USERS, ...DEMO_VICTIMS.filter((v) => v.email_verified)];

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer border',
    isActive
      ? 'bg-[#D2E823] text-[#09090B] border-[#09090B]'
      : 'bg-transparent text-[#09090B] border-transparent hover:bg-[#EDE8D5]'
  );

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer',
    isActive
      ? 'bg-[#D2E823] text-[#09090B] border-[#09090B]'
      : 'bg-transparent text-[#09090B] border-transparent hover:bg-[#EDE8D5]'
  );

function ReviewBadge({ count, long }: { count: number; long?: boolean }) {
  if (count <= 0) return null;
  return (
    <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-[#09090B] text-[#D2E823] border border-[#09090B] leading-none">
      {count}
      {long ? ' pending' : ''}
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
      <div className={compact ? 'pt-2 border-t border-[#09090B]/15' : 'py-2.5'}>
        <p className="text-xs font-semibold text-[#52525B] mb-1.5 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" />
          <span>Demo accounts</span>
        </p>
        <div className={compact ? 'grid grid-cols-2 gap-1.5' : 'space-y-1 max-h-60 overflow-y-auto'}>
          {DEMO_ACCOUNTS.map((demo) => {
            const isCurrent = user?.id === demo.id;
            return (
              <button
                key={demo.id}
                type="button"
                role="menuitem"
                onClick={() => void switchAccount(demo)}
                className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left text-xs transition-colors cursor-pointer border',
                  isCurrent
                    ? 'bg-[#D2E823] text-[#09090B] border-[#09090B] font-semibold'
                    : 'bg-transparent text-[#09090B] border-transparent hover:bg-[#EDE8D5]'
                )}
              >
                <div className="min-w-0">
                  <span className="block truncate">{demo.name}</span>
                  <span className="block text-xs text-[#52525B] truncate">
                    {demo.role} {demo.bank_id ? `· ${demo.bank_id}` : ''}
                  </span>
                </div>
                {isCurrent && <ArrowRight className="w-3.5 h-3.5 text-[#09090B] shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    );

  return (
    <header className="sticky top-0 z-40 w-full bg-[#F8F4E8] border-b-2 border-[#09090B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <Link
              to={homeFor(user?.role)}
              className="flex shrink-0 items-center gap-2.5 cursor-pointer text-left"
              aria-label="ReliefOps home"
            >
              <span className="w-8 h-8 rounded-lg bg-[#09090B] text-[#D2E823] flex items-center justify-center border border-[#09090B] shrink-0">
                <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
              </span>
              <span className="font-['Dela_Gothic_One'] text-base sm:text-lg tracking-tight text-[#09090B] leading-none">
                RELIEFOPS
              </span>
            </Link>

            <nav aria-label="Primary" className="hidden lg:flex items-center gap-1.5">
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
            {onOpenWalkthrough && (
              <button
                type="button"
                onClick={onOpenWalkthrough}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#09090B] bg-transparent hover:bg-[#EDE8D5] text-[#09090B] text-xs font-semibold cursor-pointer transition-colors"
                title="Open Demo Walkthrough & Scenario Guide"
                aria-label="Open Demo Walkthrough"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#09090B]" />
                <span className="hidden sm:inline">Demo guide</span>
                <span className="sm:hidden">Guide</span>
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
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-lg border border-[#09090B] bg-transparent hover:bg-[#EDE8D5] transition-colors cursor-pointer text-left"
                >
                  <span className="text-xs font-semibold text-[#09090B] truncate max-w-[120px]">{user.name}</span>
                  <span className="text-xs text-[#52525B]">
                    ({user.bank_id ? user.bank_id.toUpperCase() : user.role.replace('_', ' ')})
                  </span>
                  <ChevronDown
                    className={cn('w-3.5 h-3.5 text-[#09090B] transition-transform duration-150', showUserMenu && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>

                {showUserMenu && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-72 sm:w-80 origin-top-right rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] p-3 shadow-hard z-50 animate-in"
                  >
                    <div className="pb-2.5 border-b border-[#09090B]/15">
                      <p className="text-xs text-[#52525B]">Signed in as</p>
                      <p className="text-sm font-semibold text-[#09090B]">{user.name}</p>
                      <p className="text-xs text-[#52525B] truncate">{user.email}</p>
                    </div>
                    {demoSwitcher(false)}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleLogout()}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold border border-[#09090B] bg-[#09090B] text-[#F8F4E8] hover:bg-[#27272A] cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to={PATHS.login}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#09090B] bg-[#09090B] text-[#F8F4E8] text-xs font-semibold hover:bg-[#27272A] transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log in</span>
              </Link>
            )}

            {user && (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((open) => !open)}
                className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg border border-[#09090B] bg-transparent hover:bg-[#EDE8D5] text-[#09090B] transition-colors cursor-pointer"
                aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {isMobileMenuOpen && user && (
          <div className="lg:hidden pt-3 mt-3 border-t border-[#09090B]/15 space-y-2">
            <nav aria-label="Primary mobile" className="grid grid-cols-1 gap-1">
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
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge === 'review' && <ReviewBadge count={pendingReviewCount} long />}
                  </NavLink>
                );
              })}
            </nav>
            {demoSwitcher(true)}
          </div>
        )}
      </div>
    </header>
  );
}
