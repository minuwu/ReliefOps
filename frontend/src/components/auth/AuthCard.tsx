import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';

interface AuthCardProps {
  badge?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Shared frame for login, sign-up, and every email-link landing page. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="max-w-md mx-auto px-4 sm:px-0 py-8 sm:py-14">
      <div className="rounded-2xl border-2 border-[#09090B] bg-[#F8F4E8] shadow-hard p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[#09090B] text-[#D2E823] flex items-center justify-center border-2 border-[#09090B]">
            <ShieldAlert className="w-5 h-5" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-['Dela_Gothic_One'] text-[#09090B] leading-tight">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-[#52525B]">{subtitle}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="mt-5 text-center text-sm font-medium text-[#52525B] space-y-2">{footer}</div>}
    </div>
  );
}

/** Inline banner for form-level errors and notices. */
export function FormNotice({ tone, children }: { tone: 'error' | 'success' | 'info'; children: ReactNode }) {
  const toneClass =
    tone === 'error' ? 'bg-[#FF334B]' : tone === 'success' ? 'bg-[#D2E823]' : 'bg-[#EDE8D5]';
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border-2 border-[#09090B] px-3.5 py-2.5 text-xs font-bold text-[#09090B] ${toneClass}`}
    >
      {children}
    </div>
  );
}
