import { useState, type FormEvent } from 'react';
import { Upload } from 'lucide-react';
import type { Bank, KbDocument, Language } from '@/types/api';
import { kbApi } from '@/services/kbApi';
import { errorMessage } from '@/services/http';
import { useToastStore } from '@/store/useToastStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { panelClass, selectClass, labelClass } from './kbFormat';

function validateUpload(
  file: File | null,
  bankId: string,
  title: string,
  version: string
): Record<string, string> {
  const local: Record<string, string> = {};
  if (!file) {
    local.file = 'Select a PDF or TXT file to upload.';
  } else {
    const isAllowed =
      file.type === 'application/pdf' ||
      file.type === 'text/plain' ||
      file.name.toLowerCase().endsWith('.pdf') ||
      file.name.toLowerCase().endsWith('.txt');
    if (!isAllowed) local.file = 'Only PDF or TXT files are allowed.';
    if (file.size > 20 * 1024 * 1024) local.file = 'File is larger than 20 MB.';
    if (file.size === 0) local.file = 'File cannot be empty.';
  }
  if (!bankId) local.bank_id = 'Select the bank for this guidance document.';
  if (!title.trim()) local.title = 'Enter the document title.';
  else if (title.trim().length > 200) local.title = 'Title must be 200 characters or less.';
  if (!version.trim()) local.version = 'Enter the version (e.g. 2026.1).';
  else if (version.trim().length > 40) local.version = 'Version must be 40 characters or less.';
  return local;
}

function FileUploadField({
  error,
  onChange,
}: {
  error?: string;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <label htmlFor="kb-file" className={labelClass}>
        File (PDF or TXT, max 20 MB)
      </label>
      <input
        id="kb-file"
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="block w-full text-xs text-[#09090B] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[#09090B]/30 file:bg-[#EDE8D5] file:text-xs file:font-bold file:uppercase file:cursor-pointer hover:file:bg-[#D2E823] cursor-pointer"
      />
      {error && <p role="alert" className="text-xs font-bold text-[#FF334B]">{error}</p>}
    </div>
  );
}

function BankSelectField({
  banks,
  value,
  error,
  onChange,
}: {
  banks: Bank[];
  value: string;
  error?: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="kb-bank" className={labelClass}>
        Bank
      </label>
      <select id="kb-bank" className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select bank…</option>
        {banks.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {error && <p role="alert" className="text-xs font-bold text-[#FF334B]">{error}</p>}
    </div>
  );
}

function SelectMetaFields({
  language,
  audience,
  onLanguageChange,
  onAudienceChange,
}: {
  language: Language;
  audience: 'victim_facing' | 'staff_only';
  onLanguageChange: (lang: Language) => void;
  onAudienceChange: (aud: 'victim_facing' | 'staff_only') => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="kb-language" className={labelClass}>
          Language
        </label>
        <select
          id="kb-language"
          className={selectClass}
          value={language}
          onChange={(e) => onLanguageChange(e.target.value as Language)}
        >
          <option value="ja">Japanese (ja)</option>
          <option value="en">English (en)</option>
          <option value="bn">Bengali (bn)</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="kb-audience" className={labelClass}>
          Audience
        </label>
        <select
          id="kb-audience"
          className={selectClass}
          value={audience}
          onChange={(e) => onAudienceChange(e.target.value as 'victim_facing' | 'staff_only')}
        >
          <option value="victim_facing">Victim Facing (Assistant cites for answers)</option>
          <option value="staff_only">Staff Only (Internal operations guide)</option>
        </select>
      </div>
    </>
  );
}

function FormSubmitSection({
  formError,
  isUploading,
}: {
  formError: string | null;
  isUploading: boolean;
}) {
  return (
    <div className="sm:col-span-2 space-y-3">
      {formError && (
        <div role="alert" className="rounded-xl border border-[#FF334B]/30 bg-[#FF334B]/10 p-3 text-xs font-bold text-[#FF334B]">
          {formError}
        </div>
      )}
      <Button type="submit" variant="primary" isLoading={isUploading} className="gap-2">
        <Upload className="w-4 h-4" /> UPLOAD BLUEBOOK
      </Button>
    </div>
  );
}

function useUploadForm(onUploaded: (doc: KbDocument) => void) {
  const pushToast = useToastStore((s) => s.push);
  const [file, setFile] = useState<File | null>(null);
  const [bankId, setBankId] = useState('');
  const [title, setTitle] = useState('');
  const [version, setVersion] = useState('');
  const [language, setLanguage] = useState<Language>('ja');
  const [audience, setAudience] = useState<'victim_facing' | 'staff_only'>('victim_facing');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setVersion('');
    const input = document.getElementById('kb-file') as HTMLInputElement | null;
    if (input) input.value = '';
  };

  const uploadFile = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await kbApi.upload({
        file,
        bank_id: bankId,
        title: title.trim(),
        version: version.trim(),
        language,
        audience,
      });
      pushToast(`Bluebook "${res.data.title}" uploaded. Ready for publishing.`, 'success');
      onUploaded(res.data);
      resetForm();
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to upload bluebook.'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const local = validateUpload(file, bankId, title, version);
    setErrors(local);
    if (Object.keys(local).length === 0 && file) {
      await uploadFile();
    }
  };

  return {
    file,
    bankId,
    title,
    version,
    language,
    audience,
    errors,
    formError,
    isUploading,
    setFile,
    setBankId,
    setTitle,
    setVersion,
    setLanguage,
    setAudience,
    handleSubmit,
  };
}

function UploadBluebookForm({ banks, onUploaded }: Props) {
  const form = useUploadForm(onUploaded);

  return (
    <form onSubmit={form.handleSubmit} className="grid gap-4 sm:grid-cols-2" noValidate aria-label="Upload bluebook">
      <FileUploadField error={form.errors.file} onChange={form.setFile} />
      <BankSelectField banks={banks} value={form.bankId} error={form.errors.bank_id} onChange={form.setBankId} />
      <Input
        label="Title"
        id="kb-title"
        placeholder="e.g. Fraud Relief Operations Bluebook"
        value={form.title}
        error={form.errors.title}
        onChange={(e) => form.setTitle(e.target.value)}
      />
      <Input
        label="Version"
        id="kb-version"
        placeholder="e.g. 2026.1"
        value={form.version}
        error={form.errors.version}
        onChange={(e) => form.setVersion(e.target.value)}
      />
      <SelectMetaFields
        language={form.language}
        audience={form.audience}
        onLanguageChange={form.setLanguage}
        onAudienceChange={form.setAudience}
      />
      <FormSubmitSection formError={form.formError} isUploading={form.isUploading} />
    </form>
  );
}

export type Props = {
  banks: Bank[];
  onUploaded: (doc: KbDocument) => void;
};

export function KbUploadPanel({ banks, onUploaded }: Props) {
  return (
    <section className={panelClass} aria-labelledby="upload-heading">
      <h2 id="upload-heading" className="text-sm font-bold uppercase tracking-wide text-[#09090B]">
        Upload Bluebook
      </h2>
      <p className="text-sm text-[#52525B]">
        Upload bank guidance documents (PDF or TXT, max 20 MB). Synthetic documents only.
      </p>
      <UploadBluebookForm banks={banks} onUploaded={onUploaded} />
    </section>
  );
}
