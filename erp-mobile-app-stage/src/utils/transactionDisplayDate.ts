import { resolveRoznamchaRowDateTime } from './transactionEventDateTime';

/** Locale for payment / transaction date labels (matches existing reports UI). */
const LOCALE = 'en-PK';

export {
  sliceDateOnly,
  getEventDateKey,
  getEventDateKey as getTransactionEventDateKey,
} from './transactionEventDateTime';

/** Group header label for a YYYY-MM-DD bucket (noon-local parse avoids UTC day shift). */
export function formatEventDateGroupLabel(ymd: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '—';
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString(LOCALE, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

/** Business date + time; time only when created_at matches business date (local day). */
export function formatPaymentDateTime(
  paymentDate?: string | null,
  createdAt?: string | null,
): { date: string; time: string } {
  const { date: ymd, time: time24 } = resolveRoznamchaRowDateTime(paymentDate, createdAt);
  let date = '';
  if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const d = new Date(`${ymd}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      date = d.toLocaleDateString(LOCALE, { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }

  let time = '';
  if (time24) {
    const [h, m] = time24.split(':').map((x) => parseInt(x, 10));
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      const t = new Date(`${ymd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
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
  const { date: ymd, time: time24 } = resolveRoznamchaRowDateTime(paymentDate, createdAt);
  const ca = String(createdAt || '').trim();
  if (ymd && time24) {
    const [h, m] = time24.split(':');
    return `${ymd}T${h}:${m}:00`;
  }
  if (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd)) return `${ymd}T12:00:00`;
  return ca;
}
