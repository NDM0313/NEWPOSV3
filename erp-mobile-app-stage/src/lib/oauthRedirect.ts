import { Capacitor } from '@capacitor/core';

/** Must match `appId` in capacitor.config.ts and Supabase Auth redirect allow list. */
export const NATIVE_OAUTH_REDIRECT = 'com.dincouture.erp://oauth/callback';

/**
 * OAuth / magic-link return URL (must be listed in Supabase Auth redirect URLs).
 * Native uses custom scheme so the OS can return control to the app after Google.
 */
export function getOAuthRedirectTo(): string {
  if (typeof window === 'undefined') return '';
  if (Capacitor.isNativePlatform()) {
    return NATIVE_OAUTH_REDIRECT;
  }
  const { origin, pathname } = window.location;
  if (pathname && pathname !== '/') {
    return `${origin}${pathname.replace(/\/+$/, '')}`;
  }
  return `${origin}/`;
}
