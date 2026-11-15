import { useState, type FormEvent } from 'react';
import type { VictimCase, VictimEditableField } from '@/types/api';
import { victimApi } from '@/services/victimApi';
import { errorMessage, fieldErrors, isApiError } from '@/services/http';
import { useToastStore } from '@/store/useToastStore';
import { FormNotice } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { CaseFieldInputs, FIELD_META, buildUpdate, toFormValues, validateValues, type CaseFormValues } from './CaseFields';

interface CaseEditFormProps {
  caseItem: VictimCase;
  onSaved: (updated: VictimCase) => void;
  /** Re-fetch the case after the server says this copy is out of date. */
  onReload: () => void;
}

/**
 * Edits only the fields the server lists in editable_fields. Sends just the changed
 * fields with expected_version. Render it with key={caseItem.version} so it resets.
 */
export function CaseEditForm({ caseItem, onSaved, onReload }: CaseEditFormProps) {
  const pushToast = useToastStore((s) => s.push);
  const [original] = useState<CaseFormValues>(() => toFormValues(caseItem));
  const [values, setValues] = useState<CaseFormValues>(original);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const editable = caseItem.editable_fields;

  const handleChange = (key: VictimEditableField, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const handleConflict = (err: unknown): boolean => {
    if (!isApiError(err)) return false;
    if (err.code === 'STALE_CASE') {
      pushToast('This case changed since you opened it. We loaded the latest version.', 'info');
      onReload();
      return true;
    }
    if (err.code === 'CASE_LOCKED') {
      const locked = (err.details?.locked_fields ?? []) as VictimEditableField[];
      const names = locked.map((f) => FIELD_META[f]?.label ?? f).join(', ');
      pushToast(`${err.message}${names ? ` Locked: ${names}.` : ''}`, 'error');
      onReload();
      return true;
    }
    if (err.code === 'CASE_CLOSED') {
      pushToast(err.message, 'error');
      onReload();
      return true;
    }
    return false;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const local = validateValues(values, editable);
    setErrors(local);
    if (Object.keys(local).length) return;

    const changes = buildUpdate(original, values, editable);
    if (Object.keys(changes).length === 0) {
      setFormError('Nothing has changed yet.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await victimApi.updateMyCase(caseItem.id, { ...changes, expected_version: caseItem.version });
      pushToast('Your changes are saved.', 'success');
      onSaved(res.data);
    } catch (err) {
      if (!handleConflict(err)) {
        setErrors(fieldErrors(err));
        setFormError(errorMessage(err, 'Could not save. Try again.'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate aria-label="Edit your case details">
      <CaseFieldInputs idPrefix="edit" fields={editable} values={values} errors={errors} onChange={handleChange} />
      {formError && <FormNotice tone="error">{formError}</FormNotice>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" isLoading={isSaving}>
          SAVE CHANGES
        </Button>
        <Button type="button" variant="outline" disabled={isSaving} onClick={() => setValues(original)}>
          UNDO EDITS
        </Button>
      </div>
    </form>
  );
}
