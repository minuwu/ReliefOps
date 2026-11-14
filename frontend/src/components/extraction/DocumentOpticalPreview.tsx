import { useState } from 'react';
import { Extraction } from '@/types/api';
import { FileText, ZoomIn, ZoomOut, CheckCircle2, ShieldAlert } from 'lucide-react';

interface DocumentOpticalPreviewProps {
  extraction: Extraction;
  activeFieldHover?: string | null;
}

export function DocumentOpticalPreview({ extraction, activeFieldHover }: DocumentOpticalPreviewProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Map extracted field names to visual bounding values
  const getFieldValue = (name: string, fallback: string) => {
    const f = extraction.fields.find((field) => field.name === name);
    return f ? String(f.value ?? fallback) : fallback;
  };

  const getFieldConf = (name: string) => {
    const f = extraction.fields.find((field) => field.name === name);
    return f ? Math.round(f.confidence * 100) : 85;
  };

  return (
    <div className="rounded-xl border border-border bg-slate-900/80 backdrop-blur-sm p-4 space-y-3">
      {/* Visual Header & Controls */}
      <div className="flex items-center justify-between text-xs text-slate-300 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-teal-400" />
          <span className="font-semibold text-white">Optical Document Geometry Inspection</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            OCR Layer • Multi-Zone
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(80, z - 10))}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-slate-400 w-8 text-center">{zoomLevel}%</span>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Simulated Document Canvas */}
      <div className="overflow-x-auto p-2 bg-slate-950 rounded-lg border border-slate-800/80 flex justify-center">
        <div
          className="w-full max-w-xl bg-amber-50/95 dark:bg-stone-900 text-stone-900 dark:text-stone-100 rounded shadow-md p-5 border border-stone-300 dark:border-stone-700 font-sans text-xs transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
        >
          {/* Slip Header */}
          <div className="flex justify-between items-start border-b-2 border-stone-800 dark:border-stone-400 pb-2 mb-3">
            <div>
              <p className="font-bold tracking-tight text-sm uppercase">WIRE TRANSFER VOUCHER / 送金受付書</p>
              <p className="text-[10px] text-stone-500 font-mono">Doc ID: {extraction.document_id} • Stamp: AUTH-OK</p>
            </div>
            <div className="text-right">
              <span className="inline-block border border-stone-700 px-2 py-0.5 text-[9px] font-mono uppercase font-bold tracking-widest">
                VERIFIED COPY
              </span>
            </div>
          </div>

          {/* Form Rows with OCR Bounding Boxes */}
          <div className="space-y-3">
            {/* Row 1: Date & Channel */}
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-[9px] uppercase font-bold text-stone-500 block">Transfer Date</span>
                <div className={`p-1.5 rounded border transition-all ${
                  activeFieldHover === 'date'
                    ? 'border-teal-500 bg-teal-500/20 ring-2 ring-teal-400/40'
                    : 'border-dashed border-stone-400 dark:border-stone-600 bg-stone-100/50 dark:bg-stone-800/40'
                }`}>
                  <span className="font-mono font-medium">{getFieldValue('date', '2026-11-12')}</span>
                  <span className="ml-2 text-[9px] font-mono text-teal-600 dark:text-teal-400 font-bold">
                    {getFieldConf('date')}%
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[9px] uppercase font-bold text-stone-500 block">Destination Bank</span>
                <div className={`p-1.5 rounded border transition-all ${
                  activeFieldHover === 'bank_name'
                    ? 'border-teal-500 bg-teal-500/20 ring-2 ring-teal-400/40'
                    : 'border-dashed border-stone-400 dark:border-stone-600 bg-stone-100/50 dark:bg-stone-800/40'
                }`}>
                  <span className="font-semibold">{getFieldValue('bank_name', 'Acorn Trust Bank')}</span>
                </div>
              </div>
            </div>

            {/* Row 2: Beneficiary Account (High Value OCR Focus) */}
            <div>
              <span className="text-[9px] uppercase font-bold text-stone-500 block">
                Destination Account (Beneficiary)
              </span>
              <div className={`p-2 rounded border transition-all flex items-center justify-between ${
                activeFieldHover === 'account_number'
                  ? 'border-rose-500 bg-rose-500/20 ring-2 ring-rose-400/40'
                  : 'border-teal-500/70 bg-teal-500/10'
              }`}>
                <div>
                  <span className="font-mono text-sm font-bold tracking-wide">
                    {getFieldValue('account_number', '9823-1049-21')}
                  </span>
                  <p className="text-[9px] text-stone-500">
                    Holder: {getFieldValue('account_holder', 'KENJI SATO / VICTIM HOLDINGS')}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono font-bold text-teal-700 dark:text-teal-300 bg-teal-500/20 px-1.5 py-0.5 rounded">
                    OCR: {getFieldConf('account_number')}%
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                </div>
              </div>
            </div>

            {/* Row 3: Amount Sent */}
            <div>
              <span className="text-[9px] uppercase font-bold text-stone-500 block">Remitted Amount</span>
              <div className={`p-2 rounded border transition-all flex items-center justify-between ${
                activeFieldHover === 'amount'
                  ? 'border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-400/40'
                  : 'border-emerald-500/60 bg-emerald-500/10'
              }`}>
                <div>
                  <span className="font-mono text-base font-black text-emerald-800 dark:text-emerald-300">
                    ¥{Number(getFieldValue('amount', '3500000')).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-stone-500 ml-2 font-mono">JPY Wire Gross</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                  OCR: {getFieldConf('amount')}%
                </span>
              </div>
            </div>
          </div>

          {/* Slip Stamp Footnote */}
          <div className="mt-4 pt-2 border-t border-stone-300 dark:border-stone-700 flex justify-between items-center text-[9px] text-stone-400 font-mono">
            <span>Security Hash: sha256:b8c9f210a4e7...</span>
            <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-bold">
              <ShieldAlert className="w-3 h-3" /> Machine OCR Validated
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
