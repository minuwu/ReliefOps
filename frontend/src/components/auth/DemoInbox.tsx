import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, RefreshCw, X } from 'lucide-react';
import { outbox, type MailKind, type MockMail } from '@/services/mockStore';
import { PATHS } from '@/routes/paths';

const MAIL_INFO: Record<MailKind, { subject: string; path: string; cta: string }> = {
  'verify-email': { subject: 'Confirm your email', path: PATHS.verifyEmail, cta: 'Verify email' },
  'reset-password': { subject: 'Reset your password', path: PATHS.resetPassword, cta: 'Choose a new password' },
  'accept-invitation': { subject: 'You are invited to ReliefOps', path: PATHS.acceptInvitation, cta: 'Accept invitation' },
  'claim-case': { subject: 'Track your case online', path: PATHS.claimCase, cta: 'Link case to my account' },
};

function linkFor(mail: MockMail): string {
  return `${MAIL_INFO[mail.kind].path}?token=${encodeURIComponent(mail.token)}`;
}

/**
 * Demo mode only. The real backend sends these as emails; here they land in an
 * in-browser inbox so the whole sign-up and invitation flow can be shown offline.
 */
export function DemoInbox() {
  const [isOpen, setIsOpen] = useState(false);
  const [mails, setMails] = useState<MockMail[]>([]);

  const refresh = () => setMails(outbox.mails);
  const open = () => {
    refresh();
    setIsOpen(true);
  };
  const unread = outbox.mails.filter((m) => !m.used).length;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={open}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-3 py-2 text-xs font-bold uppercase shadow-hard-sm hover:bg-[#D2E823] cursor-pointer"
        aria-label="Open the demo email inbox"
      >
        <Mail className="w-4 h-4" aria-hidden="true" /> Demo inbox
        {unread > 0 && (
          <span className="rounded-full bg-[#FF334B] border-2 border-[#09090B] px-1.5 text-[10px]">{unread}</span>
        )}
      </button>
    );
  }

  return (
    <aside
      aria-label="Demo email inbox"
      className="fixed bottom-4 left-4 z-40 w-[calc(100vw-2rem)] max-w-sm max-h-[70vh] overflow-y-auto rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard-lg"
    >
      <header className="sticky top-0 flex items-center justify-between gap-2 border-b-2 border-[#09090B] bg-[#09090B] px-4 py-2.5 text-[#D2E823]">
        <span className="text-xs font-bold uppercase tracking-wider">Demo inbox · emails the backend would send</span>
        <span className="flex gap-1">
          <button type="button" onClick={refresh} aria-label="Refresh inbox" className="p-1 hover:text-[#F8F4E8] cursor-pointer">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setIsOpen(false)} aria-label="Close inbox" className="p-1 hover:text-[#F8F4E8] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </span>
      </header>

      {mails.length === 0 ? (
        <p className="p-4 text-sm font-medium text-[#52525B]">
          No emails yet. Sign up, ask for a password reset, or invite someone to see them here.
        </p>
      ) : (
        <ul className="divide-y-2 divide-[#09090B]">
          {mails.map((mail) => (
            <li key={mail.token} className={`p-4 space-y-1.5 ${mail.used ? 'opacity-50' : ''}`}>
              <p className="text-[10px] font-mono text-[#52525B]">
                To {mail.to} · {new Date(mail.sent_at).toLocaleTimeString()}
              </p>
              <p className="text-sm font-bold text-[#09090B]">{MAIL_INFO[mail.kind].subject}</p>
              {mail.used ? (
                <p className="text-xs font-bold uppercase text-[#52525B]">Link already used</p>
              ) : (
                <Link
                  to={linkFor(mail)}
                  onClick={() => setIsOpen(false)}
                  className="inline-block rounded-lg border-2 border-[#09090B] bg-[#D2E823] px-2.5 py-1 text-xs font-bold uppercase hover:bg-[#e4fc28]"
                >
                  {MAIL_INFO[mail.kind].cta}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
