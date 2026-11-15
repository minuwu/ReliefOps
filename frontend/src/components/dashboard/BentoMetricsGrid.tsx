import { DashboardStats } from '@/types/api';
import { StickerBadge } from '@/components/ui/StickerBadge';
import { formatCurrency } from '@/lib/utils';
import {
  AlertOctagon,
  Clock,
  BrainCircuit,
  ArrowUpRight,
  Activity,
  Layers,
} from 'lucide-react';

interface BentoMetricsGridProps {
  stats: DashboardStats;
  totalClaimedJPY: number;
  onNavigateToCases?: (filter?: string) => void;
  onNavigateToReview?: () => void;
}

export function BentoMetricsGrid({
  stats,
  totalClaimedJPY,
  onNavigateToCases,
  onNavigateToReview,
}: BentoMetricsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 my-8 font-['Space_Grotesk',sans-serif]">
      {/* Large 2x2 Dark Card (7 Cols on desktop, spans 2 vertical rows) */}
      <div
        className="md:col-span-7 bg-[#09090B] text-[#F8F4E8] rounded-2xl border-2 border-[#09090B] shadow-hard-lg p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden transition-all duration-150 hover:translate-x-1 hover:translate-y-1 hover:shadow-hard group"
      >
        {/* Subtle background texture overlay */}
        <div className="absolute inset-0 bg-dot-pattern-inverted opacity-10 pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#D2E823] text-[#09090B] flex items-center justify-center font-bold text-xs border border-[#09090B]">
                <Activity className="w-4 h-4" />
              </span>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#D2E823]">
                CONSORTIUM CLEARINGHOUSE
              </span>
            </div>
            <StickerBadge variant="acid" rotate="-rotate-2" className="text-[10px] py-0.5">
              ACTIVE TELEMETRY
            </StickerBadge>
          </div>

          <p className="text-xs font-mono uppercase tracking-wider text-[#A1A1AA]">TOTAL RECOVERY CLAIMS UNDER MANAGEMENT</p>
          <div className="mt-2 mb-6">
            <p className="text-3xl sm:text-5xl font-['Dela_Gothic_One'] tracking-tight text-[#F8F4E8]">
              {formatCurrency(totalClaimedJPY, 'JPY')}
            </p>
          </div>

          {/* 5-Bank Statutory Progress Bars */}
          <div className="space-y-3 pt-4 border-t-2 border-[#27272A]">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-[#A1A1AA]">STATUTORY SETTLEMENT SLA COMPLIANCE</span>
              <span className="text-[#D2E823] font-bold">92.4% ON-TIME</span>
            </div>
            <div className="w-full h-3 bg-[#18181B] rounded-full border-2 border-[#27272A] overflow-hidden flex">
              <div className="h-full bg-[#D2E823]" style={{ width: '68%' }} title="On Track (68%)" />
              <div className="h-full bg-[#FBBF24]" style={{ width: '22%' }} title="Due Soon (22%)" />
              <div className="h-full bg-[#FF334B]" style={{ width: '10%' }} title="Overdue (10%)" />
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono text-[#A1A1AA]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#D2E823]" /> 68% Normal
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#FBBF24]" /> 22% Due &lt;48h
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#FF334B]" /> 10% Overdue Esc.
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-6 mt-6 border-t-2 border-[#27272A] flex items-center justify-between">
          <span className="text-xs font-mono text-[#A1A1AA]">5 PARTICIPATING REGIONAL BANKS LINKED</span>
          <button
            onClick={() => onNavigateToCases && onNavigateToCases()}
            className="flex items-center gap-1.5 text-xs font-bold text-[#D2E823] hover:underline uppercase tracking-wider cursor-pointer"
          >
            OPEN FULL ROSTER <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right Column Bento Cards (5 Cols) */}
      <div className="md:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* 1x1 Card: Overdue Escalation */}
        <div
          onClick={() => onNavigateToCases && onNavigateToCases('overdue')}
          className="bg-[#F8F4E8] rounded-2xl border-2 border-[#09090B] shadow-hard p-5 flex flex-col justify-between relative overflow-hidden transition-all duration-150 hover:translate-x-1 hover:translate-y-1 hover:shadow-none cursor-pointer group bg-dot-pattern"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-[#FF334B] text-[#09090B] border-2 border-[#09090B] shadow-hard-sm">
                <AlertOctagon className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-mono font-bold uppercase text-[#FF334B] bg-[#FF334B]/10 px-2 py-0.5 rounded border border-[#FF334B]">
                CRITICAL
              </span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#52525B]">STATUTORY OVERDUE</p>
            <p className="text-3xl font-['Dela_Gothic_One'] text-[#FF334B] mt-1">
              {stats.overdue_cases}
            </p>
          </div>
          <p className="text-[11px] font-mono text-[#52525B] mt-4 flex items-center gap-1">
            Immediate supervisor review <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        {/* 1x1 Card: AI Document Triage Pending */}
        <div
          onClick={() => onNavigateToReview && onNavigateToReview()}
          className="bg-[#D2E823] text-[#09090B] rounded-2xl border-2 border-[#09090B] shadow-hard p-5 flex flex-col justify-between relative overflow-hidden transition-all duration-150 hover:translate-x-1 hover:translate-y-1 hover:shadow-none cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-[#09090B] text-[#D2E823] border-2 border-[#09090B] shadow-hard-sm">
                <BrainCircuit className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-mono font-bold uppercase text-[#09090B] bg-[#09090B]/10 px-2 py-0.5 rounded border border-[#09090B]">
                HITL OCR
              </span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#09090B]">AI OCR PENDING</p>
            <p className="text-3xl font-['Dela_Gothic_One'] text-[#09090B] mt-1">
              {stats.ai_review_pending}
            </p>
          </div>
          <p className="text-[11px] font-mono font-bold text-[#09090B] mt-4 flex items-center gap-1">
            Launch optical verification <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        {/* 1x1 Card: Due Soon (<48h) */}
        <div
          onClick={() => onNavigateToCases && onNavigateToCases('due_soon')}
          className="bg-[#F8F4E8] rounded-2xl border-2 border-[#09090B] shadow-hard p-5 flex flex-col justify-between relative overflow-hidden transition-all duration-150 hover:translate-x-1 hover:translate-y-1 hover:shadow-none cursor-pointer group bg-dot-pattern"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-[#FBBF24] text-[#09090B] border-2 border-[#09090B] shadow-hard-sm">
                <Clock className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-mono font-bold uppercase text-[#09090B] bg-[#FBBF24]/20 px-2 py-0.5 rounded border border-[#09090B]">
                &lt; 48 HOURS
              </span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#52525B]">DUE SOON CLAIMS</p>
            <p className="text-3xl font-['Dela_Gothic_One'] text-[#09090B] mt-1">
              {stats.due_soon_cases}
            </p>
          </div>
          <p className="text-[11px] font-mono text-[#52525B] mt-4 flex items-center gap-1">
            Account check deadline <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>

        {/* 1x1 Card: Total Active Roster */}
        <div
          onClick={() => onNavigateToCases && onNavigateToCases()}
          className="bg-[#F8F4E8] rounded-2xl border-2 border-[#09090B] shadow-hard p-5 flex flex-col justify-between relative overflow-hidden transition-all duration-150 hover:translate-x-1 hover:translate-y-1 hover:shadow-none cursor-pointer group bg-dot-pattern"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="p-2 rounded-xl bg-[#09090B] text-[#F8F4E8] border-2 border-[#09090B] shadow-hard-sm">
                <Layers className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-mono font-bold uppercase text-[#09090B] bg-[#09090B]/10 px-2 py-0.5 rounded border border-[#09090B]">
                6 STAGES
              </span>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#52525B]">TOTAL OPEN CASES</p>
            <p className="text-3xl font-['Dela_Gothic_One'] text-[#09090B] mt-1">
              {stats.open_cases}
            </p>
          </div>
          <p className="text-[11px] font-mono text-[#52525B] mt-4 flex items-center gap-1">
            Browse all lifecycle stages <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </div>
      </div>
    </div>
  );
}
