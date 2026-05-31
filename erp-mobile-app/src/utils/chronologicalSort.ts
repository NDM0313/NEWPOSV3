import type { TransactionRow } from '../api/transactions';
import { parseLocalDateInput, toLocalDateString } from './localDate';

export type DocumentSortFields = {
  /** invoice_date / po_date / expense_date / payment_date */
  documentDate?: string | null;
  /** created_at timestamptz */
  eventTimestamp?: string | null;
};

function documentDateMs(value?: string | null): number {
  const s = String(value ?? '').trim();
  if (!s) return 0;
  return parseLocalDateInput(toLocalDateString(s)).getTime();
}

function eventTimestampMs(value?: string | null): number {
  const s = String(value ?? '').trim();
  if (!s) return 0;
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return parsed;
  return parseLocalDateInput(s).getTime();
}

/** Combined sort key — higher = newer (document day first, then event clock time). */
export function documentEventSortMs(fields: DocumentSortFields): number {
  const docMs = documentDateMs(fields.documentDate);
  const eventMs = eventTimestampMs(fields.eventTimestamp);
  const primary = docMs || eventMs;
  return primary * 1_000_000_000_000 + eventMs;
}

export function compareDocumentDateTimeDesc(a: DocumentSortFields, b: DocumentSortFields): number {
  const docMsA = documentDateMs(a.documentDate);
  const docMsB = documentDateMs(b.documentDate);
  const primaryA = docMsA || eventTimestampMs(a.eventTimestamp);
  const primaryB = docMsB || eventTimestampMs(b.eventTimestamp);
  if (primaryB !== primaryA) return primaryB - primaryA;
  const eventA = eventTimestampMs(a.eventTimestamp);
  const eventB = eventTimestampMs(b.eventTimestamp);
  if (eventB !== eventA) return eventB - eventA;
  return 0;
}

export function sortByDocumentDateTimeDesc<T>(
  rows: T[],
  pick: (row: T) => DocumentSortFields,
): T[] {
  return [...rows].sort((a, b) => compareDocumentDateTimeDesc(pick(a), pick(b)));
}

export function transactionEffectiveMs(tx: TransactionRow): number {
  const c = String(tx.createdAt || '').trim();
  if (c) {
    const ms = Date.parse(c);
    if (!Number.isNaN(ms)) return ms;
  }
  const p = String(tx.paymentDate || '').slice(0, 10);
  if (p) {
    const ms = Date.parse(`${p}T00:00:00.000Z`);
    if (!Number.isNaN(ms)) return ms;
  }
  return 0;
}

export function compareTransactionRowDesc(a: TransactionRow, b: TransactionRow): number {
  const ta = transactionEffectiveMs(a);
  const tb = transactionEffectiveMs(b);
  if (tb !== ta) return tb - ta;
  const pa = String(a.paymentDate || '').slice(0, 10);
  const pb = String(b.paymentDate || '').slice(0, 10);
  if (pa !== pb) return pb.localeCompare(pa);
  return String(b.id).localeCompare(String(a.id));
}
