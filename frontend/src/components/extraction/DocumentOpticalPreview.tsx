import { useState } from 'react';
import { Extraction } from '@/types/api';
import { FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentOpticalPreviewProps {
  extraction?: Extraction | null;
  activeField?: string | null;
  activeFieldHover?: string | null;
  onSelectField?: (field: string) => void;
}

export function DocumentOpticalPreview({
  extraction,
  activeField,
  activeFieldHover,
  onSelectField,
}: DocumentOpticalPreviewProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const currentHover = activeField || activeFieldHover;

  const getFieldValue = (name: string, fallback: string) => {
    if (!extraction) return fallback;
    const f = extraction.fields.find((field) => field.name === name);
    return f ? String(f.final_value ?? f.value ?? fallback) : fallback;
  };

  const getFieldConf = (name: string) => {
    if (!extraction) return 92;
    const f = extraction.fields.find((field) => field.name === name);
    return f ? Math.round(f.confidence * 100) : 88;
  };

  const dateConf = getFieldConf('date');
  const accountConf = getFieldConf('account_number');
  const amountConf = getFieldConf('amount');

  return (
    <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-4 sm:p-5 space-y-4 font-['Space_Grotesk',sans-serif]">
      {/* Header & Controls */}
      <div className="flex items-center justify-between text-xs text-[#52525B] border-b border-[#09090B]/10 pb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#09090B]" />
          <span className="font-bold uppercase tracking-wide text-xs text-[#09090B]">
            Voucher facsimile
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(80, z - 10))}
            className="p-1 rounded-lg border border-[#09090B]/20 bg-[#EDE8D5] hover:bg-[#D2E823] text-[#09090B] transition-colors cursor-pointer"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono font-bold text-[#09090B] w-9 text-center">{zoomLevel}%</span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
            className="p-1 rounded-lg border border-[#09090B]/20 bg-[#EDE8D5] hover:bg-[#D2E823] text-[#09090B] transition-colors cursor-pointer"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Document Canvas */}
      <div className="overflow-x-auto p-3 bg-[#EDE8D5]/50 rounded-xl border border-[#09090B]/15 flex justify-center">
        <div
          className="w-full max-w-xl bg-[#F8F4E8] text-[#09090B] rounded-xl p-5 border border-[#09090B]/20 text-xs transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
        >
          {/* Slip Header */}
          <div className="flex justify-between items-start border-b border-[#09090B]/20 pb-3 mb-4">
            <div>
              <p className="font-bold text-xs uppercase tracking-wide text-[#09090B]">
                Wire transfer voucher
              </p>
              <p className="text-xs text-[#52525B] font-mono mt-0.5">
                Doc ID: {extraction?.document_id || 'DOC-78921'}
              </p>
            </div>
            <span className="px-2 py-0.5 rounded border border-[#FF334B] text-[#FF334B] text-xs font-mono font-bold uppercase">
              Evidence sealed
            </span>
          </div>

          {/* Form Rows with Field Highlights */}
          <div className="space-y-3">
            {/* Row 1: Date & Bank */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-xs uppercase font-bold text-[#52525B] block mb-1">Transfer date</span>
                <button
                  type="button"
                  onClick={() => onSelectField?.('date')}
                  className={cn(
                    'text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B] p-2 rounded-lg border transition-colors cursor-pointer',
                    currentHover === 'date'
                      ? 'border-[#09090B] bg-[#D2E823]/30'
                      : 'border-dashed border-[#09090B]/30 bg-[#EDE8D5]/40'
                  )}
                >
                  <span className="font-mono font-bold text-[#09090B]">{getFieldValue('date', '2026-11-12')}</span>
                  <span
                    className={cn(
                      'ml-2 text-xs font-mono font-bold',
                      dateConf < 85 ? 'text-[#FF334B]' : 'text-[#52525B]'
                    )}
                  >
                    {dateConf}%
                  </span>
                </button>
              </div>

              <div>
                <span className="text-xs uppercase font-bold text-[#52525B] block mb-1">Destination bank</span>
                <button
                  type="button"
                  onClick={() => onSelectField?.('bank_name')}
                  className={cn(
                    'text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B] p-2 rounded-lg border transition-colors cursor-pointer',
                    currentHover === 'bank_name'
                      ? 'border-[#09090B] bg-[#D2E823]/30'
                      : 'border-dashed border-[#09090B]/30 bg-[#EDE8D5]/40'
                  )}
                >
                  <span className="font-bold text-[#09090B]">{getFieldValue('bank_name', 'Bank of Tokyo')}</span>
                </button>
              </div>
            </div>

            {/* Row 2: Beneficiary Account */}
            <div>
              <span className="text-xs uppercase font-bold text-[#52525B] block mb-1">
                Beneficiary account
              </span>
              <button
                type="button"
                onClick={() => onSelectField?.('account_number')}
                className={cn(
                  'text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B] p-2.5 rounded-lg border transition-colors flex items-center justify-between cursor-pointer',
                  currentHover === 'account_number'
                    ? 'border-[#09090B] bg-[#D2E823]/30'
                    : 'border border-[#09090B]/30 bg-[#EDE8D5]/30'
                )}
              >
                <div>
                  <span className="font-mono text-sm font-bold tracking-wider text-[#09090B]">
                    {getFieldValue('account_number', '9823-1049-21')}
                  </span>
                  <p className="text-xs text-[#52525B]">
                    Holder: {getFieldValue('account_holder', 'KENJI SATO')}
                  </p>
                </div>
                <span
                  className={cn(
                    'text-xs font-mono font-bold',
                    accountConf < 85 ? 'text-[#FF334B]' : 'text-[#52525B]'
                  )}
                >
                  {accountConf}%
                </span>
              </button>
            </div>

            {/* Row 3: Remitted Amount */}
            <div>
              <span className="text-xs uppercase font-bold text-[#52525B] block mb-1">Remitted amount</span>
              <button
                type="button"
                onClick={() => onSelectField?.('amount')}
                className={cn(
                  'text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#09090B] p-2.5 rounded-lg border transition-colors flex items-center justify-between cursor-pointer',
                  currentHover === 'amount'
                    ? 'border-[#09090B] bg-[#D2E823]/30'
                    : 'border border-[#09090B]/30 bg-[#EDE8D5]/30'
                )}
              >
                <div>
                  <span className="font-mono font-bold text-sm text-[#09090B]">
                    ¥{Number(getFieldValue('amount', '3500000')).toLocaleString()}
                  </span>
                  <span className="text-xs text-[#52525B] ml-2 font-mono uppercase">JPY</span>
                </div>
                <span
                  className={cn(
                    'text-xs font-mono font-bold',
                    amountConf < 85 ? 'text-[#FF334B]' : 'text-[#52525B]'
                  )}
                >
                  {amountConf}%
                </span>
              </button>
            </div>
          </div>

          {/* Footnote */}
          <div className="mt-4 pt-3 border-t border-[#09090B]/10 flex justify-between items-center text-xs text-[#52525B] font-mono">
            <span>Doc ID: {extraction?.document_id || 'DOC-78921'}</span>
            <span>Law 133 evidence record</span>
          </div>
        </div>
      </div>
    </div>
  );
}
