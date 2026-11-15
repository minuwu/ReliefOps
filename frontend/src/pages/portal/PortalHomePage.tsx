import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FilePlus2 } from 'lucide-react';
import type { VictimCase } from '@/types/api';
import { victimApi } from '@/services/victimApi';
import { errorMessage } from '@/services/http';
import { useAuthStore } from '@/store/useAuthStore';
import { FormNotice } from '@/components/auth/AuthCard';
import { StageTracker } from '@/components/portal/StageTracker';
import { CLOSURE_LABEL, formatYen } from '@/lib/caseStages';
import { PATHS } from '@/routes/paths';

const ctaClass =
  'inline-flex items-center gap-2 rounded-xl border-2 border-[#09090B] bg-[#D2E823] px-4 py-2.5 text-xs font-bold uppercase tracking-wider shadow-hard hover:bg-[#e4fc28]';

function CaseCard({ item }: { item: VictimCase }) {
  return (
    <li>
      <Link
        to={PATHS.portalCase(item.id)}
        className="block rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-5 shadow-hard transition-colors hover:border-[#09090B]/80"
      >
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <p className="text-xs font-mono font-bold uppercase text-[#52525B]">{item.bank_name}</p>
            <p className="text-base font-mono font-bold text-[#09090B]">{item.reference}</p>
          </div>
          <p className="text-sm font-bold text-[#09090B]">{formatYen(item.amount, item.currency)}</p>
        </div>
        <StageTracker status={item.status} isCompact />
        {item.closure_reason && (
          <p className="mt-2 text-xs font-bold uppercase text-[#09090B]">Result: {CLOSURE_LABEL[item.closure_reason]}</p>
        )}
        {item.missing_fields.length > 0 && item.status !== 'closed' && (
          <p className="mt-2 text-xs font-bold text-[#FF334B]">Some information is still missing. Open the case to see details.</p>
        )}
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase text-[#09090B]">
          Open case <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

export function PortalHomePage() {
  const name = useAuthStore((s) => s.user?.name);
  const [cases, setCases] = useState<VictimCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    victimApi
      .getMyCases()
      .then((res) => isActive && setCases(res.data))
      .catch((err) => isActive && setError(errorMessage(err, 'Could not load your cases.')));
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#09090B]/15 pb-4">
        <div className="space-y-1">
          <p className="text-xs font-mono font-bold uppercase text-[#52525B]">Victim portal</p>
          <h1 className="text-2xl sm:text-3xl font-['Dela_Gothic_One'] uppercase text-[#09090B]">
            {name ? `Hello, ${name}` : 'My cases'}
          </h1>
          <p className="text-sm text-[#52525B] font-medium">
            Track your relief claims, update information, and chat with staff.
          </p>
        </div>
        <Link to={PATHS.portalReport} className={ctaClass}>
          <FilePlus2 className="w-4 h-4" aria-hidden="true" /> Report a scam
        </Link>
      </header>

      {error && <FormNotice tone="error">{error}</FormNotice>}
      {!cases && !error && <p className="text-sm font-medium text-[#52525B]">Loading your cases…</p>}

      {cases && cases.length === 0 && (
        <section className="rounded-2xl border-2 border-dashed border-[#09090B] p-8 text-center space-y-3 bg-[#F8F4E8]">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#09090B]">No cases reported yet</h2>
          <p className="text-sm font-medium text-[#52525B] max-w-md mx-auto">
            If you sent money because of a scam, report it here. If staff already took your report by phone or on paper,
            use the link in the email they sent you to add the case to this account.
          </p>
          <div>
            <Link to={PATHS.portalReport} className={ctaClass}>
              Report a scam
            </Link>
          </div>
        </section>
      )}

      {cases && cases.length > 0 && (
        <ul className="grid gap-5 md:grid-cols-2" aria-label="My cases">
          {cases.map((c) => (
            <CaseCard key={c.id} item={c} />
          ))}
        </ul>
      )}
    </div>
  );
}
