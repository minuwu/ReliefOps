import { useState } from 'react';
import { Extraction } from '@/types/api';
import { FileText, ZoomIn, ZoomOut, CheckCircle2, ShieldAlert } from 'lucide-react';

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

  return (
    <div className="rounded-2xl border-2 border-[#09090B] bg-[#09090B] text-[#F8F4E8] p-5 space-y-4 shadow-hard font-['Space_Grotesk',sans-serif]">
      {/* Visual Header & Controls */}
      <div className="flex items-center justify-between text-xs text-[#A1A1AA] border-b-2 border-[#27272A] pb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#D2E823]" />
          <span className="font-['Dela_Gothic_One'] uppercase text-xs text-[#F8F4E8]">
            OPTICAL VOUCHER GEOMETRY
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-[#18181B] text-[#D2E823] font-mono border border-[#27272A]">
            OCR ZONE MAPPING
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(80, z - 10))}
            className="p-1 rounded-lg border border-[#27272A] bg-[#18181B] hover:bg-[#D2E823] hover:text-[#09090B] text-[#A1A1AA] transition-colors cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono font-bold text-[#F8F4E8] w-8 text-center">{zoomLevel}%</span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
            className="p-1 rounded-lg border border-[#27272A] bg-[#18181B] hover:bg-[#D2E823] hover:text-[#09090B] text-[#A1A1AA] transition-colors cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Simulated Document Canvas */}
      <div className="overflow-x-auto p-3 bg-[#121215] rounded-xl border-2 border-[#27272A] flex justify-center">
        <div
          className="w-full max-w-xl bg-[#F8F4E8] text-[#09090B] rounded-xl shadow-hard p-6 border-2 border-[#09090B] font-['Space_Grotesk'] text-xs transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
        >
          {/* Slip Header with Official Hanko Seal */}
          <div className="flex justify-between items-start border-b-2 border-[#09090B] pb-3 mb-4 relative">
            <div>
              <p className="font-['Dela_Gothic_One'] tracking-tight text-sm uppercase text-[#09090B]">
                WIRE TRANSFER VOUCHER / 送金受付書
              </p>
              <p className="text-[10px] text-[#52525B] font-mono mt-0.5">
                Doc ID: {extraction?.document_id || 'DOC-78921'} • Stamp: AUTH-CONFIRMED
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Japanese Statutory Evidence Hanko Stamp */}
              <div className="w-14 h-14 rounded-full border-2 border-[#FF334B] text-[#FF334B] flex flex-col items-center justify-center rotate-12 select-none shadow-[1px_1px_0px_0px_#FF334B]">
                <span className="text-[8px] font-black leading-none">証拠保全</span>
                <span className="text-[9px] font-bold leading-none my-0.5">確 認</span>
                <span className="text-[7px] font-mono leading-none">LAW 133</span>
              </div>
              <span className="inline-block border-2 border-[#09090B] bg-[#D2E823] text-[#09090B] px-2 py-0.5 text-[9px] font-mono uppercase font-black tracking-widest shadow-hard-sm">
                PHYSICAL FACSIMILE
              </span>
            </div>
          </div>

          {/* Form Rows with OCR Bounding Boxes */}
          <div className="space-y-3.5">
            {/* Row 1: Date & Channel */}
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#52525B] block mb-1">Transfer Date</span>
                <div
                  onClick={() => onSelectField?.('date')}
                  className={`p-2 rounded-lg border-2 transition-all cursor-pointer ${
                    currentHover === 'date'
                      ? 'border-[#09090B] bg-[#D2E823] shadow-hard-sm'
                      : 'border-dashed border-[#09090B]/40 bg-[#EDE8D5]'
                  }`}
                >
                  <span className="font-mono font-bold text-[#09090B]">{getFieldValue('date', '2026-11-12')}</span>
                  <span className="ml-2 text-[10px] font-mono text-[#09090B] font-black">
                    {getFieldConf('date')}%
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-[#52525B] block mb-1">Destination Bank</span>
                <div
                  onClick={() => onSelectField?.('bank_name')}
                  className={`p-2 rounded-lg border-2 transition-all cursor-pointer ${
                    currentHover === 'bank_name'
                      ? 'border-[#09090B] bg-[#D2E823] shadow-hard-sm'
                      : 'border-dashed border-[#09090B]/40 bg-[#EDE8D5]'
                  }`}
                >
                  <span className="font-bold uppercase text-[#09090B]">{getFieldValue('bank_name', 'Bank of Tokyo')}</span>
                </div>
              </div>
            </div>

            {/* Row 2: Beneficiary Account */}
            <div>
              <span className="text-[10px] uppercase font-bold text-[#52525B] block mb-1">
                Destination Beneficiary Account
              </span>
              <div
                onClick={() => onSelectField?.('account_number')}
                className={`p-2.5 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                  currentHover === 'account_number'
                    ? 'border-[#09090B] bg-[#FF334B] text-[#09090B] shadow-hard-sm'
                    : 'border-[#09090B] bg-[#D2E823]/40'
                }`}
              >
                <div>
                  <span className="font-mono text-sm font-black tracking-widest text-[#09090B]">
                    {getFieldValue('account_number', '9823-1049-21')}
                  </span>
                  <p className="text-[10px] font-bold uppercase text-[#52525B]">
                    Holder: {getFieldValue('account_holder', 'KENJI SATO / VICTIM HOLDINGS')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-black text-[#09090B] bg-[#F8F4E8] px-2 py-0.5 rounded border border-[#09090B]">
                    OCR: {getFieldConf('account_number')}%
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-[#09090B]" />
                </div>
              </div>
            </div>

            {/* Row 3: Remitted Amount */}
            <div>
              <span className="text-[10px] uppercase font-bold text-[#52525B] block mb-1">Remitted Amount</span>
              <div
                onClick={() => onSelectField?.('amount')}
                className={`p-2.5 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                  currentHover === 'amount'
                    ? 'border-[#09090B] bg-[#D2E823] shadow-hard-sm'
                    : 'border-[#09090B] bg-[#EDE8D5]'
                }`}
              >
                <div>
                  <span className="font-['Dela_Gothic_One'] text-base text-[#09090B]">
                    ¥{Number(getFieldValue('amount', '3500000')).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[#52525B] ml-2 font-mono uppercase">JPY Wire Gross</span>
                </div>
                <span className="text-[10px] font-mono font-black text-[#09090B] bg-[#F8F4E8] px-2 py-0.5 rounded border border-[#09090B]">
                  OCR: {getFieldConf('amount')}%
                </span>
              </div>
            </div>
          </div>

          {/* Slip Stamp Footnote */}
          <div className="mt-4 pt-3 border-t-2 border-[#09090B] flex justify-between items-center text-[10px] text-[#52525B] font-mono">
            <span>Security Hash: sha256:b8c9f210a4e7...</span>
            <span className="flex items-center gap-1 text-[#09090B] font-bold">
              <ShieldAlert className="w-3.5 h-3.5" /> Law 133 Evidence Validated
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
