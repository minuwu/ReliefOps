import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MissingField, VictimCase, VictimEditableField } from '@/types/api';
import { victimApi } from '@/services/victimApi';
import { errorMessage } from '@/services/http';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { FormNotice } from '@/components/auth/AuthCard';
import { StageTracker } from '@/components/portal/StageTracker';
import { CaseEditForm } from '@/components/portal/CaseEditForm';
import { CaseChat } from '@/components/portal/CaseChat';
import { CONTACT_FIELDS, FIELD_META, REPORT_FIELDS, toFormValues } from '@/components/portal/CaseFields';
import { CLOSURE_LABEL, LANGUAGE_LABEL, SCAM_LABEL } from '@/lib/caseStages';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { PATHS } from '@/routes/paths';

const MISSING_LABEL: Record<MissingField, string> = {
  victim_contact: 'a phone number or email',
  amount: 'the amount you sent',
  transfer_date: 'the date of the transfer',
  account_number: 'the account you sent money to',
  scam_type: 'the type of scam',
  document: 'a copy of your transfer receipt (staff will ask for it)',
};

function displayValue(c: VictimCase, key: VictimEditableField): string {
  const raw = toFormValues(c)[key];
  if (!raw) return '—';
  if (key === 'amount') return formatCurrency(c.amount, c.currency);
  if (key === 'scam_type' && c.scam_type) return SCAM_LABEL[c.scam_type];
  if (key === 'victim.preferred_language') return LANGUAGE_LABEL[c.victim.preferred_language];
  return raw;
}

/** Fields the victim can no longer change, shown read-only. */
function LockedDetails({ caseItem }: { caseItem: VictimCase }) {
  const locked = [...REPORT_FIELDS, ...CONTACT_FIELDS].filter((f) => !caseItem.editable_fields.includes(f));
  if (locked.length === 0) return null;
  return (
    <div className="border-t border-[#09090B]/10 pt-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#52525B] mb-3">Locked claim details</h3>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
        {locked.map((key) => (
          <div key={key} className={key === 'description' ? 'sm:col-span-2' : undefined}>
            <dt className="text-xs font-bold uppercase tracking-wider text-[#52525B]">{FIELD_META[key].label}</dt>
            <dd className="font-medium text-[#09090B] whitespace-pre-wrap">{displayValue(caseItem, key)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const panelClass = 'rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-4 sm:p-6 shadow-hard space-y-4';

export function PortalCasePage() {
  const { caseId = '' } = useParams();
  const { data: initialCase, error, reload } = useAsyncResource(
    caseId ? `victim-case:${caseId}` : null,
    async () => {
      const res = await victimApi.getMyCase(caseId);
      return res.data;
    },
  );
  const [updatedCase, setUpdatedCase] = useState<VictimCase | null>(null);

  const caseItem = updatedCase && updatedCase.id === caseId ? updatedCase : (initialCase ?? null);

  const handleSaved = useCallback((updated: VictimCase) => {
    setUpdatedCase(updated);
  }, []);

  const handleReload = useCallback(() => {
    setUpdatedCase(null);
    reload();
  }, [reload]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 space-y-4 text-center">
        <FormNotice tone="error">{errorMessage(error, 'Could not load this case.')}</FormNotice>
        <div className="flex items-center justify-center gap-4">
          <Button type="button" variant="outline" size="sm" onClick={reload}>
            Try again
          </Button>
          <Link to={PATHS.portal} className="text-sm font-bold underline underline-offset-4">
            Back to my cases
          </Link>
        </div>
      </div>
    );
  }
  if (!caseItem) return <p className="max-w-5xl mx-auto px-4 py-16 text-sm font-medium">Loading your case…</p>;

  const isClosed = caseItem.status === 'closed';
  const openMissing = isClosed ? [] : caseItem.missing_fields;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header className="space-y-1.5 border-b border-[#09090B]/15 pb-4">
        <Link to={PATHS.portal} className="text-xs font-bold uppercase underline underline-offset-4 text-[#09090B]">
          ← Back to my cases
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1">
          <h1 className="text-2xl sm:text-3xl font-['Dela_Gothic_One'] text-[#09090B] font-mono">
            {caseItem.reference}
          </h1>
          <p className="text-xs font-mono font-bold uppercase text-[#52525B]">
            {caseItem.bank_name} · Reported {formatDate(caseItem.submitted_at)}
          </p>
        </div>
        <p className="text-sm text-[#52525B]">
          Follow your claim progress, update information, and chat with staff.
        </p>
      </header>

      <section className={panelClass} aria-label="Progress">
        <StageTracker status={caseItem.status} />
        {caseItem.closure_reason && (
          <FormNotice tone={caseItem.closure_reason === 'paid_out' ? 'success' : 'info'}>
            Result: {CLOSURE_LABEL[caseItem.closure_reason]}.
          </FormNotice>
        )}
        {openMissing.length > 0 && (
          <FormNotice tone="info">
            We still need {openMissing.map((f) => MISSING_LABEL[f]).join(', ')}.
          </FormNotice>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <section className={panelClass} aria-labelledby="details-heading">
          <h2 id="details-heading" className="text-sm font-bold uppercase tracking-wide text-[#09090B]">
            Your details
          </h2>
          {caseItem.editable_fields.length > 0 ? (
            <>
              <p className="text-xs text-[#52525B]">You can change the fields below. Other details are locked at this stage.</p>
              <CaseEditForm key={caseItem.version} caseItem={caseItem} onSaved={handleSaved} onReload={handleReload} />
            </>
          ) : (
            <p className="text-xs text-[#52525B]">This case is closed, so details can no longer be changed online.</p>
          )}
          <LockedDetails caseItem={caseItem} />
        </section>

        <section className={`${panelClass} lg:sticky lg:top-4 lg:self-start`} aria-labelledby="chat-heading">
          <h2 id="chat-heading" className="text-sm font-bold uppercase tracking-wide text-[#09090B]">
            Questions about your case
          </h2>
          <CaseChat caseId={caseItem.id} />
        </section>
      </div>
    </div>
  );
}
