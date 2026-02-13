/**
 * Optional basic logging for ERP.
 * Enable via VITE_ENABLE_LOGGING=true for debugging.
 * Production: no console output by default.
 */
const ENABLED = import.meta.env.VITE_ENABLE_LOGGING === 'true' || import.meta.env.DEV;

export const logger = {
  info: (...args: unknown[]) => {
    if (ENABLED) console.info('[ERP]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (ENABLED) console.warn('[ERP]', ...args);
  },
  error: (...args: unknown[]) => {
    // Always log errors in dev; in prod only if enabled
    if (import.meta.env.DEV || ENABLED) console.error('[ERP]', ...args);
  },
  debug: (...args: unknown[]) => {
    if (ENABLED) console.debug('[ERP]', ...args);
  },
};
