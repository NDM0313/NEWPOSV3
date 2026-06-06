/**
 * Business-event date/time rules for roznamcha and payment displays.
 * Date = user-selected business date (payment_date / entry_date / expense_date).
 * Time = from created_at only when its local calendar day matches the business date.
 */

export function sliceDateOnly(s: string | null | undefined): string {
  const t = String(s || '').trim();
  if (!t) return '';
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : t.slice(0, 10);
}

/** YYYY-MM-DD: business date first; created_at date only when business date is missing. */
export function getEventDateKey(
  businessDate?: string | null,
  createdAt?: string | null,
): string {
  const event = sliceDateOnly(businessDate);
  if (event && /^\d{4}-\d{2}-\d{2}$/.test(event)) return event;
  const posted = sliceDateOnly(createdAt);
  if (posted && /^\d{4}-\d{2}-\d{2}$/.test(posted)) return posted;
  return '';
}

function localYmdFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Roznamcha row date + time (24h HH:mm for sorting/display combine).
 * When business date and created_at fall on different local days, omit misleading clock time.
 */
export function resolveRoznamchaRowDateTime(
  businessDate?: string | null,
  createdAt?: string | null,
): { date: string; time: string } {
  const dateKey = getEventDateKey(businessDate, createdAt);
  const date = dateKey || sliceDateOnly(businessDate) || '';

  const ca = String(createdAt || '').trim();
  if (!date || !ca) {
    return { date, time: '' };
  }

  const created = new Date(ca);
  if (Number.isNaN(created.getTime())) {
    return { date, time: '' };
  }

  if (localYmdFromDate(created) === date) {
    const time = `${pad2(created.getHours())}:${pad2(created.getMinutes())}`;
    return { date, time };
  }

  return { date, time: '' };
}

export function isEventDateInRange(
  eventDateYmd: string,
  dateFrom: string,
  dateTo: string,
): boolean {
  const ymd = sliceDateOnly(eventDateYmd);
  if (!ymd || !dateFrom || !dateTo) return true;
  return ymd >= dateFrom.slice(0, 10) && ymd <= dateTo.slice(0, 10);
}

/** Combine row date + time for display (locale-aware). */
export function formatRoznamchaRowDateTimeDisplay(
  dateYmd: string,
  timeHhMm: string,
  locale = 'en-PK',
): string {
  if (!dateYmd) return timeHhMm || '—';
  const d = new Date(`${sliceDateOnly(dateYmd)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateYmd;
  const datePart = d.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  if (!timeHhMm) return datePart;
  const [h, m] = timeHhMm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return datePart;
  const withTime = new Date(`${sliceDateOnly(dateYmd)}T${pad2(h)}:${pad2(m)}:00`);
  return withTime.toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
