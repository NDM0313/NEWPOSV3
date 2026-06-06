/**
 * Pure Roznamcha trace diagnostics (Phase C2) — no Supabase, no repairs.
 */
import {
  roznamchaEntityKeys,
  roznamchaMovementKey,
  type RoznamchaDedupeRow,
} from '@/app/services/roznamchaDedupe';

export type RoznamchaCandidateSource = 'payments' | 'rental_payments' | 'journal';

export interface RoznamchaTraceRowInput extends RoznamchaDedupeRow {
  journalEntryNo?: string | null;
  details?: string;
}

export interface RoznamchaInclusionOutcome {
  included: boolean;
  reason: string;
  winnerRef?: string;
  winnerId?: string;
}

export function inferRoznamchaCandidateSource(
  row: Pick<RoznamchaTraceRowInput, 'id' | 'sourcePaymentId' | 'sourceRentalPaymentId' | 'sourceJournalEntryId'>
): RoznamchaCandidateSource {
  if (row.id.startsWith('rp-') || String(row.sourceRentalPaymentId || '').trim()) return 'rental_payments';
  if (
    row.id.startsWith('jel-') ||
    row.id.startsWith('orphan-') ||
    (String(row.sourceJournalEntryId || '').trim() && !String(row.sourcePaymentId || '').trim())
  ) {
    return 'journal';
  }
  return 'payments';
}

export function roznamchaSourcePriority(row: RoznamchaDedupeRow): number {
  if (String(row.sourcePaymentId || '').trim()) return 3;
  if (row.id.startsWith('rp-') || String(row.sourceRentalPaymentId || '').trim()) return 2;
  if (row.id.startsWith('jel-') || row.id.startsWith('orphan-rp-') || String(row.sourceJournalEntryId || '').trim()) {
    return 1;
  }
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id);
  return uuidLike ? 3 : 1;
}

export function roznamchaRowMatchesQuery(
  row: Pick<RoznamchaTraceRowInput, 'ref' | 'journalEntryNo' | 'details'>,
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const ref = String(row.ref || '').toLowerCase();
  const je = String(row.journalEntryNo || '').toLowerCase();
  const details = String(row.details || '').toLowerCase();
  return ref.includes(q) || je.includes(q) || details.includes(q);
}

export function explainRoznamchaInclusion(
  row: RoznamchaTraceRowInput,
  postDedupe: RoznamchaTraceRowInput[]
): RoznamchaInclusionOutcome {
  const direct = postDedupe.find((p) => p.id === row.id);
  if (direct) {
    return { included: true, reason: 'Included — canonical row after dedupe' };
  }

  const rowKeys = roznamchaEntityKeys(row);
  for (const winner of postDedupe) {
    const winnerKeys = roznamchaEntityKeys(winner);
    const shared = rowKeys.filter((k) => winnerKeys.includes(k));
    if (shared.length === 0) continue;
    if (winner.id === row.id) {
      return { included: true, reason: `Included via entity key(s): ${shared.join(', ')}` };
    }
    return {
      included: false,
      reason: `Excluded duplicate — already counted via canonical row (${shared.join(', ')})`,
      winnerRef: winner.ref,
      winnerId: winner.id,
    };
  }

  return {
    included: false,
    reason: 'Excluded — not present in post-dedupe Roznamcha set (fetch filter or dedupe collapse)',
  };
}

export function defaultRoznamchaTraceDateRange(todayIso?: string): { dateFrom: string; dateTo: string } {
  const today = todayIso ? new Date(todayIso) : new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 90);
  return { dateFrom: fromDate.toISOString().slice(0, 10), dateTo: to };
}

export interface RoznamchaTraceCandidateView {
  rowId: string;
  source: RoznamchaCandidateSource;
  ref: string;
  date: string;
  direction: 'IN' | 'OUT';
  amount: number;
  liquidityAccount: string;
  included: boolean;
  reason: string;
  entityKeys: string[];
  sourcePriority: number;
  movementKey: string;
  journalEntryNo: string | null;
  details: string;
  winnerRef?: string;
  sourcePaymentId?: string | null;
  sourceRentalPaymentId?: string | null;
  sourceJournalEntryId?: string | null;
  paymentAccountId?: string | null;
}

export function buildRoznamchaTraceCandidates(
  preDedupe: RoznamchaTraceRowInput[],
  postDedupe: RoznamchaTraceRowInput[],
  query: string
): RoznamchaTraceCandidateView[] {
  const q = query.trim();
  const pool = q ? preDedupe.filter((r) => roznamchaRowMatchesQuery(r, q)) : preDedupe;

  return pool.map((row) => {
    const outcome = explainRoznamchaInclusion(row, postDedupe);
    return {
      rowId: row.id,
      source: inferRoznamchaCandidateSource(row),
      ref: String(row.ref || ''),
      date: String(row.date || ''),
      direction: row.direction,
      amount: Number(row.amount) || 0,
      liquidityAccount: row.accountName || row.accountLabel || '—',
      included: outcome.included,
      reason: outcome.reason,
      entityKeys: roznamchaEntityKeys(row),
      sourcePriority: roznamchaSourcePriority(row),
      movementKey: roznamchaMovementKey(row),
      journalEntryNo: row.journalEntryNo ?? null,
      details: String(row.details || ''),
      winnerRef: outcome.winnerRef,
      sourcePaymentId: row.sourcePaymentId ?? null,
      sourceRentalPaymentId: row.sourceRentalPaymentId ?? null,
      sourceJournalEntryId: row.sourceJournalEntryId ?? null,
      paymentAccountId: row.paymentAccountId ?? null,
    };
  });
}
