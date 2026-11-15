import { cn } from '@/lib/utils';

interface StickerBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  rotate?: string;
  className?: string;
  variant?: 'acid' | 'dark' | 'coral' | 'paper';
}

export function StickerBadge({
  children,
  rotate = '-rotate-2',
  className,
  variant = 'acid',
  ...props
}: StickerBadgeProps) {
  const variantStyles = {
    acid: 'bg-[#D2E823] text-[#09090B] border-[#09090B]',
    dark: 'bg-[#09090B] text-[#D2E823] border-[#09090B]',
    coral: 'bg-[#FF334B] text-[#09090B] border-[#09090B]',
    paper: 'bg-[#F8F4E8] text-[#09090B] border-[#09090B]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
        'border-2 shadow-hard-sm transition-transform duration-150 select-none hover:rotate-0 hover:scale-105',
        'font-["Space_Grotesk",sans-serif]',
        variantStyles[variant],
        rotate,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
