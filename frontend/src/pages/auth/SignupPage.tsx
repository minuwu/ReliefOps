import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import type { Language } from '@/types/api';
import { authApi } from '@/services/authApi';
import { USE_MOCK, errorMessage, fieldErrors } from '@/services/http';
import { useAuthStore } from '@/store/useAuthStore';
import { AuthCard, FormNotice } from '@/components/auth/AuthCard';
import { MAX_PASSWORD, MIN_PASSWORD } from '@/components/auth/NewPasswordFields';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LANGUAGE_LABEL } from '@/lib/caseStages';
import { PATHS, homeFor } from '@/routes/paths';

const LANGUAGES = Object.keys(LANGUAGE_LABEL) as Language[];

/** Victim self sign-up. Staff accounts come only from a supervisor invitation. */
export function SignupPage() {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<Language>('ja');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = 'Enter your name.';
    if (!email.includes('@')) local.email = 'Enter a valid email address.';
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      local.password = `Use ${MIN_PASSWORD} to ${MAX_PASSWORD} characters.`;
    }
    setErrors(local);
    if (Object.keys(local).length) return;

    setIsSubmitting(true);
    try {
      const res = await authApi.signup({
        name: name.trim(),
        email: email.trim(),
        password,
        preferred_language: language,
      });
      setSentMessage(res.message || 'Check your inbox for a link to confirm your email.');
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorMessage(err, 'Could not create the account. Try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sentMessage) {
    return (
      <AuthCard badge="CHECK YOUR EMAIL" title="One more step" subtitle={sentMessage}>
        <FormNotice tone="success">
          Open the link in the email to confirm your address, then log in.
          {USE_MOCK && ' In this demo, the email is in the Demo inbox at the bottom left.'}
        </FormNotice>
        <Link to={PATHS.login} className="block text-center text-sm font-bold underline underline-offset-4">
          Go to log in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      badge="VICTIM ACCOUNT"
      title="Report a scam and track it"
      subtitle="Create an account to report a bank-transfer scam, follow your case, and ask questions."
      footer={
        <p>
          Already have an account?{' '}
          <Link to={PATHS.login} className="font-bold text-[#09090B] underline underline-offset-4">
            Log in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Full name"
          id="signup-name"
          autoComplete="name"
          required
          error={errors.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          label="Email"
          id="signup-email"
          type="email"
          autoComplete="email"
          required
          error={errors.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          id="signup-password"
          type="password"
          autoComplete="new-password"
          required
          helperText={`${MIN_PASSWORD} to ${MAX_PASSWORD} characters.`}
          error={errors.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="space-y-1.5">
          <label htmlFor="signup-language" className="block text-xs font-bold uppercase tracking-wider text-[#09090B]">
            Preferred language
          </label>
          <select
            id="signup-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="h-11 w-full rounded-xl border-2 border-[#09090B] bg-[#F8F4E8] px-3 text-sm font-medium shadow-[2px_2px_0px_0px_#09090B]"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABEL[lang]}
              </option>
            ))}
          </select>
        </div>

        {formError && <FormNotice tone="error">{formError}</FormNotice>}

        <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} className="w-full gap-2">
          <UserPlus className="w-4 h-4" /> CREATE ACCOUNT
        </Button>
      </form>
    </AuthCard>
  );
}
