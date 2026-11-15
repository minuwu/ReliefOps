import React from 'react';
import { cn } from '@/lib/utils';
import { CaseStatus, DeadlineState, ReviewLane } from '@/types/api';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info' | 'acid';
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
  let computedClass =
    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-transform duration-100 border-2 border-[#09090B] shadow-[1px_1px_0px_0px_#09090B] font-["Space_Grotesk",sans-serif]';

  if (status) {
    switch (status) {
      case 'received':
        computedClass = cn(computedClass, 'bg-[#E4E4E7] text-[#09090B]');
        break;
      case 'verified':
        computedClass = cn(computedClass, 'bg-[#93C5FD] text-[#09090B]');
        break;
      case 'account_check':
        computedClass = cn(computedClass, 'bg-[#D8B4FE] text-[#09090B]');
        break;
      case 'notice_published':
        computedClass = cn(computedClass, 'bg-[#FDE68A] text-[#09090B]');
        break;
      case 'payout_review':
        computedClass = cn(computedClass, 'bg-[#A7F3D0] text-[#09090B]');
        break;
      case 'closed':
        computedClass = cn(computedClass, 'bg-[#86EFAC] text-[#09090B]');
        break;
    }
  } else if (deadlineState) {
    switch (deadlineState) {
      case 'on_track':
        computedClass = cn(computedClass, 'bg-[#86EFAC] text-[#09090B]');
        break;
      case 'due_soon':
        computedClass = cn(computedClass, 'bg-[#FBBF24] text-[#09090B]');
        break;
      case 'overdue':
        computedClass = cn(computedClass, 'bg-[#FF334B] text-[#09090B] animate-pulse');
        break;
      case 'none':
        computedClass = cn(computedClass, 'bg-[#E4E4E7] text-[#52525B]');
        break;
    }
  } else if (reviewLane) {
    switch (reviewLane) {
      case 'standard':
        computedClass = cn(computedClass, 'bg-[#E4E4E7] text-[#09090B]');
        break;
      case 'low_confidence':
        computedClass = cn(computedClass, 'bg-[#FF334B] text-[#09090B]');
        break;
    }
  } else {
    switch (variant) {
      case 'acid':
        computedClass = cn(computedClass, 'bg-[#D2E823] text-[#09090B]');
        break;
      case 'secondary':
        computedClass = cn(computedClass, 'bg-[#EDE8D5] text-[#09090B]');
        break;
      case 'destructive':
        computedClass = cn(computedClass, 'bg-[#FF334B] text-[#09090B]');
        break;
      case 'success':
        computedClass = cn(computedClass, 'bg-[#86EFAC] text-[#09090B]');
        break;
      case 'warning':
        computedClass = cn(computedClass, 'bg-[#FBBF24] text-[#09090B]');
        break;
      case 'info':
        computedClass = cn(computedClass, 'bg-[#93C5FD] text-[#09090B]');
        break;
      case 'outline':
        computedClass = cn(computedClass, 'bg-transparent text-[#09090B]');
        break;
      default:
        computedClass = cn(computedClass, 'bg-[#09090B] text-[#D2E823]');
    }
  }

  return (
    <span className={cn(computedClass, className)} {...props}>
      {children}
    </span>
  );
}
