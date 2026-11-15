import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import type { Bank, BankId, Language, ScamType, VictimEditableField, VictimReport } from '@/types/api';
import { api } from '@/services/api';
import { victimApi } from '@/services/victimApi';
import { errorMessage, fieldErrors } from '@/services/http';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { FormNotice } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import {
  CONTACT_FIELDS,
  CaseFieldInputs,
  REPORT_FIELDS,
  emptyValues,
  parseField,
  validateValues,
  type CaseFormValues,
} from '@/components/portal/CaseFields';
import { PATHS } from '@/routes/paths';

const ALL_FIELDS = [...CONTACT_FIELDS, ...REPORT_FIELDS];

function toReport(bankId: BankId, v: CaseFormValues): VictimReport {
  const text = (k: VictimEditableField) => parseField(k, v[k]) as string | null;
  return {
    bank_id: bankId,
    victim: {
      name: v['victim.name'].trim(),
      phone: text('victim.phone'),
      email: text('victim.email'),
      address: text('victim.address'),
      preferred_language: v['victim.preferred_language'] as Language,
    },
    amount: Number(v.amount),
    currency: 'JPY',
    transfer_date: v.transfer_date,
    account_number: text('account_number'),
    account_holder_name: text('account_holder_name'),
    scam_type: v.scam_type as ScamType,
    description: text('description'),
    consent: true,
  };
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-5 sm:p-6 shadow-hard space-y-4">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#09090B]">{title}</h2>
        <p className="text-xs text-[#52525B]">{hint}</p>
      </div>
      {children}
    </section>
  );
}

export function ReportCasePage() {
  const user = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);
  const navigate = useNavigate();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankId, setBankId] = useState<BankId | ''>('');
  const [values, setValues] = useState<CaseFormValues>(() => ({
    ...emptyValues(),
    'victim.name': user?.name ?? '',
    'victim.email': user?.email ?? '',
  }));
  const [hasConsent, setHasConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api
      .getBanks()
      .then((res) => setBanks(res.data))
      .catch((err) => setFormError(errorMessage(err, 'Could not load the list of banks.')));
  }, []);

  const handleChange = (key: VictimEditableField, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const local = validateValues(values, ALL_FIELDS);
    if (!bankId) local.bank_id = 'Choose the bank you sent the money from.';
    if (!hasConsent) local.consent = 'We need your consent to process the report.';
    setErrors(local);
    if (Object.keys(local).length || !bankId) {
      setFormError('Please fix the highlighted fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await victimApi.reportCase(toReport(bankId, values));
      pushToast(`Report received. Your case number is ${res.data.reference}.`, 'success');
      navigate(PATHS.portalCase(res.data.id), { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err, 'Could not send the report. Try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <header className="space-y-1.5 border-b border-[#09090B]/15 pb-4">
        <Link to={PATHS.portal} className="text-xs font-bold uppercase underline underline-offset-4 text-[#09090B]">
          ← Back to my cases
        </Link>
        <h1 className="text-2xl sm:text-3xl font-['Dela_Gothic_One'] uppercase text-[#09090B]">
          Report a scam
        </h1>
        <p className="text-sm font-medium text-[#52525B]">
          Tell us about the transfer. You can correct details online until staff verify the report.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Section title="Your bank" hint="The bank account you sent the money from.">
          <div className="space-y-1.5 font-['Space_Grotesk',sans-serif]">
            <label htmlFor="report-bank" className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
              Bank
            </label>
            <select
              id="report-bank"
              value={bankId}
              aria-invalid={errors.bank_id ? true : undefined}
              onChange={(e) => setBankId(e.target.value as BankId)}
              className={`h-11 w-full rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-3 text-sm font-medium shadow-[2px_2px_0px_0px_#09090B] focus:outline-none focus:shadow-hard ${
                errors.bank_id ? 'border-[#FF334B] shadow-[2px_2px_0px_0px_#FF334B]' : ''
              }`}
            >
              <option value="">Choose your bank…</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            {errors.bank_id && <p role="alert" className="text-xs font-bold text-[#FF334B]">{errors.bank_id}</p>}
          </div>
        </Section>

        <Section title="What happened" hint="Copy the details from your transfer receipt if you have it.">
          <CaseFieldInputs idPrefix="report" fields={REPORT_FIELDS} values={values} errors={errors} onChange={handleChange} />
        </Section>

        <Section title="How to reach you" hint="Staff use this only about your case.">
          <CaseFieldInputs idPrefix="report" fields={CONTACT_FIELDS} values={values} errors={errors} onChange={handleChange} />
        </Section>

        <label className="flex items-start gap-3 rounded-xl border border-[#09090B]/20 bg-[#F8F4E8] p-4 text-xs font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={hasConsent}
            onChange={(e) => setHasConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#09090B]"
            aria-invalid={errors.consent ? true : undefined}
          />
          <span className="text-[#09090B] leading-relaxed">
            I agree that the operations center and my bank may use these details to process my relief claim under the
            Furikomi Fraud Relief Act.
            {errors.consent && <span role="alert" className="block text-xs font-bold text-[#FF334B] mt-1">{errors.consent}</span>}
          </span>
        </label>

        {formError && <FormNotice tone="error">{formError}</FormNotice>}

        <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} className="w-full gap-2">
          <ShieldCheck className="w-4 h-4" /> SEND REPORT
        </Button>
      </form>
    </div>
  );
}
