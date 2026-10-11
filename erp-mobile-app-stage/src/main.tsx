import { useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import App from './App';
import './index.css';
import { BootErrorBoundary } from './components/BootErrorBoundary';
import { registerAllSyncHandlers } from './lib/registerSyncHandlers';
import { initOAuthDeepLinkHandler } from './lib/oauthCallback';
import { PermissionProvider } from './context/PermissionContext';
import { CounterWorkerProvider } from './context/CounterWorkerContext';
import { SettingsProvider } from './context/SettingsContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { ensureMobileDebugLogCapture } from './lib/mobileDebugLog';

ensureMobileDebugLogCapture();

declare global {
  interface Window {
    __ERP_BOOT_OK__?: boolean;
    __ERP_CLEAR_BOOT_WATCH?: () => void;
    __ERP_SHOW_BOOT_FALLBACK?: (msg?: string) => void;
  }
}

window.__ERP_BOOT_OK__ = true;
window.__ERP_CLEAR_BOOT_WATCH?.();

try {
  registerAllSyncHandlers();
} catch (e) {
  console.error('[ERP Mobile] registerAllSyncHandlers failed:', e);
}

if (Capacitor.isNativePlatform()) {
  try {
    initOAuthDeepLinkHandler();
  } catch (e) {
    console.error('[ERP Mobile] initOAuthDeepLinkHandler failed:', e);
  }
}

// Service workers break Capacitor WebView asset loading (blank #111827 screen). PWA only.
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker.register(base + 'sw.js?v=5').catch(() => {});
  });
}

/** Hide native splash only after first paint (avoids flash before React mounts). */
function SplashGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const hide = () => {
      void SplashScreen.hide({ fadeOutDuration: 220 }).catch(() => {});
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(hide);
    });
  }, []);
  return <>{children}</>;
}

function renderBootFallback(message: string): void {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;background:#111827;color:#F9FAFB;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;font-family:system-ui,sans-serif;text-align:center">
      <p style="margin:0 0 16px;font-size:14px;color:#9CA3AF">${message}</p>
      <button type="button" onclick="location.reload()" style="padding:12px 24px;border-radius:12px;border:none;background:#3B82F6;color:white;font-weight:500;cursor:pointer">Reload app</button>
    </div>
  `;
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('[ERP Mobile] #root element missing');
} else {
  try {
    createRoot(rootEl).render(
      <BootErrorBoundary>
        <SplashGate>
          <LoadingProvider>
            <PermissionProvider>
              <CounterWorkerProvider>
                <SettingsProvider>
                  <App />
                </SettingsProvider>
              </CounterWorkerProvider>
            </PermissionProvider>
          </LoadingProvider>
        </SplashGate>
      </BootErrorBoundary>
    );
  } catch (e) {
    console.error('[ERP Mobile] createRoot failed:', e);
    renderBootFallback('The app could not start. Tap reload to try again.');
  }
}
