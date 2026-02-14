/**
 * App version and build timestamp – injected at build time by Vite.
 * Used in Settings → About System and for release discipline.
 */
declare const __APP_VERSION__: string;
declare const __BUILD_TIMESTAMP__: string;

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.1-dev';
export const BUILD_TIMESTAMP = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : '';

export function getBuildDateDisplay(): string {
  if (!BUILD_TIMESTAMP) return '—';
  try {
    const d = new Date(BUILD_TIMESTAMP);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return BUILD_TIMESTAMP;
  }
}
