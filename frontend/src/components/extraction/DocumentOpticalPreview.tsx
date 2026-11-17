import { useState } from 'react';
import { FileText, ZoomIn, ZoomOut } from 'lucide-react';
import { documentsApi } from '@/services/documentsApi';
import { errorMessage } from '@/services/http';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { useObjectUrl } from '@/lib/hooks/useObjectUrl';
import { Button } from '@/components/ui/Button';

interface DocumentOpticalPreviewProps {
  documentId: string;
}

const ZOOM_MIN = 60;
const ZOOM_MAX = 200;
const ZOOM_STEP = 20;

export function DocumentOpticalPreview({ documentId }: DocumentOpticalPreviewProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const {
    data: file,
    loading: isLoading,
    error: rawError,
    reload,
  } = useAsyncResource(`extraction-file-${documentId}`, () =>
    documentsApi.downloadDocument(documentId),
  );

  const objectUrl = useObjectUrl(file?.blob);
  const mimeType = file?.blob.type ?? '';
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';

  return (
    <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-4 sm:p-5 space-y-4 font-['Space_Grotesk',sans-serif]">
      <div className="flex items-center justify-between text-xs text-[#52525B] border-b border-[#09090B]/10 pb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 shrink-0 text-[#09090B]" />
          <span className="font-bold uppercase tracking-wide text-xs text-[#09090B] truncate">
            {file?.filename ?? 'Uploaded document'}
          </span>
        </div>

        {isImage && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
              className="p-1 rounded-lg border border-[#09090B]/20 bg-[#EDE8D5] hover:bg-[#D2E823] text-[#09090B] transition-colors cursor-pointer"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono font-bold text-[#09090B] w-10 text-center">
              {zoomLevel}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
              className="p-1 rounded-lg border border-[#09090B]/20 bg-[#EDE8D5] hover:bg-[#D2E823] text-[#09090B] transition-colors cursor-pointer"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[#09090B]/15 bg-[#EDE8D5]/50 overflow-auto max-h-[70vh] min-h-64">
        {isLoading && (
          <p role="status" className="p-6 text-xs font-bold text-[#52525B]">
            Loading the uploaded document…
          </p>
        )}

        {!isLoading && rawError !== undefined && rawError !== null && (
          <div role="alert" className="p-6 space-y-3 text-xs">
            <p className="font-bold text-[#FF334B]">
              {errorMessage(rawError, 'We could not load the uploaded document.')}
            </p>
            <Button variant="outline" size="sm" onClick={reload}>
              Try again
            </Button>
          </div>
        )}

        {objectUrl && isPdf && (
          <iframe
            src={objectUrl}
            title={`Uploaded document ${file?.filename ?? ''}`}
            className="w-full h-[65vh] bg-white"
          />
        )}

        {objectUrl && isImage && (
          <img
            src={objectUrl}
            alt={`Uploaded document ${file?.filename ?? ''}`}
            style={{ width: `${zoomLevel}%`, maxWidth: 'none' }}
            className="block"
          />
        )}

        {objectUrl && !isPdf && !isImage && (
          <p className="p-6 text-xs font-bold text-[#52525B]">
            This file type ({mimeType || 'unknown'}) cannot be previewed here.
          </p>
        )}
      </div>
    </div>
  );
}
