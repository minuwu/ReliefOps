import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { MailPlus } from 'lucide-react';
import type { Bank, BankId, Invitation, StaffRole, User } from '@/types/api';
import { api } from '@/services/api';
import { errorMessage, fieldErrors } from '@/services/http';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { FormNotice } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const ROLE_LABEL: Record<StaffRole, string> = {
  operator: 'Operator',
  supervisor: 'Supervisor',
  bank_viewer: 'Bank viewer',
};
const ROLES = Object.keys(ROLE_LABEL) as StaffRole[];

const panelClass = 'rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-5 sm:p-6 shadow-hard space-y-4';
const selectClass =
  'h-11 w-full rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-3 text-sm font-medium shadow-[2px_2px_0px_0px_#09090B]';
const labelClass = 'block text-xs font-bold uppercase tracking-wider text-[#09090B]';

/* --- Invite form --------------------------------------------------------- */

function InviteForm({ banks, onInvited }: { banks: Bank[]; onInvited: (invite: Invitation) => void }) {
  const pushToast = useToastStore((s) => s.push);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('operator');
  const [bankId, setBankId] = useState<BankId | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const needsBank = role === 'bank_viewer';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = 'Enter their name.';
    if (!email.includes('@')) local.email = 'Enter a valid email address.';
    if (needsBank && !bankId) local.bank_id = 'Choose the bank this viewer belongs to.';
    setErrors(local);
    if (Object.keys(local).length) return;

    setIsSending(true);
    try {
      const res = await api.createInvitation({
        name: name.trim(),
        email: email.trim(),
        role,
        // The contract wants bank_id only for bank viewers, null for center staff.
        bank_id: needsBank ? (bankId as BankId) : null,
      });
      pushToast(`Invitation sent to ${res.data.email}. The link works for 72 hours.`, 'success');
      onInvited(res.data);
      setName('');
      setEmail('');
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err, 'Could not send the invitation.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" noValidate aria-label="Invite a staff member">
      <Input label="Name" id="invite-name" error={errors.name} value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        label="Email"
        id="invite-email"
        type="email"
        error={errors.email}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="space-y-1.5">
        <label htmlFor="invite-role" className={labelClass}>
          Role
        </label>
        <select id="invite-role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
      {needsBank && (
        <div className="space-y-1.5">
          <label htmlFor="invite-bank" className={labelClass}>
            Bank
          </label>
          <select
            id="invite-bank"
            className={selectClass}
            value={bankId}
            aria-invalid={errors.bank_id ? true : undefined}
            onChange={(e) => setBankId(e.target.value as BankId)}
          >
            <option value="">Choose…</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {errors.bank_id && <p role="alert" className="text-xs font-bold text-[#FF334B]">{errors.bank_id}</p>}
        </div>
      )}
      <div className="sm:col-span-2 space-y-3">
        {formError && <FormNotice tone="error">{formError}</FormNotice>}
        <Button type="submit" variant="primary" isLoading={isSending} className="gap-2">
          <MailPlus className="w-4 h-4" /> SEND INVITATION
        </Button>
      </div>
    </form>
  );
}

/* --- Two-step button (no browser confirm dialogs) ------------------------ */

function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => Promise<void> }) {
  const [isArmed, setIsArmed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  if (!isArmed) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setIsArmed(true)}>
        {label}
      </Button>
    );
  }
  return (
    <span className="inline-flex gap-1.5">
      <Button
        type="button"
        variant="destructive"
        size="sm"
        isLoading={isBusy}
        onClick={async () => {
          setIsBusy(true);
          try {
            await onConfirm();
          } finally {
            setIsBusy(false);
            setIsArmed(false);
          }
        }}
      >
        {confirmLabel}
      </Button>
      <Button type="button" variant="ghost" size="sm" disabled={isBusy} onClick={() => setIsArmed(false)}>
        CANCEL
      </Button>
    </span>
  );
}

/* --- Page ---------------------------------------------------------------- */

