import { useState, useEffect } from 'react';
import { Extraction } from '@/types/api';
import { useReviewQueueStore } from '@/store/useReviewQueueStore';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DocumentOpticalPreview } from './DocumentOpticalPreview';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Quote,
  ShieldCheck,
  ScanLine,
} from 'lucide-react';

interface ExtractionReviewModalProps {
  extraction: Extraction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExtractionReviewModal({
  extraction,
  isOpen,
  onClose,
  onSuccess,
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
    onClose();
  };

  const handleReject = async () => {
    await reviewExtraction(extraction.id, 'reject', undefined, reviewNote || 'Rejected by operator');
    onSuccess?.();
    onClose();
  };

  const confidencePct = Math.round((extraction.overall_confidence || 0) * 100);

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="5xl">
      <div className="space-y-6">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/40 border border-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Human-in-the-Loop AI Extraction Review
              </span>
              <Badge reviewLane={extraction.review_lane || 'standard'}>
                {extraction.review_lane === 'low_confidence' ? 'Low Confidence Lane' : 'Standard Lane'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Case Ref: <span className="font-mono font-bold text-foreground">{extraction.case_reference}</span> •
              Model: <span className="font-mono">{extraction.model || 'rules_fallback'}</span> •
              Prompt: <span className="font-mono">{extraction.prompt_version || 'v2.4'}</span>
            </p>
          </div>

          {/* Overall Confidence Meter */}
          <div className="flex items-center gap-3 bg-card px-4 py-2 rounded-lg border border-border">
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Overall Confidence</p>
              <p className={`text-base font-bold font-mono ${confidencePct < 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {confidencePct}%
              </p>
            </div>
            <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${confidencePct < 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Human-in-the-Loop Safe Directive Banner & Optical Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>
              <strong>AI Safety Mandate (D3):</strong> Suggestions require human verification.
              Compare optical geometry against the evidence quotes and case values before applying.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowOpticalPreview(!showOpticalPreview)}
            className="shrink-0 text-xs border-blue-300 dark:border-blue-700 hover:bg-blue-100/50 dark:hover:bg-blue-900/40 gap-1.5"
          >
            <ScanLine className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            {showOpticalPreview ? 'Hide Optical Preview' : 'Show Optical Geometry'}
          </Button>
        </div>

        {/* Optical Document Geometry Canvas (Interactive Visual Inspection) */}
        {showOpticalPreview && (
          <DocumentOpticalPreview extraction={extraction} activeFieldHover={hoveredField} />
        )}

        {/* Fields Comparison Table */}
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <div className="grid grid-cols-12 bg-muted/60 p-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
            <div className="col-span-3">Field</div>
            <div className="col-span-4">AI Extraction & Supporting Evidence</div>
            <div className="col-span-2">Current Case Value</div>
            <div className="col-span-3">Approved / Final Value</div>
          </div>

          <div className="divide-y divide-border">
            {extraction.fields.map((field) => {
              const fieldConf = Math.round(field.confidence * 100);
              return (
                <div
                  key={field.name}
                  onMouseEnter={() => setHoveredField(field.name)}
                  onMouseLeave={() => setHoveredField(null)}
                  className={`grid grid-cols-12 p-3.5 items-start gap-3 transition-colors ${
                    hoveredField === field.name ? 'bg-primary/5' : 'hover:bg-muted/20'
                  }`}
                >
                  {/* Field Name & Confidence */}
                  <div className="col-span-3 space-y-1">
                    <p className="text-xs font-bold text-foreground font-mono">
                      {field.name}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        fieldConf >= 90 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                        fieldConf >= 70 ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {fieldConf}% conf
                      </span>
                    </div>
                  </div>

                  {/* AI Value & Evidence Quote */}
                  <div className="col-span-4 space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">
                      {String(field.value ?? '—')}
                    </p>
                    {field.evidence && (
                      <p className="text-[11px] text-muted-foreground italic flex items-start gap-1 bg-muted/40 p-2 rounded border border-border/50">
                        <Quote className="w-3 h-3 shrink-0 mt-0.5 text-primary/60" />
                        <span>{field.evidence}</span>
                      </p>
                    )}
                  </div>

                  {/* Current Case Value */}
                  <div className="col-span-2 text-xs text-muted-foreground font-mono pt-1 space-y-1">
                    <p>{String(field.current_case_value ?? '(empty)')}</p>
                    {String(field.current_case_value ?? '') !== String(field.value ?? '') && (
                      <span className="inline-block text-[9px] font-bold text-amber-800 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.2 rounded">
                        Diff Detected
                      </span>
                    )}
                  </div>

                  {/* Final Approved Value Input */}
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={editedFields[field.name] ?? ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      className="w-full text-xs font-mono font-medium rounded border border-input bg-background p-2 focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Missing Fields Flag */}
        {extraction.missing_fields.length > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              <strong>Unidentified Fields:</strong> Document did not contain:{' '}
              {extraction.missing_fields.join(', ')}.
            </span>
          </div>
        )}

        {/* Operator Note */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Reviewer Audit Note (optional):
          </label>
          <input
            type="text"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            placeholder="Add reviewer comments or verification notes..."
            className="w-full text-xs rounded-md border border-input bg-background p-2 focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleReject}
            isLoading={isActionLoading}
            className="gap-1.5"
          >
            <XCircle className="w-4 h-4" /> Reject Extraction
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAccept}
              isLoading={isActionLoading}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4" /> Accept & Update Case
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
