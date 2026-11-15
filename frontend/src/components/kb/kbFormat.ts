export const panelClass = 'rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-5 sm:p-6 shadow-hard space-y-4';
export const selectClass =
  'h-11 w-full rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-3 text-sm font-medium shadow-[2px_2px_0px_0px_#09090B]';
export const labelClass = 'block text-xs font-bold uppercase tracking-wider text-[#09090B]';

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}
