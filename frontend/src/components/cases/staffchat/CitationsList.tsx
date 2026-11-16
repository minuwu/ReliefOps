import type { Citation } from '@/types/api';

export function CitationsList({ citations }: { citations: Citation[] }) {
  if (!citations || citations.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1.5" aria-label="Cited Sources">
      {citations.map((c, idx) => (
        <li
          key={`${c.document_id}-${c.section ?? ''}-${c.page ?? ''}-${idx}`}
          className="rounded-lg border border-[#09090B]/15 bg-[#F8F4E8] p-2 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-1 font-bold text-[#09090B]">
            <span>
              {c.document_title} · v{c.version}
            </span>
            {(c.section || c.page !== null) && (
              <span className="text-xs font-mono text-[#52525B]">
                {c.section && `Sec: ${c.section}`}
                {c.section && c.page !== null && ' · '}
                {c.page !== null && `p.${c.page}`}
              </span>
            )}
          </div>
          <p className="mt-1 italic text-[#52525B]">“{c.quote}”</p>
        </li>
      ))}
    </ul>
  );
}
