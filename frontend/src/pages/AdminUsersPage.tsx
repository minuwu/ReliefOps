import { useState, type FormEvent } from 'react';
import { MailPlus } from 'lucide-react';
import type { Bank, BankId, Invitation, StaffRole, User } from '@/types/api';
import { api } from '@/services/api';
import { errorMessage, fieldErrors } from '@/services/http';
import { useAsyncResource } from '@/lib/hooks/useAsyncResource';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { FormNotice } from '@/components/auth/AuthCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/utils';
import { Input } from '@/components/ui/Input';

const ROLE_LABEL: Record<StaffRole, string> = {
  operator: 'Operator',
  supervisor: 'Supervisor',
  bank_viewer: 'Bank viewer',
};
const ROLES = Object.keys(ROLE_LABEL) as StaffRole[];

const panelClass = 'rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] p-5 sm:p-6 shadow-hard space-y-4';
const selectClass =
  'h-10 w-full rounded-xl border border-[#09090B]/30 bg-[#F8F4E8] px-3 text-sm font-medium focus:border-[#09090B] focus:outline-none';
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
  const [showInactive, setShowInactive] = useState(false);

  const {
    data: users,
    loading: usersLoading,
    error: usersError,
    reload: reloadUsers,
  } = useAsyncResource(`admin:users:${showInactive}`, async () => {
    const res = await api.getUsers({ include_inactive: showInactive });
    return res.data;
  });

  const { data: banks = [] } = useAsyncResource('admin:banks', async () => {
    const res = await api.getBanks();
    return res.data;
  });

  const {
    data: invitations = [],
    loading: invitesLoading,
    error: invitesError,
    reload: reloadInvitations,
  } = useAsyncResource('admin:invitations', async () => {
    const res = await api.getInvitations();
    return res.data;
  });

  const loadError = usersError
    ? errorMessage(usersError, 'Could not load the team.')
    : invitesError
      ? errorMessage(invitesError, 'Could not load invitations.')
      : null;

  const bankName = (id: string | null) => (id ? banks.find((b) => b.id === id)?.name ?? id : 'Operations center');

  const revoke = async (invite: Invitation) => {
    try {
      await api.revokeInvitation(invite.id);
      reloadInvitations();
      pushToast(`Invitation for ${invite.email} revoked.`, 'success');
    } catch (err) {
      pushToast(errorMessage(err, 'Could not revoke the invitation.'), 'error');
    }
  };

  const setActive = async (user: User, isActive: boolean) => {
    try {
      await api.setUserActive(user.id, isActive);
      pushToast(`${user.name} ${isActive ? 'can log in again' : 'is deactivated and logged out'}.`, 'success');
      reloadUsers();
    } catch (err) {
      pushToast(errorMessage(err, 'Could not change the account.'), 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 font-['Space_Grotesk',sans-serif]">
      <header className="border-b-2 border-[#09090B] pb-6">
        <h1 className="text-2xl sm:text-3xl font-['Dela_Gothic_One'] text-[#09090B]">Team</h1>
        <p className="text-sm text-[#52525B] mt-1">Staff accounts and invitations.</p>
      </header>

      {loadError && (
        <div className="space-y-2">
          <FormNotice tone="error">{loadError}</FormNotice>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              reloadUsers();
              reloadInvitations();
            }}
          >
            Retry
          </Button>
        </div>
      )}

      <section className={panelClass} aria-labelledby="invite-heading">
        <h2 id="invite-heading" className="text-sm font-bold uppercase tracking-wide text-[#09090B]">
          Invite someone
        </h2>
        <p className="text-sm text-[#52525B]">
          Staff accounts are created only by invitation. Bank viewers see only their own bank's cases.
        </p>
        <InviteForm banks={banks} onInvited={() => reloadInvitations()} />
      </section>

      <section className={panelClass} aria-labelledby="invites-heading">
        <h2 id="invites-heading" className="text-sm font-bold uppercase tracking-wide text-[#09090B]">
          Invitations
        </h2>
        {invitesLoading && invitations.length === 0 ? (
          <p className="text-sm text-[#52525B]">Loading invitations…</p>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-[#52525B]">No invitations pending.</p>
        ) : (
          <ul className="divide-y divide-[#09090B]/10">
            {invitations.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="text-sm space-y-0.5">
                  <p className="font-bold text-[#09090B]">
                    {invite.name} · {invite.email}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#52525B]">
                    <span>{ROLE_LABEL[invite.role]}</span>
                    <span>·</span>
                    <span>{bankName(invite.bank_id)}</span>
                    <span>·</span>
                    <Badge variant={invite.status === 'pending' ? 'warning' : 'secondary'}>
                      {invite.status}
                    </Badge>
                    {invite.status === 'pending' && (
                      <span className="font-mono text-xs">
                        · expires {formatDate(invite.expires_at)}
                      </span>
                    )}
                  </div>
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
          <h2 id="team-heading" className="text-sm font-bold uppercase tracking-wide text-[#09090B]">
            Staff accounts
          </h2>
          <label className="flex items-center gap-2 text-xs font-bold uppercase text-[#52525B] cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 accent-[#09090B]"
            />
            Show deactivated
          </label>
        </div>
        {usersLoading && !users ? (
          <p className="text-sm text-[#52525B]">Loading staff accounts…</p>
        ) : !users || users.length === 0 ? (
          <p className="text-sm text-[#52525B]">No staff accounts found.</p>
        ) : (
          <ul className="divide-y divide-[#09090B]/10">
            {users.map((u) => (
              <li key={u.id} className={`flex flex-wrap items-center justify-between gap-3 py-3 ${u.is_active ? '' : 'opacity-60'}`}>
                <div className="text-sm space-y-0.5">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#09090B]">{u.name}</p>
                    <span className="text-xs text-[#52525B]">·</span>
                    <span className="text-xs text-[#52525B] font-mono">{u.email}</span>
                    {!u.is_active && (
                      <Badge variant="destructive">Deactivated</Badge>
                    )}
                  </div>
                  <p className="text-xs text-[#52525B]">
                    {ROLE_LABEL[u.role as StaffRole] ?? u.role} · {bankName(u.bank_id)}
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
