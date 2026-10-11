export function formatAmount(n: number, digits = 2): string {
  const sign = n < 0 ? '-' : '';
  return (
    sign +
    Math.abs(n).toLocaleString('en-PK', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  );
}

export function formatInt(n: number): string {
  return n.toLocaleString('en-PK', { maximumFractionDigits: 0 });
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return typeof d === 'string' ? d : '—';
  return date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(d: string | Date | null | undefined): { date: string; time: string } {
  if (!d) return { date: '—', time: '' };
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return { date: typeof d === 'string' ? d : '—', time: '' };
  return {
    date: date.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: date.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true }),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Display-safe reference/entry number.
 * - Returns the value as-is when it's a human-readable reference (e.g. PAY-0012,
 *   INV-2026-044, EXP-0003).
 * - When the value is a raw UUID (or empty), returns a readable fallback
 *   derived from the reference type (e.g. "payment" -> "PAYMENT") so the UI
 *   never leaks database identifiers to end-users.
 */
export function displayReferenceNumber(
  value: string | null | undefined,
  fallbackType?: string | null,
): string {
  const v = (value || '').trim();
  if (!v || UUID_RE.test(v)) {
    const t = (fallbackType || 'entry').replace(/_/g, ' ').trim();
    return t ? t.toUpperCase() : 'ENTRY';
  }
  return v;
}

export function dateRangeLabel(from?: string, to?: string): string {
  if (!from && !to) return 'All time';
  if (from && to && from === to) return formatDate(from);
  const pieces = [] as string[];
  if (from) pieces.push(formatDate(from));
  pieces.push('→');
  if (to) pieces.push(formatDate(to));
  return pieces.join(' ');
}
