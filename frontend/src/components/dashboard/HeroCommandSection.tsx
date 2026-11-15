import { GlitchText } from '@/components/ui/GlitchText';
import { StickerBadge } from '@/components/ui/StickerBadge';
import { Button } from '@/components/ui/Button';
import { ShieldAlert, ArrowRight, BrainCircuit, Lock, Clock } from 'lucide-react';

interface HeroCommandSectionProps {
  onOpenIntake?: () => void;
  onOpenReview?: () => void;
  overdueCount: number;
}

export function HeroCommandSection({
  onOpenIntake,
  onOpenReview,
  overdueCount,
}: HeroCommandSectionProps) {
  return (
    <section className="relative my-4 sm:my-8 font-['Space_Grotesk',sans-serif]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Side: 7 Columns */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <StickerBadge variant="acid" rotate="-rotate-2" className="text-[11px] sm:text-xs py-0.5 sm:py-1 px-3 sm:px-3.5">
              JAPAN FURIKOME SAGI RELIEF ACT
            </StickerBadge>
            <span className="text-[11px] sm:text-xs font-mono font-bold uppercase text-[#52525B]">
              5 REGIONAL BANKS COOPERATIVE
            </span>
          </div>

          {/* Massive Display Text with Glitch-On-Hover and Fluid Clamp */}
          <div className="space-y-1">
            <GlitchText
              as="h1"
              className="text-[clamp(1.5rem,6.5vw,4.5rem)] font-['Dela_Gothic_One'] text-[#09090B] leading-[0.95] block tracking-tighter break-words"
            >
              FAST-TRACK
            </GlitchText>
            <GlitchText
              as="h1"
              className="text-[clamp(1.5rem,6.5vw,4.5rem)] font-['Dela_Gothic_One'] text-[#09090B] leading-[0.95] block tracking-tighter break-words"
            >
              RELIEF DISPATCH
            </GlitchText>
          </div>

          <p className="text-xs sm:text-base text-[#52525B] max-w-xl font-medium leading-relaxed">
            Eliminating 6-to-12 month restitution delays. The shared operations clearinghouse coordinating automated document OCR triage, multi-bank mule freezes, and statutory pro-rata victim distributions.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 w-full sm:w-auto">
            {onOpenIntake && (
              <Button
                variant="primary"
                size="lg"
                onClick={onOpenIntake}
                className="shadow-hard-lg hover:shadow-hard text-xs sm:text-sm gap-2 justify-center w-full sm:w-auto"
              >
                <span>OPEN NEW CASE INTAKE</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}

            <Button
              variant="secondary"
              size="lg"
              onClick={onOpenReview}
              className="shadow-hard-lg hover:shadow-hard text-xs sm:text-sm gap-2 justify-center w-full sm:w-auto"
            >
              <BrainCircuit className="w-4 h-4" />
              <span>HITL AI OCR QUEUE</span>
            </Button>
          </div>
        </div>

        {/* Right Side: 5 Columns with Card & Floating Asset */}
        <div className="lg:col-span-5 relative">
          {/* Primary Card */}
          <div className="relative rounded-2xl sm:rounded-[32px] border-2 border-[#09090B] bg-[#F8F4E8] p-5 sm:p-7 shadow-hard-lg overflow-hidden bg-dot-pattern">
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b-2 border-[#09090B]">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#09090B] text-[#D2E823] flex items-center justify-center font-bold text-xs border border-[#09090B]">
                  <ShieldAlert className="w-4 h-4" />
                </span>
                <span className="font-['Dela_Gothic_One'] uppercase text-xs sm:text-sm text-[#09090B]">
                  STATUTORY CLEARINGHOUSE
                </span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] border border-[#09090B] animate-pulse" />
            </div>

            <div className="py-5 sm:py-6 space-y-4 font-mono text-xs">
              <div className="p-3.5 rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] shadow-hard-sm">
                <div className="flex justify-between text-[#52525B] mb-1">
                  <span>CONSORTIUM STATUS</span>
                  <span className="text-[#16A34A] font-bold">ALL 5 BANKS SYNCED</span>
                </div>
                <div className="font-bold text-[#09090B] text-xs sm:text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#09090B] shrink-0" />
                  <span className="truncate">AIR-GAPPED TENANT ISOLATION</span>
                </div>
              </div>

              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 sm:gap-3 text-center">
                <div className="p-2.5 sm:p-3 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard-sm">
                  <p className="text-[10px] text-[#52525B] font-bold">AVG RESOLUTION</p>
                  <p className="text-base sm:text-xl font-['Dela_Gothic_One'] text-[#09090B] mt-0.5">14 DAYS</p>
                  <p className="text-[9px] text-[#16A34A] font-bold">VS 180D LEGACY</p>
                </div>
                <div className="p-2.5 sm:p-3 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard-sm">
                  <p className="text-[10px] text-[#52525B] font-bold">AI OCR ACCURACY</p>
                  <p className="text-base sm:text-xl font-['Dela_Gothic_One'] text-[#09090B] mt-0.5">99.1%</p>
                  <p className="text-[9px] text-[#09090B] font-bold">WITH HUMAN HITL</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t-2 border-[#09090B] flex items-center justify-between text-[10px] sm:text-[11px] font-mono font-bold text-[#52525B]">
              <span>ACTIVE: LAW 133</span>
              <span className="text-[#09090B]">TOKYO OPERATIONS NODE</span>
            </div>
          </div>

          {/* Overlapping Floating Asset Card (Docked on Mobile, Floating on Tablet+) */}
          <div className="mt-4 sm:mt-0 sm:absolute sm:-bottom-8 sm:-left-8 z-20 sm:animate-float">
            <div className="rounded-2xl border-2 border-[#09090B] bg-[#D2E823] p-3.5 sm:p-4 shadow-hard sm:shadow-hard-lg w-full sm:max-w-[260px] font-['Space_Grotesk'] text-[#09090B]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider bg-[#09090B] text-[#D2E823] px-2 py-0.5 rounded border border-[#09090B]">
                  <Clock className="w-3 h-3" /> STATUTORY CLOCK
                </span>
                <span className="text-xs font-['Dela_Gothic_One']">30D</span>
              </div>
              <p className="text-xs font-bold leading-tight uppercase">
                {overdueCount > 0 ? `${overdueCount} Cases require immediate statutory sign-off` : 'All statutory notices currently on-track'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
