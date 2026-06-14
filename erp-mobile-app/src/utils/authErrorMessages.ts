/** Parity with web src/app/utils/authErrorMessages.ts */

export const RESERVED_SYSTEM_EMAILS = [
  'admin@dincouture.pk',
  'demo@dincollection.com',
] as const;

export const RESERVED_SYSTEM_EMAIL_MESSAGE =
  'This email is reserved for system login. Sign in on the login page, or use a different email to register a new business.';

const CREATE_BUSINESS_WRONG_PASSWORD_MESSAGE =
  'This email is already registered with a different password. Use the password from your first signup attempt, sign in on the login page, or choose a different email.';

export function isReservedSystemEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return (RESERVED_SYSTEM_EMAILS as readonly string[]).includes(normalized);
}

export function formatCreateBusinessSignInFallbackError(signInError: { message?: string }): string {
  const message = signInError.message ?? 'Sign in failed';
  if (message.includes('Invalid login credentials')) {
    return CREATE_BUSINESS_WRONG_PASSWORD_MESSAGE;
  }
  if (message.includes('Email not confirmed')) {
    return 'Please confirm your email address first.';
  }
  return message;
}
