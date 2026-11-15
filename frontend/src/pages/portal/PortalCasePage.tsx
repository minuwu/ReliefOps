import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MissingField, VictimCase, VictimEditableField } from '@/types/api';
import { victimApi } from '@/services/victimApi';
import { errorMessage } from '@/services/http';
import { FormNotice } from '@/components/auth/AuthCard';
import { StageTracker } from '@/components/portal/StageTracker';
import { CaseEditForm } from '@/components/portal/CaseEditForm';
import { CaseChat } from '@/components/portal/CaseChat';
import { CONTACT_FIELDS, FIELD_META, REPORT_FIELDS, toFormValues } from '@/components/portal/CaseFields';
import { CLOSURE_LABEL, LANGUAGE_LABEL, SCAM_LABEL, formatYen } from '@/lib/caseStages';
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
  if (key === 'amount') return formatYen(c.amount, c.currency);
  if (key === 'scam_type' && c.scam_type) return SCAM_LABEL[c.scam_type];
  if (key === 'victim.preferred_language') return LANGUAGE_LABEL[c.victim.preferred_language];
  return raw;
}

/** Fields the victim can no longer change, shown read-only. */
function LockedDetails({ caseItem }: { caseItem: VictimCase }) {
  const locked = [...REPORT_FIELDS, ...CONTACT_FIELDS].filter((f) => !caseItem.editable_fields.includes(f));
  if (locked.length === 0) return null;
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
      {locked.map((key) => (
        <div key={key} className={key === 'description' ? 'sm:col-span-2' : undefined}>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-[#52525B]">{FIELD_META[key].label}</dt>
          <dd className="font-medium text-[#09090B] whitespace-pre-wrap">{displayValue(caseItem, key)}</dd>
        </div>
      ))}
    </dl>
  );
}

const panelClass = 'rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-5 sm:p-6 shadow-hard space-y-4';

export function PortalCasePage() {
  const { caseId = '' } = useParams();
  const [caseItem, setCaseItem] = useState<VictimCase | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return victimApi
      .getMyCase(caseId)
      .then((res) => setCaseItem(res.data))
      .catch((err) => setError(errorMessage(err, 'Could not load this case.')));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-3 py-16 space-y-4 text-center">
        <FormNotice tone="error">{error}</FormNotice>
        <Link to={PATHS.portal} className="text-sm font-bold underline underline-offset-4">
          Back to my cases
        </Link>
      </div>
    );
  }
  if (!caseItem) return <p className="max-w-5xl mx-auto px-3 py-16 text-sm font-medium">Loading your case…</p>;

  const isClosed = caseItem.status === 'closed';
  const openMissing = isClosed ? [] : caseItem.missing_fields;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-8 sm:py-12 space-y-6">
      <header className="space-y-2">
        <Link to={PATHS.portal} className="text-xs font-bold uppercase underline underline-offset-4">
          ← My cases
        </Link>
        <p className="text-xs font-mono font-bold uppercase text-[#52525B]">
          {caseItem.bank_name} · reported {new Date(caseItem.submitted_at).toLocaleDateString()}
        </p>
        <h1 className="text-2xl sm:text-4xl font-['Dela_Gothic_One'] uppercase text-[#09090B]">{caseItem.reference}</h1>
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
          <h2 id="details-heading" className="text-base font-bold uppercase">
            Your details
          </h2>
          {caseItem.editable_fields.length > 0 ? (
            <>
              <p className="text-sm text-[#52525B]">You can change the fields below. Other details are locked at this stage.</p>
              <CaseEditForm key={caseItem.version} caseItem={caseItem} onSaved={setCaseItem} onReload={load} />
            </>
          ) : (
            <p className="text-sm text-[#52525B]">This case is closed, so details can no longer be changed online.</p>
          )}
          <LockedDetails caseItem={caseItem} />
        </section>

        <section className={panelClass} aria-labelledby="chat-heading">
          <h2 id="chat-heading" className="text-base font-bold uppercase">
            Questions about your case
          </h2>
          <CaseChat caseId={caseItem.id} />
        </section>
      </div>
    </div>
  );
}
