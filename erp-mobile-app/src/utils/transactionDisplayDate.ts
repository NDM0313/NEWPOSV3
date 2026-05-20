/** Locale for payment / transaction date labels (matches existing reports UI). */
const LOCALE = 'en-PK';

export function sliceDateOnly(s: string | null | undefined): string {
  const t = String(s || '').trim();
  if (!t) return '';
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : t.slice(0, 10);
}

/** YYYY-MM-DD for timeline grouping: business event date first, created_at only if missing. */
export function getTransactionEventDateKey(
  eventDate?: string | null,
  createdAt?: string | null,
): string {
  const event = sliceDateOnly(eventDate);
  if (event && /^\d{4}-\d{2}-\d{2}$/.test(event)) return event;
  const posted = sliceDateOnly(createdAt);
  if (posted && /^\d{4}-\d{2}-\d{2}$/.test(posted)) return posted;
  return '';
}

/** Group header label for a YYYY-MM-DD bucket (noon-local parse avoids UTC day shift). */
export function formatEventDateGroupLabel(ymd: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '—';
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(LOCALE, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Calendar date from business `payment_date` (YYYY-MM-DD), noon-local parse to avoid UTC day shift.
 * Time-of-day from `created_at` when present (actual recording time).
 */
export function formatPaymentDateTime(
  paymentDate?: string | null,
  createdAt?: string | null,
): { date: string; time: string } {
  const ymd = getTransactionEventDateKey(paymentDate, createdAt);
  let date = '';
  if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const d = new Date(`${ymd}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      date = d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } else {
    const ca = String(createdAt || '').trim();
    if (ca) {
      const c = new Date(ca);
      if (!Number.isNaN(c.getTime())) {
        date = c.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
      }
    }
  }

  let time = '';
  const ca = String(createdAt || '').trim();
  if (ca) {
    const t = new Date(ca);
    if (!Number.isNaN(t.getTime())) {
      time = t.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }

  return { date, time };
}

/** Single line for transaction detail header, e.g. "20-May-2026 · 03:28 PM". */
export function formatPaymentDateTimeLine(paymentDate?: string | null, createdAt?: string | null): string {
  const { date, time } = formatPaymentDateTime(paymentDate, createdAt);
  if (date && time) return `${date} · ${time}`;
  return date || time || '';
}

/**
 * Local datetime string for components that parse with `new Date(...)` (e.g. ReceiptPreviewPdf).
 * Uses payment calendar date + wall time from created_at.
 */
export function paymentDateTimeIsoForReceipt(paymentDate?: string | null, createdAt?: string | null): string {
  const ymd = getTransactionEventDateKey(paymentDate, createdAt);
  const ca = String(createdAt || '').trim();
  const pad = (n: number) => String(n).padStart(2, '0');
  if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) && ca) {
    const t = new Date(ca);
    if (!Number.isNaN(t.getTime())) {
      return `${ymd}T${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
    }
  }
  if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) return `${ymd}T12:00:00`;
  return ca;
}
