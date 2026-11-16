import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { PATHS } from '@/routes/paths';
import { ExtractionReviewModal } from '@/components/extraction/ExtractionReviewModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn, formatDate } from '@/lib/utils';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';

export function ReviewQueuePage() {
  const {
    queue,
    fetchQueue,
    activeExtraction,
    fetchExtraction,
    clearActive,
    isLoading,
    error,
    extractionNotice,
  } = useReviewQueueStore();
  const [laneFilter, setLaneFilter] = useState<'all' | 'standard' | 'low_confidence'>('all');
  const navigate = useNavigate();
  // The open extraction lives in the URL (/review/:extractionId), so it can be linked from a case.
  const { extractionId } = useParams<{ extractionId?: string }>();

  const { reload: reloadQueue } = useAsyncResource('review-queue', () => fetchQueue());

  useAsyncResource(
    extractionId ? `extraction:${extractionId}` : null,
    async () => {
      if (extractionId) {
        await fetchExtraction(extractionId);
      }
      return true;
    }
  );

  const closeReview = () => {
    clearActive();
    navigate(PATHS.review);
  };

  const filteredQueue = queue.filter((item) => {
    if (laneFilter === 'all') return true;
    return item.review_lane === laneFilter;
  });

  const standardCount = queue.filter((q) => q.review_lane === 'standard').length;
  const lowConfCount = queue.filter((q) => q.review_lane === 'low_confidence').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 font-['Space_Grotesk',sans-serif]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#09090B] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-['Dela_Gothic_One'] text-[#09090B]">
            Review queue
          </h1>
          <p className="text-sm text-[#52525B] mt-1">
            AI-extracted documents waiting for a person to confirm.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => reloadQueue()}
          isLoading={isLoading}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> REFRESH QUEUE
        </Button>
      </div>

      {/* Notice for reviewed or missing extraction */}
      {extractionNotice && (
        <div
          role="status"
          className="p-5 rounded-2xl border-2 border-[#09090B] bg-[#EDE8D5] text-[#09090B] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-hard-sm"
        >
          <p className="text-sm font-medium text-[#09090B]">
            {extractionNotice}
          </p>
          <Link
            to={PATHS.review}
            onClick={closeReview}
            className="inline-flex items-center justify-center font-['Space_Grotesk',sans-serif] font-bold text-xs uppercase tracking-wider select-none cursor-pointer bg-[#F8F4E8] text-[#09090B] border-2 border-[#09090B] hover:bg-[#D2E823] transition-all h-8 px-3 py-1 gap-1.5 rounded-lg shadow-hard-sm hover:translate-x-[1px] hover:translate-y-[1px] shrink-0"
          >
            Back to review queue
          </Link>
        </div>
      )}

      {/* Filter toolbar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setLaneFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-lg font-bold uppercase transition-colors cursor-pointer',
            laneFilter === 'all'
              ? 'bg-[#09090B] text-[#D2E823]'
              : 'bg-[#F8F4E8] text-[#52525B] hover:text-[#09090B] border border-[#09090B]/15'
          )}
        >
          All ({queue.length})
        </button>
        <button
          type="button"
          onClick={() => setLaneFilter('standard')}
          className={cn(
            'px-3 py-1.5 rounded-lg font-bold uppercase transition-colors cursor-pointer',
            laneFilter === 'standard'
              ? 'bg-[#09090B] text-[#D2E823]'
              : 'bg-[#F8F4E8] text-[#52525B] hover:text-[#09090B] border border-[#09090B]/15'
          )}
        >
          Standard ({standardCount})
        </button>
        <button
          type="button"
          onClick={() => setLaneFilter('low_confidence')}
          className={cn(
            'px-3 py-1.5 rounded-lg font-bold uppercase transition-colors cursor-pointer',
            laneFilter === 'low_confidence'
              ? 'bg-[#09090B] text-[#D2E823]'
              : 'bg-[#F8F4E8] text-[#52525B] hover:text-[#09090B] border border-[#09090B]/15'
          )}
        >
          Low confidence ({lowConfCount})
        </button>
      </div>

      {/* Queue items list panel */}
      <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#09090B]/10 text-xs font-bold uppercase tracking-wide text-[#52525B] bg-transparent">
                <th scope="col" className="whitespace-nowrap py-3.5 px-4 font-mono">Case</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Document</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Bank</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4 font-mono">Uploaded</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Confidence</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4">Lane</th>
                <th scope="col" className="whitespace-nowrap py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#09090B]/10 font-medium">
              {isLoading && queue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-[#52525B]">
                    Loading review queue…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div role="alert" className="inline-flex flex-col items-center gap-3 max-w-md mx-auto p-4 rounded-xl border border-[#FF334B]/30 bg-[#FF334B]/10">
                      <p className="text-xs font-bold text-[#FF334B]">{error}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          reloadQueue();
                          if (extractionId) void fetchExtraction(extractionId);
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-[#52525B]">
                    No documents waiting for review.
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item) => {
                  const isLowConf = item.review_lane === 'low_confidence';
                  const overallPct = Math.round(
                    (item.overall_confidence ?? 0) <= 1
                      ? (item.overall_confidence ?? 0) * 100
                      : (item.overall_confidence ?? 0)
                  );

                  return (
                    <tr key={item.extraction_id} className="hover:bg-[#EDE8D5]/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#09090B] whitespace-nowrap">
                        {item.case_reference}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#09090B] whitespace-nowrap">
                        {item.document_filename}
                      </td>
                      <td className="py-3.5 px-4 text-[#52525B] whitespace-nowrap">
                        {item.bank_name || item.bank_id}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[#52525B] whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'font-mono font-bold text-xs',
                            isLowConf ? 'text-[#FF334B]' : 'text-[#09090B]'
                          )}
                        >
                          {overallPct}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge reviewLane={item.review_lane}>
                          {item.review_lane === 'low_confidence' ? 'Low confidence' : 'Standard'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(PATHS.reviewDetail(item.extraction_id))}
                          className="gap-1.5"
                        >
                          <span>Review</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extraction review modal */}
      {extractionId &&
        activeExtraction?.id === extractionId &&
        activeExtraction.status === 'pending_review' && (
          <ExtractionReviewModal
            extraction={activeExtraction}
            isOpen
            onClose={closeReview}
            onReviewed={() => {
              reloadQueue();
              closeReview();
            }}
          />
        )}
    </div>
  );
}
