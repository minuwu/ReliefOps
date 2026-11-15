import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DEMO_BANKS } from '@/services/mockData';
import { api } from '@/services/api';
import { errorMessage } from '@/services/http';
import type { BankId, Case, IntakeChannel, ScamType } from '@/types/api';
import { CheckCircle2 } from 'lucide-react';

interface CaseIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated?: (created: Case) => void;
}

const SCAM_OPTIONS: { value: ScamType; label: string }[] = [
  { value: 'investment', label: 'Investment / High-Yield Scam' },
  { value: 'impersonation', label: 'Police / Financial Authority Impersonation' },
  { value: 'phishing', label: 'Phishing (SMS / Email)' },
  { value: 'romance', label: 'International Romance Solicitation' },
  { value: 'lottery_prize', label: 'Lottery / Prize Scam' },
  { value: 'job_offer', label: 'Fake Job Offer' },
  { value: 'other', label: 'Other' },
];

const STAFF_CHANNELS: { value: IntakeChannel; label: string }[] = [
  { value: 'phone', label: 'Phone call' },
  { value: 'paper', label: 'Paper form' },
];

export function CaseIntakeModal({ isOpen, onClose, onCaseCreated }: CaseIntakeModalProps) {
  const [bankId, setBankId] = useState<BankId>(DEMO_BANKS[0].id as BankId);
  const [channel, setChannel] = useState<IntakeChannel>('phone');
  const [victimName, setVictimName] = useState('');
  const [victimPhone, setVictimPhone] = useState('');
  const [victimEmail, setVictimEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [scamType, setScamType] = useState<ScamType>('investment');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!victimName.trim()) {
      setError('Enter the victim name. Other details can be added later.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.createCase({
        bank_id: bankId,
        channel,
        victim: {
          name: victimName.trim(),
          phone: victimPhone.trim() || null,
          email: victimEmail.trim() || null,
          preferred_language: 'ja',
        },
        amount: amount ? Number(amount) : null,
        currency: 'JPY',
        account_number: accountNumber.trim() || null,
        account_holder_name: accountName.trim() || null,
        scam_type: scamType,
        description: description.trim() || null,
      });
      onCaseCreated?.(res.data);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Failed to create the case.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New case intake" maxWidth="2xl">
      <form onSubmit={handleSubmit} className="space-y-4 font-['Space_Grotesk',sans-serif]">
        {error && (
          <div className="p-3 rounded-xl border border-[#FF334B]/30 bg-[#FF334B]/10 text-[#FF334B] text-xs font-bold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Target Bank */}
          <div className="space-y-1.5">
            <label htmlFor="intake-bank" className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
              Affected partner bank
            </label>
            <select
              id="intake-bank"
              value={bankId}
              onChange={(e) => setBankId(e.target.value as BankId)}
              className="w-full text-xs font-medium bg-[#F8F4E8] border border-[#09090B]/20 rounded-xl p-2.5 focus:outline-none focus:border-[#09090B]"
            >
              {DEMO_BANKS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.id.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Scam Typology */}
          <div className="space-y-1.5">
            <label htmlFor="intake-scam-type" className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
              Scam categorization
            </label>
            <select
              id="intake-scam-type"
              value={scamType}
              onChange={(e) => setScamType(e.target.value as ScamType)}
              className="w-full text-xs font-medium bg-[#F8F4E8] border border-[#09090B]/20 rounded-xl p-2.5 focus:outline-none focus:border-[#09090B]"
            >
              {SCAM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Intake Channel */}
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="intake-channel" className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
              Intake channel
            </label>
            <select
              id="intake-channel"
              value={channel}
              onChange={(e) => setChannel(e.target.value as IntakeChannel)}
              className="w-full text-xs font-medium bg-[#F8F4E8] border border-[#09090B]/20 rounded-xl p-2.5 focus:outline-none focus:border-[#09090B]"
            >
              {STAFF_CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Victim Information */}
        <div className="space-y-3 pt-3 border-t border-[#09090B]/15">
          <p className="text-xs font-bold uppercase tracking-wider text-[#52525B]">Victim identification</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Full Name *"
              value={victimName}
              onChange={(e) => setVictimName(e.target.value)}
              placeholder="e.g. Kenji Tanaka"
              required
            />
            <Input
              label="Contact Phone"
              value={victimPhone}
              onChange={(e) => setVictimPhone(e.target.value)}
              placeholder="+81 90-1234-5678"
            />
            <Input
              label="Contact Email"
              type="email"
              value={victimEmail}
              onChange={(e) => setVictimEmail(e.target.value)}
              placeholder="victim@domain.jp"
            />
          </div>
        </div>

        {/* Transaction & Beneficiary Details */}
        <div className="space-y-3 pt-3 border-t border-[#09090B]/15">
          <p className="text-xs font-bold uppercase tracking-wider text-[#52525B]">Fraud transaction details</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Amount Lost (JPY) *"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 2500000"
              required
            />
            <Input
              label="Mule Account No. *"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="e.g. 7891234"
              required
            />
            <Input
              label="Beneficiary Name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. Yamada Trading"
            />
          </div>
        </div>

        {/* Narrative Description */}
        <div className="space-y-1.5 pt-3 border-t border-[#09090B]/15">
          <label htmlFor="intake-description" className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
            Incident summary / police report reference
          </label>
          <textarea
            id="intake-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Details of fraudulent contact, wire voucher reference, or police case number..."
            className="w-full text-xs font-medium rounded-xl border border-[#09090B]/20 bg-[#F8F4E8] p-2.5 focus:outline-none focus:border-[#09090B] placeholder:text-[#71717A]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2.5 pt-3 border-t border-[#09090B]/15">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={isSubmitting} className="gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Register claim
          </Button>
        </div>
      </form>
    </Modal>
  );
}
