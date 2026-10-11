import { isVerboseApiErrorsEnabled } from './developerMode';

/** Format errors for user-visible strings when verbose API mode is on (Developer Tools). */
export function formatApiErrorForDisplay(error: unknown, fallback: string): string {
  if (!isVerboseApiErrorsEnabled()) {
    if (error instanceof Error) return error.message || fallback;
    return fallback;
  }
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'object' && error !== null) {
    const o = error as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message) return o.message;
    if (typeof o.error === 'string' && o.error) return o.error;
    if (o.error && typeof o.error === 'object') {
      const e2 = o.error as Record<string, unknown>;
      const parts = [e2.message, e2.code, e2.details, e2.hint].filter(Boolean);
      if (parts.length) return parts.map(String).join(' · ');
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  if (typeof error === 'string') return error || fallback;
  return fallback;
}
