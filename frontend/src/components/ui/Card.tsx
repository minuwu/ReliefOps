import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  shadowSize?: 'sm' | 'md' | 'lg' | 'none';
  variant?: 'paper' | 'dark' | 'acid';
}

export function Card({
  className,
  hoverable = false,
  shadowSize = 'md',
  variant = 'paper',
  ...props
}: CardProps) {
  const shadowStyles = {
    none: 'shadow-none',
    sm: 'shadow-hard-sm',
    md: 'shadow-hard',
    lg: 'shadow-hard-lg',
  };

  const variantStyles = {
    paper: 'bg-[#F8F4E8] text-[#09090B] border-2 border-[#09090B]',
    dark: 'bg-[#09090B] text-[#F8F4E8] border-2 border-[#09090B]',
    acid: 'bg-[#D2E823] text-[#09090B] border-2 border-[#09090B]',
  };

  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-150',
        variantStyles[variant],
        shadowStyles[shadowSize],
        hoverable && 'hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-hard-sm',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'font-bold tracking-tight text-base sm:text-lg text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-xs sm:text-sm text-[#52525B] font-["Space_Grotesk",sans-serif]', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-0 font-["Space_Grotesk",sans-serif]', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center p-6 pt-0 font-["Space_Grotesk",sans-serif]', className)} {...props} />;
}
