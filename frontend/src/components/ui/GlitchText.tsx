import { useState } from 'react';
import { cn } from '@/lib/utils';

interface GlitchTextProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'span' | 'div';
  className?: string;
}

export function GlitchText({
  children,
  as: Component = 'span',
  className,
  ...props
}: GlitchTextProps) {
  const [isGlitching, setIsGlitching] = useState(false);

  return (
    <Component
      onMouseEnter={() => setIsGlitching(true)}
      onMouseLeave={() => setIsGlitching(false)}
      className={cn(
        'font-["Dela_Gothic_One",cursive,sans-serif] uppercase tracking-tighter transition-colors select-none inline-block',
        isGlitching && 'animate-[glitch_0.3s_infinite]',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
