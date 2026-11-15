import { Input } from '@/components/ui/Input';

export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 128;

interface NewPasswordFieldsProps {
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  /** Server-side message for the password field, if any. */
  serverError?: string;
}

/** Returns a message when the pair is not acceptable, or null when it is. */
export function checkNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return `Use ${MIN_PASSWORD} to ${MAX_PASSWORD} characters.`;
  }
  if (password !== confirm) return 'The two passwords do not match.';
  return null;
}

export function NewPasswordFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  serverError,
}: NewPasswordFieldsProps) {
  return (
    <>
      <Input
        label="New password"
        id="new-password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD}
        maxLength={MAX_PASSWORD}
        helperText={`${MIN_PASSWORD} to ${MAX_PASSWORD} characters. A short sentence is easy to remember.`}
        error={serverError}
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
      />
      <Input
        label="Repeat the password"
        id="confirm-password"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => onConfirmChange(e.target.value)}
      />
    </>
  );
}
