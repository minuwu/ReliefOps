import { cn } from '@/lib/utils';

interface MarqueeProps {
  items: React.ReactNode[];
  speed?: string;
  className?: string;
}

export function Marquee({ items, speed = '20s', className }: MarqueeProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden w-full max-w-full border-y-2 border-[#09090B] bg-[#09090B] text-[#D2E823] py-2.5 select-none',
        className
      )}
    >
      <div
        className="flex w-max animate-marquee gap-8 whitespace-nowrap will-change-transform font-['Space_Grotesk'] font-bold text-xs uppercase tracking-widest"
        style={{ animationDuration: speed }}
      >
        {/* Render 2 copies so continuous loop never breaks */}
        {items.map((item, i) => (
          <div key={`m1-${i}`} className="flex items-center gap-8">
            <span>{item}</span>
            <span className="text-[#F8F4E8]/40" aria-hidden="true">✦</span>
          </div>
        ))}
        {items.map((item, i) => (
          <div key={`m2-${i}`} className="flex items-center gap-8">
            <span>{item}</span>
            <span className="text-[#F8F4E8]/40" aria-hidden="true">✦</span>
          </div>
        ))}
      </div>
    </div>
  );
}
