import { Capacitor } from '@capacitor/core';

const DEFAULT_TOP = '0px';
const DEFAULT_BOTTOM = '0px';
const BOTTOM_NAV_PX = 64;

/** Apply safe-area CSS variables on native; configure status bar overlay. */
export async function initNativeShell(): Promise<void> {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--erp-inset-top', DEFAULT_TOP);
  root.style.setProperty('--erp-inset-bottom', DEFAULT_BOTTOM);
  root.style.setProperty('--erp-bottom-nav-height', `${BOTTOM_NAV_PX}px`);

  if (!Capacitor.isNativePlatform()) {
    const probeTop = getComputedStyle(root).getPropertyValue('env(safe-area-inset-top)').trim();
    if (probeTop) root.style.setProperty('--erp-inset-top', probeTop);
    const probeBottom = getComputedStyle(root).getPropertyValue('env(safe-area-inset-bottom)').trim();
    if (probeBottom) root.style.setProperty('--erp-inset-bottom', probeBottom);
    return;
  }

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#111827' });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch (e) {
    console.warn('[nativeShell] StatusBar init skipped:', e);
  }

  // Android WebView often reports env(safe-area-inset-*) as 0 — use minimum touch clearance.
  const platform = Capacitor.getPlatform();
  if (platform === 'android') {
    root.style.setProperty('--erp-inset-top', '28px');
    root.style.setProperty('--erp-inset-bottom', '24px');
  } else if (platform === 'ios') {
    root.style.setProperty('--erp-inset-top', 'max(env(safe-area-inset-top, 0px), 20px)');
    root.style.setProperty('--erp-inset-bottom', 'env(safe-area-inset-bottom, 0px)');
  }
}
