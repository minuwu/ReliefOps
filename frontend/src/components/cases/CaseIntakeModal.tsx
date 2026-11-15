import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DEMO_BANKS } from '@/services/mockData';
import { api } from '@/services/api';
import { CheckCircle2 } from 'lucide-react';

interface CaseIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaseCreated?: () => void;
}

export function CaseIntakeModal({ isOpen, onClose, onCaseCreated }: CaseIntakeModalProps) {
  const [bankId, setBankId] = useState(DEMO_BANKS[0].id);
  const [victimName, setVictimName] = useState('');
  const [victimPhone, setVictimPhone] = useState('');
  const [victimEmail, setVictimEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [scamType, setScamType] = useState('investment');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!victimName || !amount || !accountNumber) {
      setError('Please fill all mandatory fields (Victim Name, Amount, Beneficiary Account).');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.submitIntake({
        bank_id: bankId,
        victim_name: victimName,
        victim_phone: victimPhone,
        victim_email: victimEmail,
        preferred_language: 'ja',
        amount: parseFloat(amount) || 0,
        currency: 'JPY',
        account_number: accountNumber,
        account_holder_name: accountName,
        scam_type: scamType,
        description: description,
        transfer_date: new Date().toISOString(),
      });
      onCaseCreated?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to register statutory claim intake.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="NEW STATUTORY CLAIM INTAKE" maxWidth="2xl">
      <form onSubmit={handleSubmit} className="space-y-5 font-['Space_Grotesk',sans-serif]">
        {error && (
          <div className="p-3 rounded-xl border-2 border-[#FF334B] bg-[#FF334B]/10 text-[#FF334B] text-xs font-bold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Target Bank */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
              AFFECTED PARTNER BANK
            </label>
            <select
              value={bankId}
              onChange={(e) => setBankId(e.target.value)}
              className="w-full text-xs font-bold bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-3 shadow-hard-sm focus:outline-none"
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
            <label className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
              SCAM CATEGORIZATION
            </label>
            <select
              value={scamType}
              onChange={(e) => setScamType(e.target.value)}
              className="w-full text-xs font-bold bg-[#F8F4E8] border-2 border-[#09090B] rounded-xl p-3 shadow-hard-sm focus:outline-none"
            >
              <option value="investment">Investment / High-Yield Scam</option>
              <option value="impersonation">Police / Financial Authority Impersonation</option>
              <option value="romance">International Romance Solicitation</option>
              <option value="tech_support">Remote Desktop Extortion</option>
              <option value="loan_advance">Advance Fee / Loan Scam</option>
            </select>
          </div>
        </div>

        {/* Victim Information */}
        <div className="p-4 rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] shadow-hard-sm space-y-3">
          <p className="text-xs font-['Dela_Gothic_One'] uppercase text-[#09090B]">VICTIM IDENTIFICATION</p>
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
        <div className="p-4 rounded-xl border-2 border-[#09090B] bg-[#EDE8D5] shadow-hard-sm space-y-3">
          <p className="text-xs font-['Dela_Gothic_One'] uppercase text-[#09090B]">FRAUD TRANSACTION DETAILS</p>
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
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
            INCIDENT SUMMARY / POLICE REPORT REFERENCE
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Details of fraudulent contact, wire voucher reference, or police case number..."
            className="w-full text-xs font-bold rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] p-3 shadow-hard-sm focus:outline-none placeholder:text-[#71717A]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#09090B]">
          <Button variant="outline" size="md" type="button" onClick={onClose} className="shadow-hard-sm">
            CANCEL
          </Button>
          <Button variant="primary" size="md" type="submit" isLoading={isSubmitting} className="shadow-hard-sm gap-2">
            <CheckCircle2 className="w-4 h-4" /> REGISTER CLAIM
          </Button>
        </div>
      </form>
    </Modal>
  );
}
