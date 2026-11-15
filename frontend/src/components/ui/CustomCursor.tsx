import { useEffect, useState } from 'react';

export function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [target, setTarget] = useState({ x: -100, y: -100 });
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only enable on desktop pointer devices
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const handleMouseMove = (e: MouseEvent) => {
      setTarget({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);

      const targetElement = e.target as HTMLElement | null;
      if (targetElement) {
        const isInteractive = Boolean(
          targetElement.closest('button, a, input, select, textarea, [role="button"], [data-cursor-hover]')
        );
        setIsHovered(isInteractive);
      }
    };

    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isVisible]);

  // Smooth follow with 0.2 lerp interpolation
  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      setPosition((prev) => {
        const dx = target.x - prev.x;
        const dy = target.y - prev.y;
        return {
          x: prev.x + dx * 0.2,
          y: prev.y + dy * 0.2,
        };
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [target]);

  if (!isVisible) return null;

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 z-[9999] rounded-full bg-white transition-transform duration-150 ease-out will-change-transform"
      style={{
        width: '32px',
        height: '32px',
        transform: `translate3d(${position.x - 16}px, ${position.y - 16}px, 0) scale(${isHovered ? 2.5 : 1})`,
        mixBlendMode: 'difference',
      }}
    />
  );
}
