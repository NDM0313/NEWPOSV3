/** Parity with web src/app/utils/authErrorMessages.ts */

export const RESERVED_SYSTEM_EMAILS = [
  'admin@dincouture.pk',
  'demo@dincollection.com',
] as const;

export const RESERVED_SYSTEM_EMAIL_MESSAGE =
  'This email is reserved for system login. Sign in on the login page, or use a different email to register a new business.';

const CREATE_BUSINESS_WRONG_PASSWORD_MESSAGE =
  'This email is already registered with a different password. Use the password from your first signup attempt, sign in on the login page, or choose a different email.';

export const CREATE_BUSINESS_SIGNUP_SERVER_ERROR_MESSAGE =
  'Signup failed on the server. This email may already be registered with a different password, or there is a database configuration issue. Try Sign In, use a different email, or contact your administrator.';

export function isAmbiguousSignupDatabaseError(
  authError: { message?: string } | null | undefined
): boolean {
  const msg = authError?.message?.toLowerCase() ?? '';
  return msg.includes('database error saving new user');
}

export function isExplicitDuplicateSignupError(
  authError: { message?: string; status?: number } | null | undefined
): boolean {
  if (!authError) return false;
  const msg = authError.message?.toLowerCase() ?? '';
  return (
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('user already exists') ||
    (authError.status === 422 &&
      (msg.includes('already') || msg.includes('exists') || msg.includes('registered')))
  );
}

export function shouldAttemptSignupSignInFallback(
  authError: { message?: string; status?: number } | null | undefined
): boolean {
  return isExplicitDuplicateSignupError(authError) || isAmbiguousSignupDatabaseError(authError);
}

export function isReservedSystemEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return (RESERVED_SYSTEM_EMAILS as readonly string[]).includes(normalized);
}

export function formatCreateBusinessSignInFallbackError(
  signInError: { message?: string },
  signUpError?: { message?: string }
): string {
  const message = signInError.message ?? 'Sign in failed';
  if (message.includes('Invalid login credentials')) {
    if (signUpError && isAmbiguousSignupDatabaseError(signUpError)) {
      return CREATE_BUSINESS_SIGNUP_SERVER_ERROR_MESSAGE;
    }
    return CREATE_BUSINESS_WRONG_PASSWORD_MESSAGE;
  }
  if (message.includes('Email not confirmed')) {
    return 'Please confirm your email address first.';
  }
  return message;
}
