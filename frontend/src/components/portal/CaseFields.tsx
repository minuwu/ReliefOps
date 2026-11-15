/**
 * Form fields for the victim's own case. The keys are the contract's
 * VictimEditableField paths, so editable_fields and locked_fields map one-to-one.
 */
import type { Language, ScamType, VictimCase, VictimCaseUpdate, VictimEditableField } from '@/types/api';
import { Input } from '@/components/ui/Input';
import { LANGUAGE_LABEL, SCAM_LABEL } from '@/lib/caseStages';

export type CaseFormValues = Record<VictimEditableField, string>;

type Kind = 'text' | 'email' | 'tel' | 'number' | 'date' | 'scam' | 'language' | 'textarea';

interface FieldMeta {
  label: string;
  kind: Kind;
  autoComplete?: string;
  hint?: string;
}

export const FIELD_META: Record<VictimEditableField, FieldMeta> = {
  'victim.name': { label: 'Full name', kind: 'text', autoComplete: 'name' },
  'victim.phone': { label: 'Phone', kind: 'tel', autoComplete: 'tel' },
  'victim.email': { label: 'Contact email', kind: 'email', autoComplete: 'email' },
  'victim.address': { label: 'Address', kind: 'text', autoComplete: 'street-address' },
  'victim.preferred_language': { label: 'Preferred language', kind: 'language' },
  amount: { label: 'Amount sent (JPY)', kind: 'number' },
  currency: { label: 'Currency', kind: 'text' },
  transfer_date: { label: 'Date of the transfer', kind: 'date' },
  account_number: { label: 'Account you sent money to', kind: 'text', hint: 'As printed on your transfer receipt.' },
  account_holder_name: { label: 'Name on that account', kind: 'text' },
  scam_type: { label: 'Type of scam', kind: 'scam' },
  description: { label: 'What happened', kind: 'textarea', hint: 'Who contacted you, how, and what they asked for.' },
};

/** Fields a victim fills in when reporting. Currency stays JPY. */
export const CONTACT_FIELDS: VictimEditableField[] = [
  'victim.name',
  'victim.phone',
  'victim.email',
  'victim.address',
  'victim.preferred_language',
];
export const REPORT_FIELDS: VictimEditableField[] = [
  'amount',
  'transfer_date',
  'account_number',
  'account_holder_name',
  'scam_type',
  'description',
];

export function emptyValues(): CaseFormValues {
  return {
    'victim.name': '',
    'victim.phone': '',
    'victim.email': '',
    'victim.address': '',
    'victim.preferred_language': 'ja',
    amount: '',
    currency: 'JPY',
    transfer_date: '',
    account_number: '',
    account_holder_name: '',
    scam_type: '',
    description: '',
  };
}

export function toFormValues(c: VictimCase): CaseFormValues {
  return {
    'victim.name': c.victim.name,
    'victim.phone': c.victim.phone ?? '',
    'victim.email': c.victim.email ?? '',
    'victim.address': c.victim.address ?? '',
    'victim.preferred_language': c.victim.preferred_language,
    amount: c.amount === null ? '' : String(c.amount),
    currency: c.currency,
    transfer_date: c.transfer_date ?? '',
    account_number: c.account_number ?? '',
    account_holder_name: c.account_holder_name ?? '',
    scam_type: c.scam_type ?? '',
    description: c.description ?? '',
  };
}

const orNull = (v: string): string | null => v.trim() || null;

/** Converts one form string into the value the API expects for that field. */
export function parseField(key: VictimEditableField, raw: string): string | number | null {
  switch (key) {
    case 'amount':
      return Number(raw);
    case 'victim.name':
    case 'currency':
    case 'transfer_date':
    case 'scam_type':
    case 'victim.preferred_language':
      return raw.trim();
    default:
      return orNull(raw);
  }
}

