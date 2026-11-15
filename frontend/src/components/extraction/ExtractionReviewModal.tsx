import { useState, useEffect } from 'react';
import { Extraction } from '@/types/api';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { errorMessage } from '@/services/http';
import { DocumentOpticalPreview } from './DocumentOpticalPreview';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ExtractionReviewModalProps {
  extraction: Extraction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onReviewed?: () => void;
}

export function ExtractionReviewModal({
  extraction,
  isOpen,
  onClose,
  onSuccess,
  onReviewed,
}: ExtractionReviewModalProps) {
  const { reviewExtraction, isActionLoading } = useReviewQueueStore();
  const [editedFields, setEditedFields] = useState<Record<string, unknown>>({});
  const [reviewNote, setReviewNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [showOpticalPreview, setShowOpticalPreview] = useState(true);
  const [hoveredField, setHoveredField] = useState<string | null>(null);

  useEffect(() => {
    if (extraction) {
      const initial: Record<string, unknown> = {};
      extraction.fields.forEach((f) => {
        initial[f.name] = f.final_value ?? f.value;
      });
      setEditedFields(initial);
      setReviewNote('');
      setActionError(null);
    }
  }, [extraction]);

  if (!extraction) return null;

  const handleFieldChange = (name: string, value: unknown) => {
    setEditedFields((prev) => ({ ...prev, [name]: value }));
  };

  const handleAccept = async () => {
    setActionError(null);
    try {
      const result = await reviewExtraction(extraction.id, 'accept', editedFields, reviewNote);
      if (result !== false) {
        onSuccess?.();
        onReviewed?.();
        onClose();
      }
    } catch (err) {
      setActionError(errorMessage(err, 'We could not submit the review. Please try again.'));
    }
  };

  const handleReject = async () => {
    setActionError(null);
    try {
      const result = await reviewExtraction(extraction.id, 'reject', undefined, reviewNote || 'Rejected by operator');
      if (result !== false) {
        onSuccess?.();
        onReviewed?.();
        onClose();
      }
    } catch (err) {
      setActionError(errorMessage(err, 'We could not submit the review. Please try again.'));
    }
  };

  const confidencePct = Math.round((extraction.overall_confidence || 0) * 100);
  const isOverallLow = confidencePct < 85;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="5xl">
      <div className="space-y-6 font-['Space_Grotesk',sans-serif]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#EDE8D5] border border-[#09090B]/15">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg sm:text-xl font-['Dela_Gothic_One'] text-[#09090B]">
                Review extraction
              </h2>
              <Badge reviewLane={extraction.review_lane || 'standard'}>
                {extraction.review_lane === 'low_confidence' ? 'Low confidence' : 'Standard'}
              </Badge>
            </div>
            <p className="text-xs font-mono text-[#52525B]">
              Case ref: <span className="font-bold text-[#09090B]">{extraction.case_reference}</span> ·
              Model: <span className="text-[#09090B]">{extraction.model || 'vision-ocr-v2'}</span>
            </p>
          </div>

          {/* Overall Confidence */}
          <div className="flex items-center gap-2 bg-[#F8F4E8] px-3.5 py-2 rounded-xl border border-[#09090B]/20 text-xs">
            <span className="font-bold uppercase text-[#52525B]">Confidence:</span>
            <span className={cn('font-mono font-bold text-sm', isOverallLow ? 'text-[#FF334B]' : 'text-[#09090B]')}>
              {confidencePct}%
            </span>
            {isOverallLow && (
              <span className="w-2 h-2 rounded-full bg-[#FF334B] inline-block" title="Low confidence" />
            )}
          </div>
        </div>

        {/* Optical Document Preview Toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#09090B]">
            Voucher facsimile
          </span>
          <button
            type="button"
            onClick={() => setShowOpticalPreview(!showOpticalPreview)}
            className="text-xs font-medium text-[#52525B] hover:text-[#09090B] underline cursor-pointer"
          >
            {showOpticalPreview ? 'Hide voucher' : 'Show voucher'}
          </button>
        </div>

        {/* Side-by-Side Optical Document & Fields Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Optical Voucher Preview */}
          {showOpticalPreview && (
            <div className="lg:col-span-5">
              <DocumentOpticalPreview
                extraction={extraction}
                activeField={hoveredField}
                onSelectField={(f) => setHoveredField(f)}
              />
            </div>
          )}

          {/* Right Column: Extracted Fields Review */}
          <div className={showOpticalPreview ? 'lg:col-span-7' : 'lg:col-span-12'}>
            <div className="p-5 rounded-2xl border border-[#09090B]/15 bg-[#F8F4E8] space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#09090B]">
                Extracted field values
              </h3>

              <div className="space-y-3">
                {extraction.fields.map((field) => {
                  const val = editedFields[field.name] ?? field.value ?? '';
                  const conf = Math.round((field.confidence || 0) * 100);
                  const isLow = conf < 85;
                  const isModified = val !== field.value;

                  return (
                    <div
                      key={field.name}
                      onMouseEnter={() => setHoveredField(field.name)}
                      onMouseLeave={() => setHoveredField(null)}
                      className={cn(
                        'p-3 rounded-xl border transition-colors',
                        hoveredField === field.name
                          ? 'border-[#09090B] bg-[#EDE8D5]/50'
                          : isModified
                          ? 'border-[#D2E823] bg-[#D2E823]/10'
                          : 'border-[#09090B]/15 bg-[#F8F4E8]'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#09090B]">
                          {field.name.replace('_', ' ')}
                        </label>
                        <div className="flex items-center gap-2">
                          {isModified && (
                            <Badge variant="acid">
                              Modified
                            </Badge>
                          )}
                          <span
                            className={cn(
                              'text-xs font-mono font-bold',
                              isLow ? 'text-[#FF334B]' : 'text-[#52525B]'
                            )}
                          >
                            {conf}%
                          </span>
                          {isLow && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FF334B] inline-block" title="Low confidence" />
                          )}
                        </div>
                      </div>

                      <input
                        type="text"
                        aria-label={`Edit ${field.name.replace(/_/g, ' ')}`}
                        value={String(val)}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        className="w-full text-xs font-mono font-medium bg-[#F8F4E8] border border-[#09090B]/30 rounded-lg p-2 focus:border-[#09090B] focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Operator Verification Note */}
              <div className="space-y-1.5 pt-2">
                <label htmlFor="review-note" className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
                  Review note
                </label>
                <input
                  id="review-note"
                  type="text"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="e.g. Verified wire seal against registry"
                  className="w-full text-xs font-medium bg-[#F8F4E8] border border-[#09090B]/30 rounded-xl p-2.5 focus:border-[#09090B] focus:outline-none"
                />
              </div>

              {actionError && (
                <div role="alert" className="rounded-xl border border-[#FF334B]/30 bg-[#FF334B]/10 p-3 text-xs font-bold text-[#FF334B]">
                  {actionError}
                </div>
              )}

              {/* Action Buttons: one primary confirm, others outline */}
              <div className="flex justify-end gap-3 pt-4 border-t border-[#09090B]/10">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleReject}
                  isLoading={isActionLoading}
                  className="gap-2"
                >
                  <XCircle className="w-4 h-4" /> REJECT EXTRACTION
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleAccept}
                  isLoading={isActionLoading}
                  className="gap-2 shadow-hard"
                >
                  <CheckCircle2 className="w-4 h-4" /> ACCEPT & UPDATE RECORD
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
