import { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DEMO_USERS } from '@/services/mockData';
import { USE_MOCK } from '@/services/api';
import {
  ShieldAlert,
  Inbox,
  BrainCircuit,
  BarChart3,
  History,
  LifeBuoy,
  UserCheck,
  LogOut,
  ChevronDown,
  Layers,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'cases' | 'review' | 'dashboard' | 'audit' | 'victim';
  onSelectTab: (tab: 'cases' | 'review' | 'dashboard' | 'audit' | 'victim') => void;
}

export function Navbar({ currentTab, onSelectTab }: NavbarProps) {
  const { user, login, logout } = useAuthStore();
  const { queue } = useReviewQueueStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const pendingReviewCount = queue.length;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo & Network Brand */}
          <div className="flex items-center gap-6">
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => onSelectTab('cases')}
            >
              <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-foreground flex items-center gap-1.5">
                  ReliefOps
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                    v0.3.0
                  </span>
                </span>
                <p className="text-[11px] text-muted-foreground font-medium -mt-0.5">
                  Five-Bank Fraud Relief Center
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={() => onSelectTab('cases')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  currentTab === 'cases'
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <Inbox className="w-4 h-4" />
                Case Roster
              </button>

              <button
                onClick={() => onSelectTab('review')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors relative cursor-pointer ${
                  currentTab === 'review'
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <BrainCircuit className="w-4 h-4" />
                AI Review Queue
                {pendingReviewCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                    {pendingReviewCount}
                  </span>
                )}
              </button>

              {user?.role !== 'operator' && (
                <button
                  onClick={() => onSelectTab('dashboard')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    currentTab === 'dashboard'
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Supervisor KPI
                </button>
              )}

              <button
                onClick={() => onSelectTab('audit')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  currentTab === 'audit'
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <History className="w-4 h-4" />
                Audit Trail
              </button>

              <button
                onClick={() => onSelectTab('victim')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  currentTab === 'victim'
                    ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold'
                    : 'text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40'
                }`}
              >
                <LifeBuoy className="w-4 h-4" />
                Victim Self-Service
              </button>
            </nav>
          </div>

          {/* Right Controls: Mock Indicator & Account Switcher */}
          <div className="flex items-center gap-3">
            {/* Mock / Live Badge */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                USE_MOCK
                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
              }`}
              title="Toggle USE_MOCK in src/services/api.ts"
            >
              <span className={`w-2 h-2 rounded-full ${USE_MOCK ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
              {USE_MOCK ? 'Mock API Active' : 'Live API Connected'}
            </div>

            {/* User Profile & Demo Switcher */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors border border-border cursor-pointer text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                    {user.name.charAt(0)}
                  </div>
                  <div className="hidden lg:block">
                    <p className="text-xs font-semibold leading-tight text-foreground">{user.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                        {user.role}
                      </Badge>
                      {user.bank_id && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {user.bank_id}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>

                {/* Dropdown Menu with 1-Click Demo Switch */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-card p-3 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="pb-2 border-b border-border">
                      <p className="text-xs text-muted-foreground">Signed in as</p>
                      <p className="text-sm font-bold text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>

                    <div className="py-2">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Layers className="w-3 h-3" /> Quick Switch Demo Role
                      </p>
                      <div className="space-y-1">
                        {DEMO_USERS.map((demo) => (
                          <button
                            key={demo.id}
                            onClick={async () => {
                              await login(demo.email);
                              setShowUserMenu(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                              user.id === demo.id
                                ? 'bg-primary/10 text-primary font-bold'
                                : 'hover:bg-muted text-foreground'
                            }`}
                          >
                            <span className="truncate">{demo.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {demo.role}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border flex justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          await logout();
                          setShowUserMenu(false);
                        }}
                        className="text-destructive hover:text-destructive text-xs w-full justify-start"
                      >
                        <LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => login('operator1@opscenter.test')}
              >
                <UserCheck className="w-4 h-4 mr-1.5" /> Staff Login
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