export function AdminUsersPage() {
  const me = useAuthStore((s) => s.user);
  const pushToast = useToastStore((s) => s.push);
  const [users, setUsers] = useState<User[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadUsers = useCallback(() => {
    api
      .getUsers({ include_inactive: showInactive })
      .then((res) => setUsers(res.data))
      .catch((err) => setLoadError(errorMessage(err, 'Could not load the team.')));
  }, [showInactive]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    api.getBanks().then((res) => setBanks(res.data)).catch(() => setBanks([]));
    api
      .getInvitations()
      .then((res) => setInvitations(res.data))
      .catch((err) => setLoadError(errorMessage(err, 'Could not load invitations.')));
  }, []);

  const bankName = (id: string | null) => (id ? banks.find((b) => b.id === id)?.name ?? id : 'Operations center');

  const revoke = async (invite: Invitation) => {
    try {
      const res = await api.revokeInvitation(invite.id);
      setInvitations((list) => list.map((i) => (i.id === invite.id ? res.data : i)));
      pushToast(`Invitation for ${invite.email} revoked.`, 'success');
    } catch (err) {
      pushToast(errorMessage(err, 'Could not revoke the invitation.'), 'error');
    }
  };

  const setActive = async (user: User, isActive: boolean) => {
    try {
      await api.setUserActive(user.id, isActive);
      pushToast(`${user.name} ${isActive ? 'can log in again' : 'is deactivated and logged out'}.`, 'success');
      loadUsers();
    } catch (err) {
      pushToast(errorMessage(err, 'Could not change the account.'), 'error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-8 sm:py-12 space-y-6">
      <header className="border-b-2 border-[#09090B] pb-4">
        <p className="text-xs font-mono font-bold uppercase text-[#52525B]">Supervisor</p>
        <h1 className="text-2xl sm:text-4xl font-['Dela_Gothic_One'] uppercase text-[#09090B]">Team & access</h1>
      </header>

      {loadError && <FormNotice tone="error">{loadError}</FormNotice>}

      <section className={panelClass} aria-labelledby="invite-heading">
        <h2 id="invite-heading" className="text-base font-bold uppercase">
          Invite someone
        </h2>
        <p className="text-sm text-[#52525B]">
          Staff accounts are created only by invitation. Bank viewers see only their own bank's cases.
        </p>
        <InviteForm banks={banks} onInvited={(invite) => setInvitations((list) => [invite, ...list])} />
      </section>

      <section className={panelClass} aria-labelledby="invites-heading">
        <h2 id="invites-heading" className="text-base font-bold uppercase">
          Invitations
        </h2>
        {invitations.length === 0 ? (
          <p className="text-sm text-[#52525B]">No invitations yet.</p>
        ) : (
          <ul className="divide-y-2 divide-[#09090B]">
            {invitations.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-bold">
                    {invite.name} · {invite.email}
                  </p>
                  <p className="text-xs text-[#52525B]">
                    {ROLE_LABEL[invite.role]} · {bankName(invite.bank_id)} · {invite.status}
                    {invite.status === 'pending' && ` · expires ${new Date(invite.expires_at).toLocaleString()}`}
                  </p>
                </div>
                {invite.status === 'pending' && (
                  <ConfirmButton label="REVOKE" confirmLabel="YES, REVOKE" onConfirm={() => revoke(invite)} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panelClass} aria-labelledby="team-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="team-heading" className="text-base font-bold uppercase">
            Staff accounts
          </h2>
          <label className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 accent-[#09090B]"
            />
            Show deactivated
          </label>
        </div>
        {!users ? (
          <p className="text-sm text-[#52525B]">Loading…</p>
        ) : (
          <ul className="divide-y-2 divide-[#09090B]">
            {users.map((u) => (
              <li key={u.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${u.is_active ? '' : 'opacity-60'}`}>
                <div className="text-sm">
                  <p className="font-bold">
                    {u.name} · {u.email}
                  </p>
                  <p className="text-xs text-[#52525B]">
                    {ROLE_LABEL[u.role as StaffRole] ?? u.role} · {bankName(u.bank_id)}
                    {u.is_active ? '' : ' · deactivated'}
                  </p>
                </div>
                {u.id === me?.id ? (
                  <span className="text-xs font-bold uppercase text-[#52525B]">You</span>
                ) : u.is_active ? (
                  <ConfirmButton label="DEACTIVATE" confirmLabel="YES, DEACTIVATE" onConfirm={() => setActive(u, false)} />
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => setActive(u, true)}>
                    REACTIVATE
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
