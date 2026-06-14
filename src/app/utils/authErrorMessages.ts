/**
 * Shared auth error copy for login and Create Business flows.
 */

export const RESERVED_SYSTEM_EMAILS = [
  'admin@dincouture.pk',
  'demo@dincollection.com',
] as const;

export const RESERVED_SYSTEM_EMAIL_MESSAGE =
  'This email is reserved for system login. Sign in on the login page, or use a different email to register a new business.';

export const ALREADY_HAS_BUSINESS_MESSAGE =
  'You already have a business linked to this account. Sign in on the login page to open it.';

const CREATE_BUSINESS_WRONG_PASSWORD_MESSAGE =
  'This email is already registered with a different password. Use the password from your first signup attempt, sign in on the login page, or choose a different email.';

export const CREATE_BUSINESS_SIGNUP_SERVER_ERROR_MESSAGE =
  'Signup failed on the server. This email may already be registered with a different password, or there is a database configuration issue. Try Sign In, use a different email, or contact your administrator.';

/** GoTrue self-hosted may return this generic message for duplicate email OR a real Postgres failure. */
export function isAmbiguousSignupDatabaseError(
  authError: { message?: string } | null | undefined
): boolean {
  const msg = authError?.message?.toLowerCase() ?? '';
  return msg.includes('database error saving new user');
}

/** Explicit duplicate-email errors from GoTrue (safe to treat as "already registered"). */
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

/** Whether Create Business should try sign-in after signUp failure. */
export function shouldAttemptSignupSignInFallback(
  authError: { message?: string; status?: number } | null | undefined
): boolean {
  return isExplicitDuplicateSignupError(authError) || isAmbiguousSignupDatabaseError(authError);
}

export function formatCreateBusinessSignupFallbackError(
  signUpError: { message?: string },
  signInError: { message?: string }
): string {
  const signInMessage = signInError.message ?? 'Sign in failed';
  if (signInMessage.includes('Email not confirmed')) {
    return 'Please confirm your email address first.';
  }
  if (signInMessage.includes('Invalid login credentials')) {
    if (isAmbiguousSignupDatabaseError(signUpError)) {
      return CREATE_BUSINESS_SIGNUP_SERVER_ERROR_MESSAGE;
    }
    return CREATE_BUSINESS_WRONG_PASSWORD_MESSAGE;
  }
  return formatSignInError(signInError, { context: 'createBusinessFallback' });
}

function isStorageSecurityMessage(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const o = err as { name?: string; message?: string };
  const msg = String(o.message ?? '').toLowerCase();
  const name = String(o.name ?? '').toLowerCase();
  return (
    name === 'securityerror' ||
    msg.includes('securityerror') ||
    msg.includes('request was denied') ||
    msg.includes('access is denied')
  );
}

export function isStorageSecurityError(err: unknown): boolean {
  return isStorageSecurityMessage(err);
}

export function isReservedSystemEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return (RESERVED_SYSTEM_EMAILS as readonly string[]).includes(normalized);
}

export function formatSignInError(
  signInError: { message?: string; name?: string; status?: number },
  options?: {
    storageBlockedMessage?: string;
    context?: 'login' | 'createBusinessFallback';
    attemptedEmail?: string;
  }
): string {
  const message = signInError.message ?? 'Sign in failed';
  const context = options?.context ?? 'login';

  if (isStorageSecurityMessage(signInError) && options?.storageBlockedMessage) {
    return options.storageBlockedMessage;
  }
  if (message.includes('Invalid login credentials')) {
    if (context === 'createBusinessFallback') {
      return CREATE_BUSINESS_WRONG_PASSWORD_MESSAGE;
    }
    const email = options?.attemptedEmail?.trim().toLowerCase() ?? '';
    if (email && !isReservedSystemEmail(email)) {
      return 'Is email se account nahi mila ya password galat hai. Pehli dafa ho to Create New Business se account banao.';
    }
    return 'Invalid email or password. Please check your credentials.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Please confirm your email address first.';
  }
  if (message.includes('User not found')) {
    return 'User does not exist. Please create a business first.';
  }
  if (
    message.includes('Failed to fetch') ||
    (signInError.name && signInError.name.includes('AuthRetryableFetchError'))
  ) {
    return 'Network error: Cannot reach the server. On VPS run: git pull && bash deploy/deploy.sh (uses https://supabase.dincouture.pk).';
  }
  if (signInError.status === 401) {
    return 'Authentication configuration error. Contact administrator or retry after deploy.';
  }
  return message;
}

/** True when wizard should offer "Go to Sign In" instead of retrying signup. */
export function isCreateBusinessAccountError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('reserved for system login') ||
    m.includes('already registered with a different password') ||
    m.includes('signup failed on the server') ||
    m.includes('already have a business linked') ||
    m.includes('sign in on the login page') ||
    m.includes('confirm your email')
  );
}
