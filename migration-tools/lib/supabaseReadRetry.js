const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const TRANSIENT_PATTERNS = [
  '502',
  '503',
  '504',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
  'fetch failed',
  'econnreset',
  'etimedout',
  'network',
  'timeout',
];

const DEFAULT_BACKOFF_MS = [1000, 3000, 7000];
const DEFAULT_MAX_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatReadError(err) {
  if (!err) return 'unknown error';
  const status = err.status ?? err.code;
  const msg = String(err.message || err).trim();
  if (status && msg) return `${status} ${msg}`;
  return msg || String(status || 'unknown error');
}

export function isTransientReadError(err) {
  if (!err) return false;

  const status = Number(err.status);
  if (TRANSIENT_STATUSES.has(status)) return true;

  const code = String(err.code || '').toUpperCase();
  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND') return true;

  const hay = `${err.message || ''} ${err.details || ''} ${err.hint || ''}`.toLowerCase();
  return TRANSIENT_PATTERNS.some((p) => hay.includes(p));
}

export function isGatewayReadError(err) {
  if (!err) return false;
  const status = Number(err.status);
  if (TRANSIENT_STATUSES.has(status)) return true;
  const hay = String(err.message || '').toLowerCase();
  return hay.includes('bad gateway') || hay.includes('gateway timeout') || hay.includes('service unavailable');
}

/**
 * Retry a read-only async fn on transient network/gateway errors.
 * @param {string} label
 * @param {() => Promise<unknown>} fn
 * @param {{ maxAttempts?: number, backoffMs?: number[] }} [opts]
 */
export async function withReadRetry(label, fn, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS;

  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientReadError(err) || attempt >= maxAttempts) throw err;
      console.log(
        `Read query ${label} failed with ${formatReadError(err)}, retrying attempt ${attempt + 1}/${maxAttempts}...`,
      );
      await sleep(backoffMs[attempt - 1] ?? 7000);
    }
  }
  throw lastErr;
}

/**
 * Wrap a PostgREST { data, error } query with transient retry.
 * @param {string} label
 * @param {() => Promise<{ data?: unknown, error?: object | null }>} queryFn
 */
export async function supabaseRead(label, queryFn) {
  return withReadRetry(label, async () => {
    const result = await queryFn();
    const err = result?.error;
    if (err && isTransientReadError(err)) {
      const wrapped = new Error(formatReadError(err));
      wrapped.status = err.status;
      wrapped.code = err.code;
      wrapped.cause = err;
      throw wrapped;
    }
    return result;
  });
}
