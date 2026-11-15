/**
 * Pages that email links land on, plus the form that sends the reset email.
 * Each reads the one-time ?token= and removes it from the address bar.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/services/authApi';
import { victimApi } from '@/services/victimApi';
import { USE_MOCK, errorMessage, fieldErrors } from '@/services/http';
import { useToastStore } from '@/store/useToastStore';
import { AuthCard, FormNotice } from '@/components/auth/AuthCard';
import { NewPasswordFields, checkNewPassword } from '@/components/auth/NewPasswordFields';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PATHS } from '@/routes/paths';
import { useUrlToken } from '@/routes/useUrlToken';

type Outcome = { tone: 'success' | 'error'; message: string } | null;

const linkClass = 'block text-center text-sm font-bold underline underline-offset-4';

function MissingToken({ title, retry }: { title: string; retry: ReactNode }) {
  return (
    <AuthCard title={title}>
      <FormNotice tone="error">This link is incomplete. Open it again from the email.</FormNotice>
      {retry}
    </AuthCard>
  );
}

/** Calls fn once per mount, even under StrictMode's double effects (tokens are single-use). */
function useOnMount(fn: () => void): void {
  const hasRun = useRef(false);
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    fn();
    // fn is intentionally read once; the token it uses never changes after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* --- /verify-email ------------------------------------------------------- */

export function VerifyEmailPage() {
  const token = useUrlToken();
  const [outcome, setOutcome] = useState<Outcome>(null);

  useOnMount(() => {
    if (!token) return;
    authApi
      .verifyEmail(token)
      .then((res) => setOutcome({ tone: 'success', message: res.message || 'Email verified.' }))
      .catch((err) =>
        setOutcome({ tone: 'error', message: errorMessage(err, 'This link has expired or was already used.') })
      );
  });

  if (!token) {
    return (
      <MissingToken
        title="Verify your email"
        retry={<Link to={PATHS.login} className={linkClass}>Log in to get a new link</Link>}
      />
    );
  }

  return (
    <AuthCard title="Verify your email">
      {!outcome && <FormNotice tone="info">Checking your link…</FormNotice>}
      {outcome && <FormNotice tone={outcome.tone}>{outcome.message}</FormNotice>}
      {outcome?.tone === 'error' && (
        <p className="text-sm font-medium text-[#52525B]">
          Log in with your email and password. If your address is not verified yet, you can ask for a new link there.
        </p>
      )}
      {outcome && <Link to={PATHS.login} className={linkClass}>Go to log in</Link>}
    </AuthCard>
  );
}

/* --- /forgot-password ---------------------------------------------------- */

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setOutcome({ tone: 'error', message: 'Enter the email address you log in with.' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      const demoHint = USE_MOCK ? ' In this demo, look in the Demo inbox at the bottom left.' : '';
      setOutcome({ tone: 'success', message: `${res.message}${demoHint}` });
    } catch (err) {
      setOutcome({ tone: 'error', message: errorMessage(err, 'Could not send the email. Try again later.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email to receive a password reset link."
      footer={<Link to={PATHS.login} className="font-bold text-[#09090B] underline underline-offset-4">Back to log in</Link>}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Email"
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {outcome && <FormNotice tone={outcome.tone}>{outcome.message}</FormNotice>}
        <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} className="w-full">
          SEND RESET LINK
        </Button>
      </form>
    </AuthCard>
  );
}

/* --- Shared: set a password from an emailed token ------------------------ */

interface SetPasswordPageProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  retry: ReactNode;
  submit: (token: string, password: string) => Promise<{ message: string }>;
  /** Field name the backend uses for the password in 422 errors. */
  passwordField: string;
}

function SetPasswordPage({ title, subtitle, submitLabel, retry, submit, passwordField }: SetPasswordPageProps) {
  const token = useUrlToken();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [serverError, setServerError] = useState<string | undefined>();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!token) return <MissingToken title={title} retry={retry} />;

  if (outcome?.tone === 'success') {
    return (
      <AuthCard title={title}>
        <FormNotice tone="success">{outcome.message}</FormNotice>
        <Link to={PATHS.login} className={linkClass}>Go to log in</Link>
      </AuthCard>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(undefined);
    const problem = checkNewPassword(password, confirm);
    if (problem) {
      setOutcome({ tone: 'error', message: problem });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await submit(token, password);
      setOutcome({ tone: 'success', message: res.message });
    } catch (err) {
      setServerError(fieldErrors(err)[passwordField]);
      setOutcome({ tone: 'error', message: errorMessage(err, 'This link has expired or was already used.') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthCard title={title} subtitle={subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <NewPasswordFields
          password={password}
          confirm={confirm}
          onPasswordChange={setPassword}
          onConfirmChange={setConfirm}
          serverError={serverError}
        />
        {outcome && <FormNotice tone={outcome.tone}>{outcome.message}</FormNotice>}
        <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} className="w-full">
          {submitLabel}
        </Button>
      </form>
      {outcome?.tone === 'error' && retry}
    </AuthCard>
  );
}

/* --- /reset-password ----------------------------------------------------- */

export function ResetPasswordPage() {
  return (
    <SetPasswordPage
      title="Choose a new password"
      subtitle="After this, every device that was logged in must log in again."
      submitLabel="SAVE NEW PASSWORD"
      passwordField="new_password"
      submit={authApi.resetPassword}
      retry={<Link to={PATHS.forgotPassword} className={linkClass}>Ask for a new reset link</Link>}
    />
  );
}

/* --- /accept-invitation -------------------------------------------------- */

export function AcceptInvitationPage() {
  return (
    <SetPasswordPage
      title="Set up your staff account"
      subtitle="A supervisor invited you. Choose a password to finish creating your account."
      submitLabel="CREATE MY ACCOUNT"
      passwordField="password"
      submit={authApi.acceptInvitation}
      retry={
        <p className="text-center text-sm font-medium text-[#52525B]">
          Invitations expire. Ask your supervisor to send a new one.
        </p>
      }
    />
  );
}

/* --- /claim-case (victims only; the route guard handles login) ----------- */

export function ClaimCasePage() {
  const token = useUrlToken();
  const navigate = useNavigate();
  const pushToast = useToastStore((s) => s.push);
  const [error, setError] = useState<string | null>(null);

  useOnMount(() => {
    if (!token) return;
    victimApi
      .claimCase(token)
      .then((res) => {
        pushToast(`Case ${res.data.reference} is now linked to your account.`, 'success');
        navigate(PATHS.portalCase(res.data.id), { replace: true });
      })
      .catch((err) => setError(errorMessage(err, 'This link has expired or was already used.')));
  });

  const toPortal = <Link to={PATHS.portal} className={linkClass}>Go to my cases</Link>;
  if (!token) return <MissingToken title="Track your case online" retry={toPortal} />;

  return (
    <AuthCard title="Track your case online">
      {error ? (
        <>
          <FormNotice tone="error">{error}</FormNotice>
          <p className="text-sm font-medium text-[#52525B]">
            The link only works for the email address the center has on file. Call the operations center if you need a new one.
          </p>
          {toPortal}
        </>
      ) : (
        <FormNotice tone="info">Linking the case to your account…</FormNotice>
      )}
    </AuthCard>
  );
}
