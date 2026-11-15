import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { FileText, MessageSquare, History, LayoutDashboard } from 'lucide-react';

export type CaseDetailTab = 'overview' | 'documents' | 'messages' | 'history';

export interface CaseDetailTabsProps {
  activeTab: CaseDetailTab;
  onTabChange: (tab: CaseDetailTab) => void;
  documentCount?: number;
  hasPendingQuestion?: boolean;
}

interface TabDef {
  id: CaseDetailTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  badge?: string;
}

export function CaseDetailTabs({
  activeTab,
  onTabChange,
  documentCount,
  hasPendingQuestion,
}: CaseDetailTabsProps) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const tabs: TabDef[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'documents', label: 'Documents', icon: FileText, count: documentCount },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageSquare,
      badge: hasPendingQuestion ? 'Action' : undefined,
    },
    { id: 'history', label: 'History', icon: History },
  ];

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    onTabChange(tabs[nextIndex].id);
    const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
  };

  return (
    <div
      ref={tabListRef}
      role="tablist"
      aria-label="Case details sections"
      className="flex items-center gap-1 sm:gap-2 border-b border-[#09090B]/15 pb-2 overflow-x-auto"
    >
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap',
              isActive
                ? 'bg-[#09090B] text-[#D2E823]'
                : 'text-[#52525B] hover:text-[#09090B] hover:bg-[#EDE8D5]'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'ml-1 px-1.5 py-0.2 rounded text-xs font-mono font-bold',
                  isActive ? 'bg-[#18181B] text-[#D2E823]' : 'bg-[#EDE8D5] text-[#52525B]'
                )}
              >
                {tab.count}
              </span>
            )}
            {tab.badge && (
              <span className="ml-1 px-1.5 py-0.2 rounded text-xs font-bold bg-[#FF334B] text-[#09090B]">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
