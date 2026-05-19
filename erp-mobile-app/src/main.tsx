import { useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import App from './App';
import './index.css';
import { registerAllSyncHandlers } from './lib/registerSyncHandlers';
import { initOAuthDeepLinkHandler } from './lib/oauthCallback';
import { PermissionProvider } from './context/PermissionContext';
import { SettingsProvider } from './context/SettingsContext';
import { LoadingProvider } from './contexts/LoadingContext';

try {
  registerAllSyncHandlers();
} catch (e) {
  console.error('[ERP Mobile] registerAllSyncHandlers failed:', e);
}

if (Capacitor.isNativePlatform()) {
  initOAuthDeepLinkHandler();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL || '/';
    navigator.serviceWorker.register(base + 'sw.js').catch(() => {});
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

createRoot(document.getElementById('root')!).render(
  <SplashGate>
    <LoadingProvider>
      <PermissionProvider>
        <SettingsProvider>
          <App />
        </SettingsProvider>
      </PermissionProvider>
    </LoadingProvider>
  </SplashGate>
);
