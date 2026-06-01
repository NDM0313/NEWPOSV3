/**
 * In-app debug log ring buffer (Developer Mode only — 7 taps on App version in Settings).
 * Captures [StorageUrl] / storage pipeline steps for APK diagnosis without adb.
 */

import {
  isDeveloperModeUnlocked,
  subscribeDeveloperMode,
} from './developerMode';

export type MobileDebugLogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface MobileDebugLogEntry {
  id: number;
  ts: number;
  level: MobileDebugLogLevel;
  tag: string;
  message: string;
  detail?: string;
}

const MAX_ENTRIES = 200;
const CHANGE_EVENT = 'erp-mobile-debug-log-changed';

const CONSOLE_CAPTURE_PATTERNS = [
  '[StorageUrl]',
  '[ERP Mobile]',
  '[uploadProductImages]',
  'nativeStorage',
  '[removeProductImagesFromStorage]',
  '[createProduct] image',
  '[updateProduct] image',
];

let nextId = 1;
const entries: MobileDebugLogEntry[] = [];
let captureInstalled = false;
let prevWarn: typeof console.warn | null = null;
let prevError: typeof console.error | null = null;

/** Last product image ref attempted (for "Test last image" in Settings). */
export let lastProductImageDebugRef: string | null = null;
export let lastProductImageDebugFailReason: string | null = null;

function redactSecrets(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt-redacted]')
    .replace(/[?&]token=[^&\s]+/gi, '?token=[redacted]');
}

function stringifyArg(arg: unknown): string {
  if (arg == null) return String(arg);
  if (typeof arg === 'string') return redactSecrets(arg);
  if (arg instanceof Error) return redactSecrets(arg.message);
  try {
    return redactSecrets(JSON.stringify(arg));
  } catch {
    return redactSecrets(String(arg));
  }
}

function formatConsoleArgs(args: unknown[]): { message: string; tag: string } {
  const parts = args.map(stringifyArg);
  const joined = parts.join(' ');
  for (const pat of CONSOLE_CAPTURE_PATTERNS) {
    if (joined.includes(pat)) {
      const tag = pat.replace(/^\[|\]$/g, '') || 'console';
      return { message: joined, tag };
    }
  }
  return { message: joined, tag: 'console' };
}

function shouldCaptureConsoleMessage(message: string): boolean {
  return CONSOLE_CAPTURE_PATTERNS.some((p) => message.includes(p));
}

function notifyListeners(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

function pushEntry(
  level: MobileDebugLogLevel,
  tag: string,
  message: string,
  detail?: string,
): void {
  if (!isDeveloperModeUnlocked()) return;
  const entry: MobileDebugLogEntry = {
    id: nextId++,
    ts: Date.now(),
    level,
    tag,
    message: redactSecrets(message),
    detail: detail ? redactSecrets(detail) : undefined,
  };
  entries.push(entry);
  while (entries.length > MAX_ENTRIES) entries.shift();
  notifyListeners();
}

/** Structured log for storage / product-image pipeline (visible in Settings debug panel). */
export function debugLog(
  tag: string,
  message: string,
  detail?: Record<string, unknown> | string | null,
): void {
  if (!isDeveloperModeUnlocked()) return;
  let detailStr: string | undefined;
  if (detail != null) {
    detailStr =
      typeof detail === 'string' ? detail : stringifyArg(detail);
  }
  pushEntry('info', tag, message, detailStr);
}

export function debugLogWarn(tag: string, message: string, detail?: string): void {
  if (!isDeveloperModeUnlocked()) return;
  pushEntry('warn', tag, message, detail);
}

export function debugLogError(tag: string, message: string, detail?: string): void {
  if (!isDeveloperModeUnlocked()) return;
  pushEntry('error', tag, message, detail);
}

export function getMobileDebugLogEntries(): readonly MobileDebugLogEntry[] {
  return entries;
}

export function clearMobileDebugLog(): void {
  entries.length = 0;
  notifyListeners();
}

export function subscribeMobileDebugLog(listener: () => void): () => void {
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}

export function getMobileDebugLogText(storageOnly = false): string {
  const lines = entries
    .filter((e) => !storageOnly || isStorageRelatedEntry(e))
    .map((e) => {
      const t = new Date(e.ts).toISOString();
      const d = e.detail ? ` | ${e.detail}` : '';
      return `${t} [${e.level}] ${e.tag}: ${e.message}${d}`;
    });
  return lines.join('\n');
}

export function isStorageRelatedEntry(e: MobileDebugLogEntry): boolean {
  const hay = `${e.tag} ${e.message} ${e.detail ?? ''}`;
  return (
    hay.includes('StorageUrl') ||
    hay.includes('Storage') ||
    hay.includes('product-images') ||
    hay.includes('ProductImage') ||
    hay.includes('nativeStorage') ||
    hay.includes('uploadProduct') ||
    hay.includes('image')
  );
}

function installConsoleCapture(): void {
  if (captureInstalled) return;
  captureInstalled = true;
  prevWarn = console.warn.bind(console);
  prevError = console.error.bind(console);

  console.warn = (...args: unknown[]) => {
    prevWarn?.(...args);
    if (!isDeveloperModeUnlocked()) return;
    const { message, tag } = formatConsoleArgs(args);
    if (shouldCaptureConsoleMessage(message)) {
      pushEntry('warn', tag, message);
    }
  };

  console.error = (...args: unknown[]) => {
    prevError?.(...args);
    if (!isDeveloperModeUnlocked()) return;
    const { message, tag } = formatConsoleArgs(args);
    if (shouldCaptureConsoleMessage(message) || tag === 'console') {
      pushEntry('error', tag, message);
    }
  };
}

function syncCaptureWithDeveloperMode(): void {
  if (isDeveloperModeUnlocked()) {
    installConsoleCapture();
    debugLog('DebugLog', 'Developer debug log capture active');
  }
}

/** Call once at app boot; re-enables capture when user unlocks developer mode mid-session. */
export function ensureMobileDebugLogCapture(): void {
  if (typeof window === 'undefined') return;
  syncCaptureWithDeveloperMode();
  subscribeDeveloperMode(() => syncCaptureWithDeveloperMode());
}

export function setLastProductImageDebugRef(
  ref: string | null,
  failReason?: string | null,
): void {
  lastProductImageDebugRef = ref;
  lastProductImageDebugFailReason = failReason ?? null;
}
