import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';
import { authApi } from '@/services/authApi';
import { USE_MOCK, errorMessage } from '@/services/http';
import { DEMO_PASSWORD, DEMO_USERS, DEMO_VICTIMS } from '@/services/mockData';
import { AuthCard, FormNotice } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PATHS, homeFor, safeNext } from '@/routes/paths';

const DEMO_LOGINS = [...DEMO_USERS, ...DEMO_VICTIMS];

export function LoginPage() {
  const { user, login, isLoading, error, errorCode } = useAuthStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  const next = safeNext(params.get('next'));
  if (user) return <Navigate to={next ?? homeFor(user.role)} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    try {
      const signedIn = await login(email.trim(), password);
      navigate(next ?? homeFor(signedIn.role), { replace: true });
    } catch (err) {
      const message = errorMessage(err, 'Login failed. Please check your credentials.');
      useToastStore.getState().push(message, 'error');
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const res = await authApi.resendVerification(email.trim());
      setNotice(res.message || 'If that account exists, we sent a new verification email.');
    } catch (err) {
      setNotice(errorMessage(err, 'Could not send the email. Try again later.'));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthCard
      title="Log in to ReliefOps"
      subtitle="Sign in to access your claims or bank operations workspace."
      footer={
        <>
          <p>
            New victim?{' '}
            <Link to={PATHS.signup} className="font-bold text-[#09090B] underline underline-offset-4">
              Create an account
            </Link>
          </p>
          <p>
            <Link to={PATHS.forgotPassword} className="font-bold text-[#09090B] underline underline-offset-4">
              Forgot your password?
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Email"
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <FormNotice tone="error">{error}</FormNotice>}
        {errorCode === 'EMAIL_NOT_VERIFIED' && (
          <Button type="button" variant="outline" size="sm" isLoading={isResending} onClick={handleResend}>
            SEND THE VERIFICATION EMAIL AGAIN
          </Button>
        )}
        {notice && <FormNotice tone="info">{notice}</FormNotice>}

        <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="w-full gap-2">
          <LogIn className="w-4 h-4" aria-hidden="true" /> LOG IN
        </Button>
      </form>

      {USE_MOCK && (
        <div className="border-t border-[#09090B]/15 pt-4 space-y-2">
          <p className="text-xs font-mono font-medium uppercase tracking-wider text-[#52525B]">
            Demo accounts · Password {DEMO_PASSWORD}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_LOGINS.map((demo) => (
              <button
                key={demo.id}
                type="button"
                onClick={() => {
                  setEmail(demo.email);
                  setPassword(DEMO_PASSWORD);
                }}
                className="p-2 rounded-lg text-left text-xs font-bold border border-[#09090B]/20 bg-[#F8F4E8] hover:bg-[#D2E823] cursor-pointer"
              >
                <span className="block truncate uppercase">{demo.name}</span>
                <span className="block text-xs font-mono text-[#52525B] truncate">
                  {demo.role}
                  {demo.email_verified ? '' : ' · unverified'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthCard>
  );
}
