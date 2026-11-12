/**
 * Import FX W3 local UI Demo Mode — activation gate only.
 * Never enables production posting. Requires explicit Vite env flag + localhost host.
 */

export const IMPORT_FX_W3_DEMO_ENV_KEY = 'VITE_IMPORT_FX_W3_DEMO';

export const IMPORT_FX_W3_DEMO_PATH = '/demo/import-fx-w3';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function readImportFxW3DemoEnvFlag(
  env: Record<string, unknown> | undefined = typeof import.meta !== 'undefined'
    ? (import.meta as { env?: Record<string, unknown> }).env
    : undefined
): boolean {
  const raw = env?.[IMPORT_FX_W3_DEMO_ENV_KEY];
  if (raw === true) return true;
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }
  return false;
}

export function isLocalDemoHostname(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const h = hostname.trim().toLowerCase();
  if (LOCAL_HOSTS.has(h)) return true;
  // Reject production-like hosts explicitly even if somehow flagged
  if (h.includes('dincouture') || h.endsWith('.pk') || h.includes('supabase.')) return false;
  return false;
}

export type ImportFxW3DemoActivation = {
  allowed: boolean;
  reason: string;
  flagOn: boolean;
  hostnameOk: boolean;
  hostname: string;
};

export function evaluateImportFxW3DemoActivation(args?: {
  flagOn?: boolean;
  hostname?: string | null;
}): ImportFxW3DemoActivation {
  const flagOn =
    typeof args?.flagOn === 'boolean' ? args.flagOn : readImportFxW3DemoEnvFlag();
  const hostname =
    args?.hostname != null
      ? String(args.hostname)
      : typeof window !== 'undefined'
        ? window.location.hostname
        : '';
  const hostnameOk = isLocalDemoHostname(hostname);
  if (!flagOn) {
    return {
      allowed: false,
      reason: 'Demo flag absent or false (set VITE_IMPORT_FX_W3_DEMO=true in gitignored .env.local).',
      flagOn,
      hostnameOk,
      hostname,
    };
  }
  if (!hostnameOk) {
    return {
      allowed: false,
      reason: 'Demo Mode rejects non-local hostnames (localhost / 127.0.0.1 only).',
      flagOn,
      hostnameOk,
      hostname,
    };
  }
  return {
    allowed: true,
    reason: 'Demo Mode active — in-memory UX only; no accounting posts.',
    flagOn,
    hostnameOk,
    hostname,
  };
}

/** True only when explicit flag + localhost. Safe for UI entry buttons. */
export function isImportFxW3DemoAllowed(args?: {
  flagOn?: boolean;
  hostname?: string | null;
}): boolean {
  return evaluateImportFxW3DemoActivation(args).allowed;
}
