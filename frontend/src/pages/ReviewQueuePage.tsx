import { useEffect, useState } from 'react';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { ExtractionReviewModal } from '@/components/extraction/ExtractionReviewModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import {
  BrainCircuit,
  FileText,
  Building2,
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export function ReviewQueuePage() {
  const { queue, fetchQueue, activeExtraction, fetchExtraction, clearActive, isLoading } =
    useReviewQueueStore();
  const [laneFilter, setLaneFilter] = useState<'all' | 'standard' | 'low_confidence'>('all');

  useEffect(() => {
    fetchQueue();
  }, []);

  const filteredQueue = queue.filter((item) => {
    if (laneFilter === 'all') return true;
    return item.review_lane === laneFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-primary" />
            AI Document Extraction Review Queue
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Human-in-the-Loop triage verification. No AI suggestion modifies case records without operator approval (D3).
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => fetchQueue()} isLoading={isLoading}>
          Refresh Queue
        </Button>
      </div>

      {/* Safety Info Banner */}
      <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
          <p className="font-bold">Human-in-the-Loop Protocol (HITL)</p>
          <p className="leading-relaxed">
            Extractions in the <strong>Standard Lane</strong> possess high OCR confidence (&gt;85%).
            Extractions in the <strong>Low Confidence Lane</strong> require line-by-line verification against physical receipts, police filings, or fold creases before acceptance.
          </p>
        </div>
      </div>

      {/* Lane Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setLaneFilter('all')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
            laneFilter === 'all'
              ? 'bg-primary text-primary-foreground font-bold'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          All Pending ({queue.length})
        </button>
        <button
          onClick={() => setLaneFilter('standard')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
            laneFilter === 'standard'
              ? 'bg-primary text-primary-foreground font-bold'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          Standard Lane ({queue.filter((q) => q.review_lane === 'standard').length})
        </button>
        <button
          onClick={() => setLaneFilter('low_confidence')}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            laneFilter === 'low_confidence'
              ? 'bg-amber-600 text-white font-bold'
              : 'text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Low Confidence Lane ({queue.filter((q) => q.review_lane === 'low_confidence').length})
        </button>
      </div>

      {/* Queue Items List */}
      {filteredQueue.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-border bg-card">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
          <h3 className="text-sm font-bold text-foreground">Review Queue is Clear</h3>
          <p className="text-xs text-muted-foreground mt-1">
            All AI document extractions have been triaged by center operators.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQueue.map((item) => {
            const confPct = Math.round((item.overall_confidence || 0) * 100);
            return (
              <div
                key={item.extraction_id}
                className="p-5 rounded-xl border border-border bg-card hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-foreground">
                          {item.case_reference}
                        </span>
                        <Badge reviewLane={item.review_lane}>
                          {item.review_lane === 'low_confidence' ? 'Low Confidence' : 'Standard'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                        <Building2 className="w-3.5 h-3.5 text-primary" /> {item.bank_name}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className={`font-mono text-sm font-bold ${confPct < 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {confPct}% conf
                      </span>
                      <p className="text-[10px] text-muted-foreground uppercase">{item.source}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/40 border border-border/60 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    <div className="truncate text-xs">
                      <p className="font-semibold text-foreground truncate">{item.document_filename}</p>
                      <p className="text-muted-foreground flex items-center gap-1 mt-0.5 text-[11px]">
                        <Clock className="w-3 h-3" /> Queued {formatDate(item.created_at)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Assigned: <strong className="text-foreground">{item.assigned_operator?.name || 'Unassigned'}</strong>
                  </span>
                  <Button
                    size="sm"
                    onClick={() => fetchExtraction(item.extraction_id)}
                    className="gap-1.5 text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Start Review
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      <ExtractionReviewModal
        extraction={activeExtraction}
        isOpen={Boolean(activeExtraction)}
        onClose={clearActive}
        onSuccess={() => fetchQueue()}
      />
    </div>
  );
}
