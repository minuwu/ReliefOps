import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link' | 'acid';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-["Space_Grotesk",sans-serif] font-bold text-xs uppercase tracking-wider transition-all duration-120 select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0';

    const variants = {
      primary:
        'bg-[#09090B] text-[#D2E823] border-2 border-[#09090B] hover:bg-[#1a1a1f]',
      secondary:
        'bg-[#D2E823] text-[#09090B] border-2 border-[#09090B] hover:bg-[#e4fc28]',
      acid:
        'bg-[#D2E823] text-[#09090B] border-2 border-[#09090B] hover:bg-[#e4fc28]',
      outline:
        'bg-[#F8F4E8] text-[#09090B] border-2 border-[#09090B] hover:bg-[#D2E823]',
      destructive:
        'bg-[#FF334B] text-[#09090B] border-2 border-[#09090B] hover:bg-[#ff4f63]',
      ghost:
        'bg-transparent text-[#09090B] hover:bg-[#D2E823]/30 border-2 border-transparent hover:border-[#09090B]',
      link:
        'bg-transparent text-[#09090B] hover:text-[#09090B] hover:bg-[#D2E823] underline p-0 h-auto border-0 shadow-none',
    };

    const sizeStyles = {
      sm: 'h-8 px-3 py-1 text-[11px] gap-1.5 rounded-lg shadow-hard-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#09090B] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none',
      md: 'h-10 px-5 py-2 text-xs gap-2 rounded-xl shadow-hard hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
      lg: 'h-13 px-8 py-4 text-sm gap-2.5 rounded-xl shadow-hard-lg hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-hard active:translate-x-[8px] active:translate-y-[8px] active:shadow-none',
      icon: 'h-9 w-9 p-0 rounded-lg shadow-hard-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px]',
    };

    const isLink = variant === 'link';

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          !isLink && sizeStyles[size],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
