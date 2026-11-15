import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { PATHS } from '@/routes/paths';
import { ExtractionReviewModal } from '@/components/extraction/ExtractionReviewModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GlitchText } from '@/components/ui/GlitchText';
import { StickerBadge } from '@/components/ui/StickerBadge';
import { formatDate } from '@/lib/utils';
import {
  FileText,
  Building2,
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export function ReviewQueuePage() {
  const { queue, fetchQueue, activeExtraction, fetchExtraction, clearActive, isLoading } =
    useReviewQueueStore();
  const [laneFilter, setLaneFilter] = useState<'all' | 'standard' | 'low_confidence'>('all');
  const navigate = useNavigate();
  // The open extraction lives in the URL (/review/:extractionId), so it can be linked from a case.
  const { extractionId } = useParams<{ extractionId?: string }>();

  useEffect(() => {
    fetchQueue();
  }, []);

  useEffect(() => {
    if (extractionId) void fetchExtraction(extractionId);
    else clearActive();
  }, [extractionId]);

  const closeReview = () => {
    clearActive();
    navigate(PATHS.review);
  };

  const filteredQueue = queue.filter((item) => {
    if (laneFilter === 'all') return true;
    return item.review_lane === laneFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8 font-['Space_Grotesk',sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#09090B] pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <GlitchText as="h1" className="text-xl sm:text-3xl font-['Dela_Gothic_One'] text-[#09090B] break-words">
              HUMAN-IN-THE-LOOP OCR TRIAGE
            </GlitchText>
            <StickerBadge variant="acid" rotate="-rotate-1" className="text-xs">
              MANDATORY REVIEW
            </StickerBadge>
          </div>
          <p className="text-xs sm:text-sm font-medium text-[#52525B] mt-1">
            Rule D3: No AI extraction directly modifies bank ledgers or relief claims without certified human operator verification.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => fetchQueue()} isLoading={isLoading} className="gap-2 shadow-hard-sm self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5" /> REFRESH QUEUE
        </Button>
      </div>

      {/* Safety Info Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#EDE8D5] border-2 border-[#09090B] shadow-hard flex items-start gap-3 sm:gap-4">
        <span className="p-2.5 rounded-xl bg-[#09090B] text-[#D2E823] border border-[#09090B] shrink-0 mt-0.5">
          <ShieldCheck className="w-6 h-6" />
        </span>
        <div className="text-xs text-[#09090B] space-y-1">
          <p className="font-['Dela_Gothic_One'] uppercase text-sm">STATUTORY HITL PROTOCOL</p>
          <p className="leading-relaxed font-medium">
            Standard Lane claims feature high OCR confidence (&gt;85%). Low Confidence Lane extractions feature faint thermal paper printing, police seal occlusions, or fold creases requiring line-by-line verification against raw voucher facsimile.
          </p>
        </div>
      </div>

      {/* Lane Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setLaneFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border-2 border-[#09090B] ${laneFilter === 'all'
              ? 'bg-[#09090B] text-[#D2E823] shadow-hard-sm translate-x-[1px] translate-y-[1px]'
              : 'bg-[#F8F4E8] text-[#09090B] hover:bg-[#D2E823]'
            }`}
        >
          ALL PENDING ({queue.length})
        </button>
        <button
          onClick={() => setLaneFilter('standard')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border-2 border-[#09090B] ${laneFilter === 'standard'
              ? 'bg-[#09090B] text-[#D2E823] shadow-hard-sm translate-x-[1px] translate-y-[1px]'
              : 'bg-[#F8F4E8] text-[#09090B] hover:bg-[#D2E823]'
            }`}
        >
          STANDARD LANE ({queue.filter((q) => q.review_lane === 'standard').length})
        </button>
        <button
          onClick={() => setLaneFilter('low_confidence')}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border-2 border-[#09090B] flex items-center gap-1.5 ${laneFilter === 'low_confidence'
              ? 'bg-[#FF334B] text-[#09090B] shadow-hard-sm translate-x-[1px] translate-y-[1px]'
              : 'bg-[#F8F4E8] text-[#FF334B] hover:bg-[#FF334B]/20'
            }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          LOW CONFIDENCE LANE ({queue.filter((q) => q.review_lane === 'low_confidence').length})
        </button>
      </div>

      {/* Queue Items List */}
      {filteredQueue.length === 0 ? (
        <div className="p-16 text-center rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard space-y-2">
          <CheckCircle2 className="w-12 h-12 text-[#16A34A] mx-auto" />
          <h3 className="font-['Dela_Gothic_One'] uppercase text-lg text-[#09090B]">QUEUE FULLY CLEARED</h3>
          <p className="text-xs font-mono text-[#52525B]">
            All uploaded vouchers and police reports have been verified by certified operators.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredQueue.map((item) => {
            const isLowConf = item.review_lane === 'low_confidence';
            const overallPct = Math.round(
              (item.overall_confidence ?? 0) <= 1
                ? (item.overall_confidence ?? 0) * 100
                : (item.overall_confidence ?? 0)
            );

            return (
              <div
                key={item.extraction_id}
                className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-6 shadow-hard-lg hover:translate-x-1 hover:translate-y-1 hover:shadow-hard transition-all duration-150 flex flex-col justify-between group space-y-5"
              >
                <div>
                  {/* Top Bar: Case & Lane */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#09090B] text-[#D2E823] border border-[#09090B]">
                      {item.case_reference}
                    </span>
                    <Badge reviewLane={item.review_lane}>
                      {item.review_lane.replace('_', ' ')}
                    </Badge>
                  </div>

                  {/* Document Name */}
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-[#09090B]" />
                    <p className="font-bold text-sm text-[#09090B] uppercase">{item.document_filename}</p>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono text-[#52525B] mb-4">
                    <span className="flex items-center gap-1 uppercase">
                      <Building2 className="w-3.5 h-3.5" /> {item.bank_name || item.bank_id}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Uploaded {formatDate(item.created_at)}
                    </span>
                  </div>

                  {/* Confidence Breakdown Box */}
                  <div className="p-4 rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] shadow-hard-sm space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold uppercase text-[#09090B]">AGGREGATE OCR CONFIDENCE:</span>
                      <span className={`font-['Dela_Gothic_One'] text-base ${isLowConf ? 'text-[#FF334B]' : 'text-[#16A34A]'}`}>
                        {overallPct}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-[#F8F4E8] rounded-full border border-[#09090B] overflow-hidden">
                      <div
                        className={`h-full ${isLowConf ? 'bg-[#FF334B]' : 'bg-[#16A34A]'}`}
                        style={{ width: `${overallPct}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#09090B]/20 text-[10px] font-mono">
                      <div>
                        <span className="text-[#52525B]">Engine:</span>{' '}
                        <span className="font-bold uppercase text-[#09090B]">{item.source}</span>
                      </div>
                      <div>
                        <span className="text-[#52525B]">Doc ID:</span>{' '}
                        <span className="font-bold text-[#09090B]">{item.document_id}</span>
                      </div>
                      <div>
                        <span className="text-[#52525B]">Operator:</span>{' '}
                        <span className="font-bold text-[#09090B]">{item.assigned_operator?.name ?? 'Auto-Queued'}</span>
                      </div>
                      <div>
                        <span className="text-[#52525B]">Case Ref:</span>{' '}
                        <span className="font-bold text-[#09090B]">{item.case_reference}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Review Launch Action */}
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate(PATHS.reviewDetail(item.extraction_id))}
                  className="w-full gap-2 shadow-hard hover:shadow-hard-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>LAUNCH OPTICAL VERIFICATION</span>
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Extraction Review Modal */}
      {extractionId && activeExtraction?.id === extractionId && (
        <ExtractionReviewModal
          extraction={activeExtraction}
          isOpen
          onClose={closeReview}
          onReviewed={closeReview}
        />
      )}
    </div>
  );
}
