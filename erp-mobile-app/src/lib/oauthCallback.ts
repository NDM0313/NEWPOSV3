import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';
import { NATIVE_OAUTH_REDIRECT } from './oauthRedirect';

export const OAUTH_COMPLETE_EVENT = 'erp-auth-oauth-complete';

export type OauthCompleteDetail = { success: boolean; message?: string };

let listenerRegistered = false;
const processedOAuthReturnUrls = new Set<string>();

function extractAuthCode(url: string): string | null {
  const qIndex = url.indexOf('?');
  const hIndex = url.indexOf('#');
  let query = '';
  if (qIndex >= 0) {
    query = hIndex > qIndex ? url.slice(qIndex + 1, hIndex) : url.slice(qIndex + 1);
  } else if (hIndex >= 0) {
    query = url.slice(hIndex + 1);
  }
  if (!query) return null;
  const code = new URLSearchParams(query).get('code');
  return code && code.length > 0 ? code : null;
}

function isNativeOAuthCallbackUrl(url: string): boolean {
  return url.startsWith(NATIVE_OAUTH_REDIRECT.split('?')[0]) || url.startsWith('com.dincouture.erp://oauth/');
}

async function handleOAuthReturnUrl(url: string): Promise<void> {
  if (!isNativeOAuthCallbackUrl(url)) return;
  if (processedOAuthReturnUrls.has(url)) return;

  try {
    await Browser.close();
  } catch {
    /* ignore */
  }

  const code = extractAuthCode(url);
  if (!code) {
    window.dispatchEvent(
      new CustomEvent<OauthCompleteDetail>(OAUTH_COMPLETE_EVENT, {
        detail: { success: false, message: 'Missing authorization code from Google.' },
      })
    );
    return;
  }

  processedOAuthReturnUrls.add(url);

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    processedOAuthReturnUrls.delete(url);
    window.dispatchEvent(
      new CustomEvent<OauthCompleteDetail>(OAUTH_COMPLETE_EVENT, {
        detail: { success: false, message: error.message },
      })
    );
    return;
  }

  window.dispatchEvent(
    new CustomEvent<OauthCompleteDetail>(OAUTH_COMPLETE_EVENT, {
      detail: { success: true },
    })
  );
}

/** Register once: deep link after Google OAuth in Capacitor Browser. */
export function initOAuthDeepLinkHandler(): void {
  if (!Capacitor.isNativePlatform() || listenerRegistered) return;
  listenerRegistered = true;

  void App.addListener('appUrlOpen', (event) => {
    if (event.url) void handleOAuthReturnUrl(event.url);
  });

  void App.getLaunchUrl().then((res) => {
    if (res?.url) void handleOAuthReturnUrl(res.url);
  });
}