/** Client-side checks that match the contract; the server still validates. */
export function validateValues(values: CaseFormValues, fields: VictimEditableField[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const has = (k: VictimEditableField) => fields.includes(k);
  if (has('victim.name') && !values['victim.name'].trim()) errors['victim.name'] = 'Enter your name.';
  if (has('amount')) {
    const amount = Number(values.amount);
    if (!values.amount || !Number.isFinite(amount) || amount <= 0) errors.amount = 'Enter the amount you sent.';
  }
  if (has('transfer_date')) {
    if (!values.transfer_date) errors.transfer_date = 'Enter the date you sent the money.';
    else if (values.transfer_date > new Date().toISOString().slice(0, 10)) {
      errors.transfer_date = 'The date cannot be in the future.';
    }
  }
  if (has('scam_type') && !values.scam_type) errors.scam_type = 'Choose the closest type.';
  if (has('victim.email') && values['victim.email'] && !values['victim.email'].includes('@')) {
    errors['victim.email'] = 'Enter a valid email address.';
  }
  return errors;
}

/** Only the fields that changed, shaped as a PATCH body (without expected_version). */
export function buildUpdate(
  before: CaseFormValues,
  after: CaseFormValues,
  editable: VictimEditableField[]
): Omit<VictimCaseUpdate, 'expected_version'> {
  const update: Record<string, unknown> = {};
  const victim: Record<string, unknown> = {};
  for (const key of editable) {
    if (before[key] === after[key]) continue;
    const value = parseField(key, after[key]);
    if (key.startsWith('victim.')) victim[key.slice('victim.'.length)] = value;
    else update[key] = value;
  }
  if (Object.keys(victim).length) update.victim = victim;
  return update as Omit<VictimCaseUpdate, 'expected_version'>;
}

/* --- Rendering ----------------------------------------------------------- */

const controlClass =
  'w-full rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-3 text-sm font-medium text-[#09090B] shadow-[2px_2px_0px_0px_#09090B] focus:outline-none focus:shadow-hard';

function fieldId(prefix: string, key: VictimEditableField): string {
  return `${prefix}-${key.replace('.', '-')}`;
}

interface CaseFieldInputsProps {
  idPrefix: string;
  fields: VictimEditableField[];
  values: CaseFormValues;
  errors: Record<string, string>;
  onChange: (key: VictimEditableField, value: string) => void;
}

export function CaseFieldInputs({ idPrefix, fields, values, errors, onChange }: CaseFieldInputsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((key) => (
        <FieldControl
          key={key}
          id={fieldId(idPrefix, key)}
          name={key}
          value={values[key]}
          error={errors[key]}
          onChange={(v) => onChange(key, v)}
        />
      ))}
    </div>
  );
}

interface FieldControlProps {
  id: string;
  name: VictimEditableField;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function FieldControl({ id, name, value, error, onChange }: FieldControlProps) {
  const meta = FIELD_META[name];
  const isWide = meta.kind === 'textarea' || name === 'victim.address';

  if (meta.kind === 'text' || meta.kind === 'email' || meta.kind === 'tel' || meta.kind === 'number' || meta.kind === 'date') {
    return (
      <div className={isWide ? 'sm:col-span-2' : undefined}>
        <Input
          id={id}
          label={meta.label}
          type={meta.kind}
          inputMode={meta.kind === 'number' ? 'numeric' : undefined}
          min={meta.kind === 'number' ? 1 : undefined}
          autoComplete={meta.autoComplete}
          helperText={meta.hint}
          error={error}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  const hintId = `${id}-hint`;
  const errorBorder = error ? 'border-[#FF334B] shadow-[2px_2px_0px_0px_#FF334B]' : '';

  return (
    <div className={`space-y-1.5 font-['Space_Grotesk',sans-serif] ${isWide ? 'sm:col-span-2' : ''}`}>
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
        {meta.label}
      </label>
      {meta.kind === 'textarea' ? (
        <textarea
          id={id}
          rows={4}
          maxLength={4000}
          aria-describedby={hintId}
          aria-invalid={error ? true : undefined}
          className={`${controlClass} py-2 ${errorBorder}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <select
          id={id}
          aria-describedby={hintId}
          aria-invalid={error ? true : undefined}
          className={`${controlClass} h-11 ${errorBorder}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {meta.kind === 'scam' && <option value="">Choose…</option>}
          {meta.kind === 'scam' &&
            (Object.keys(SCAM_LABEL) as ScamType[]).map((s) => (
              <option key={s} value={s}>
                {SCAM_LABEL[s]}
              </option>
            ))}
          {meta.kind === 'language' &&
            (Object.keys(LANGUAGE_LABEL) as Language[]).map((l) => (
              <option key={l} value={l}>
                {LANGUAGE_LABEL[l]}
              </option>
            ))}
        </select>
      )}
      <p id={hintId} role={error ? 'alert' : undefined} className={`text-xs ${error ? 'font-bold text-[#FF334B]' : 'text-[#52525B]'}`}>
        {error ?? meta.hint ?? ''}
      </p>
    </div>
  );
}
