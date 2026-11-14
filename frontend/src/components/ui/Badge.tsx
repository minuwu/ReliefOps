import React from 'react';
import { cn } from '@/lib/utils';
import { CaseStatus, DeadlineState, ReviewLane } from '@/types/api';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info';
  status?: CaseStatus;
  deadlineState?: DeadlineState;
  reviewLane?: ReviewLane;
}

export function Badge({
  className,
  variant = 'default',
  status,
  deadlineState,
  reviewLane,
  children,
  ...props
}: BadgeProps) {
  let computedClass = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors';

  if (status) {
    switch (status) {
      case 'received':
        computedClass = cn(computedClass, 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700');
        break;
      case 'verified':
        computedClass = cn(computedClass, 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800');
        break;
      case 'account_check':
        computedClass = cn(computedClass, 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800');
        break;
      case 'notice_published':
        computedClass = cn(computedClass, 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800');
        break;
      case 'payout_review':
        computedClass = cn(computedClass, 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800');
        break;
      case 'closed':
        computedClass = cn(computedClass, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800');
        break;
    }
  } else if (deadlineState) {
    switch (deadlineState) {
      case 'on_track':
        computedClass = cn(computedClass, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300');
        break;
      case 'due_soon':
        computedClass = cn(computedClass, 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 animate-pulse');
        break;
      case 'overdue':
        computedClass = cn(computedClass, 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold');
        break;
      case 'none':
        computedClass = cn(computedClass, 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400');
        break;
    }
  } else if (reviewLane) {
    switch (reviewLane) {
      case 'standard':
        computedClass = cn(computedClass, 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300');
        break;
      case 'low_confidence':
        computedClass = cn(computedClass, 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-medium');
        break;
    }
  } else {
    switch (variant) {
      case 'default':
        computedClass = cn(computedClass, 'bg-primary text-primary-foreground');
        break;
      case 'secondary':
        computedClass = cn(computedClass, 'bg-secondary text-secondary-foreground');
        break;
      case 'outline':
        computedClass = cn(computedClass, 'border border-border text-foreground');
        break;
      case 'destructive':
        computedClass = cn(computedClass, 'bg-destructive/10 text-destructive border border-destructive/20');
        break;
      case 'success':
        computedClass = cn(computedClass, 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300');
        break;
      case 'warning':
        computedClass = cn(computedClass, 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300');
        break;
      case 'info':
        computedClass = cn(computedClass, 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300');
        break;
    }
  }

  return (
    <span className={cn(computedClass, className)} {...props}>
      {children}
    </span>
  );
}
