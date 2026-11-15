import { useState, useEffect } from 'react';
import { Extraction } from '@/types/api';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { GlitchText } from '@/components/ui/GlitchText';
import { DocumentOpticalPreview } from './DocumentOpticalPreview';
import {
  CheckCircle2,
  XCircle,
  ScanLine,
} from 'lucide-react';

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
  const [editedFields, setEditedFields] = useState<Record<string, any>>({});
  const [reviewNote, setReviewNote] = useState('');
  const [showOpticalPreview, setShowOpticalPreview] = useState(true);
  const [hoveredField, setHoveredField] = useState<string | null>(null);

  useEffect(() => {
    if (extraction) {
      const initial: Record<string, any> = {};
      extraction.fields.forEach((f) => {
        initial[f.name] = f.final_value ?? f.value;
      });
      setEditedFields(initial);
      setReviewNote('');
    }
  }, [extraction]);

  if (!extraction) return null;

  const handleFieldChange = (name: string, value: any) => {
    setEditedFields((prev) => ({ ...prev, [name]: value }));
  };

  const handleAccept = async () => {
    await reviewExtraction(extraction.id, 'accept', editedFields, reviewNote);
    onSuccess?.();
    onReviewed?.();
    onClose();
  };

  const handleReject = async () => {
    await reviewExtraction(extraction.id, 'reject', undefined, reviewNote || 'Rejected by operator');
    onSuccess?.();
    onReviewed?.();
    onClose();
  };

  const confidencePct = Math.round((extraction.overall_confidence || 0) * 100);

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="5xl">
      <div className="space-y-6 font-['Space_Grotesk',sans-serif]">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#EDE8D5] border-2 border-[#09090B] shadow-hard-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <GlitchText as="h2" className="text-lg sm:text-xl font-['Dela_Gothic_One'] text-[#09090B]">
                HITL OCR OPTICAL VERIFICATION
              </GlitchText>
              <Badge reviewLane={extraction.review_lane || 'standard'}>
                {extraction.review_lane === 'low_confidence' ? 'LOW CONFIDENCE' : 'STANDARD LANE'}
              </Badge>
            </div>
            <p className="text-xs font-mono text-[#52525B]">
              Case Ref: <span className="font-bold text-[#09090B]">{extraction.case_reference}</span> •
              Model Engine: <span className="text-[#09090B]">{extraction.model || 'vision-ocr-v2'}</span>
            </p>
          </div>

          {/* Overall Confidence Meter */}
          <div className="flex items-center gap-3 bg-[#F8F4E8] px-4 py-2 rounded-xl border-2 border-[#09090B] shadow-hard-sm">
            <div className="text-right">
              <p className="text-[10px] font-mono font-bold uppercase text-[#52525B]">OVERALL CONF</p>
              <p className={`text-base font-['Dela_Gothic_One'] ${confidencePct < 70 ? 'text-[#FF334B]' : 'text-[#16A34A]'}`}>
                {confidencePct}%
              </p>
            </div>
            <div className="w-16 h-3 rounded-full bg-[#EDE8D5] border border-[#09090B] overflow-hidden">
              <div
                className={`h-full ${confidencePct < 70 ? 'bg-[#FF334B]' : 'bg-[#16A34A]'}`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Optical Document Preview Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-[#09090B]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#09090B]">
              RAW PHYSICAL VOUCHER FACSIMILE
            </span>
          </div>
          <button
            onClick={() => setShowOpticalPreview(!showOpticalPreview)}
            className="text-xs font-bold font-mono text-[#09090B] hover:underline cursor-pointer"
          >
            {showOpticalPreview ? 'HIDE VOUCHER' : 'SHOW VOUCHER'}
          </button>
        </div>

        {/* Side-by-Side Optical Document & Fields Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Optical Voucher Preview (5 Cols) */}
          {showOpticalPreview && (
            <div className="lg:col-span-5">
              <DocumentOpticalPreview
                activeField={hoveredField}
                onSelectField={(f) => setHoveredField(f)}
              />
            </div>
          )}

          {/* Right Column: Extracted Fields Review (7 or 12 Cols) */}
          <div className={showOpticalPreview ? 'lg:col-span-7' : 'lg:col-span-12'}>
            <div className="p-5 rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard space-y-4">
              <h4 className="text-xs font-['Dela_Gothic_One'] uppercase tracking-wider text-[#09090B]">
                EXTRACTED FIELD VALUES (DIFF VERIFICATION)
              </h4>

              <div className="space-y-3">
                {extraction.fields.map((field) => {
                  const val = editedFields[field.name] ?? field.value ?? '';
                  const conf = Math.round((field.confidence || 0) * 100);
                  const isModified = val !== field.value;

                  return (
                    <div
                      key={field.name}
                      onMouseEnter={() => setHoveredField(field.name)}
                      onMouseLeave={() => setHoveredField(null)}
                      className={`p-3.5 rounded-xl border-2 transition-all ${
                        hoveredField === field.name
                          ? 'border-[#09090B] bg-[#EDE8D5] shadow-hard-sm'
                          : isModified
                          ? 'border-[#D2E823] bg-[#D2E823]/10'
                          : 'border-[#09090B]/30 bg-[#F8F4E8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#09090B]">
                          {field.name.replace('_', ' ')}
                        </label>
                        <div className="flex items-center gap-2">
                          {isModified && (
                            <span className="text-[10px] font-mono font-bold uppercase text-[#09090B] bg-[#D2E823] px-2 py-0.5 rounded border border-[#09090B]">
                              MODIFIED
                            </span>
                          )}
                          <span
                            className={`text-[11px] font-mono font-bold ${
                              conf < 75 ? 'text-[#FF334B]' : 'text-[#16A34A]'
                            }`}
                          >
                            {conf}% CONF
                          </span>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={val}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        className="w-full text-xs font-mono font-bold bg-[#F8F4E8] border-2 border-[#09090B] rounded-lg p-2 shadow-[2px_2px_0px_0px_#09090B] focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Operator Verification Note */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
                  OPERATOR CERTIFICATION AUDIT NOTE:
                </label>
                <input
                  type="text"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="e.g. Visual confirmation of wire seal match against bank registry..."
                  className="w-full text-xs font-bold bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-3 shadow-hard-sm focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#09090B]">
                <Button
                  variant="destructive"
                  size="md"
                  onClick={handleReject}
                  isLoading={isActionLoading}
                  className="gap-2 shadow-hard-sm"
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
