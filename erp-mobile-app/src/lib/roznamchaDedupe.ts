/**
 * Pure Roznamcha dedupe — no Supabase (testable in node:test).
 */
import { isRcvReference } from '../utils/rentalPaymentRef';

export interface RoznamchaDedupeRow {
  id: string;
  date: string;
  ref: string;
  details: string;
  direction: 'IN' | 'OUT';
  amount: number;
  accountLabel: string;
  accountName?: string | null;
  accountType: 'cash' | 'bank' | 'wallet' | null;
  paymentAccountId?: string | null;
  sourcePaymentId?: string | null;
  sourceRentalPaymentId?: string | null;
  sourceJournalEntryId?: string | null;
  sourceEconomicEventId?: string | null;
  journalEntryNo?: string | null;
}

export function roznamchaMovementKey(row: RoznamchaDedupeRow): string {
  return `${row.date}|${row.direction}|${Math.round(row.amount * 100)}|${row.paymentAccountId || ''}`;
}

export function roznamchaLooseMovementKey(row: RoznamchaDedupeRow): string {
  return `${row.date}|${row.direction}|${Math.round(row.amount * 100)}`;
}

function refQualityScore(row: RoznamchaDedupeRow): number {
  const ref = String(row.ref || '').trim();
  if (isRcvReference(ref)) return 5;
  if (/^PAY-/i.test(ref) || /^WPY-/i.test(ref)) return 5;
  if (/^REN-/i.test(ref)) return 5;
  if (/^EXP-/i.test(ref)) return 4;
  if (/^JE-/i.test(ref) || /^JV-/i.test(ref)) return 1;
  return 2;
}

function resolveSubAccountLabel(meta: { name: string } | undefined, shortLabel: string): string {
  const name = String(meta?.name || '').trim();
  return name || shortLabel || '—';
}

function mergeRoznamchaRowMetadata(winner: RoznamchaDedupeRow, loser: RoznamchaDedupeRow): RoznamchaDedupeRow {
  const merged = { ...winner };
  if (refQualityScore(loser) > refQualityScore(merged)) {
    merged.ref = loser.ref;
  }
  if (!merged.paymentAccountId && loser.paymentAccountId) {
    merged.paymentAccountId = loser.paymentAccountId;
    merged.accountName = merged.accountName || loser.accountName;
    merged.accountType = merged.accountType || loser.accountType;
    merged.accountLabel = merged.accountName
      ? resolveSubAccountLabel({ name: merged.accountName }, merged.accountLabel)
      : loser.accountLabel || merged.accountLabel;
  }
  if (!merged.details || merged.details === 'Rental Payment' || merged.details === 'Customer Receipt' || merged.details === 'Supplier Payment') {
    if (loser.details && loser.details !== merged.details) merged.details = loser.details;
  }
  const loserJe = String(loser.journalEntryNo || '').trim();
  const mergedRef = String(merged.ref || '').trim();
  if (loserJe && loserJe.toLowerCase() !== mergedRef.toLowerCase()) {
    merged.journalEntryNo = merged.journalEntryNo || loserJe;
  }
  return merged;
}

function roznamchaRowSourcePriority(row: RoznamchaDedupeRow): number {
  if (String(row.sourcePaymentId || '').trim()) return 3;
  if (row.id.startsWith('rp-') || String(row.sourceRentalPaymentId || '').trim()) return 2;
  if (row.id.startsWith('jel-') || row.id.startsWith('orphan-rp-') || String(row.sourceJournalEntryId || '').trim()) {
    return 1;
  }
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id);
  return uuidLike ? 3 : 1;
}

function pickBetterRoznamchaRow(a: RoznamchaDedupeRow, b: RoznamchaDedupeRow): RoznamchaDedupeRow {
  const pa = roznamchaRowSourcePriority(a);
  const pb = roznamchaRowSourcePriority(b);
  let winner: RoznamchaDedupeRow;
  let loser: RoznamchaDedupeRow;
  if (pa !== pb) {
    winner = pa > pb ? a : b;
    loser = pa > pb ? b : a;
  } else {
    const ra = refQualityScore(a);
    const rb = refQualityScore(b);
    if (ra !== rb) {
      winner = ra > rb ? a : b;
      loser = ra > rb ? b : a;
    } else {
      winner = a;
      loser = b;
    }
  }
  return mergeRoznamchaRowMetadata(winner, loser);
}

function roznamchaJournalSubtitle(row: Pick<RoznamchaDedupeRow, 'ref' | 'journalEntryNo'>): string | null {
  const ref = String(row.ref || '').trim();
  const je = String(row.journalEntryNo || '').trim();
  if (!je || je.toLowerCase() === ref.toLowerCase()) return null;
  if (/^JE-/i.test(ref) || /^JV-/i.test(ref)) return null;
  return je;
}

function finalizeRoznamchaRow<T extends RoznamchaDedupeRow>(row: T): T {
  row.accountLabel = resolveSubAccountLabel(
    row.accountName ? { name: row.accountName } : undefined,
    row.accountLabel
  );
  row.journalEntryNo = roznamchaJournalSubtitle(row);
  return row;
}

/** True when row carries pay/rp/je/ee entity identity for dedupe. */
export function hasStableEntityId(row: RoznamchaDedupeRow): boolean {
  return roznamchaEntityKeys(row).length > 0;
}

/** True when two rows represent the same underlying movement (shared entity key). */
export function rowsShareMovementEvidence(a: RoznamchaDedupeRow, b: RoznamchaDedupeRow): boolean {
  const keysA = roznamchaEntityKeys(a);
  const keysB = roznamchaEntityKeys(b);
  return keysA.some((k) => keysB.includes(k));
}

export function roznamchaEntityKeys(row: RoznamchaDedupeRow): string[] {
  const keys: string[] = [];
  const payId = String(row.sourcePaymentId || '').trim();
  if (payId) keys.push(`pay:${payId}`);
  else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id) && !row.id.startsWith('rp-')) {
    keys.push(`pay:${row.id}`);
  }
  const rpId = String(row.sourceRentalPaymentId || '').trim();
  if (rpId) keys.push(`rp:${rpId}`);
  if (row.id.startsWith('rp-')) keys.push(`rp:${row.id.slice(3)}`);
  const jeId = String(row.sourceJournalEntryId || '').trim();
  if (jeId) keys.push(`je:${jeId}`);
  const orphan = row.id.match(
    /^orphan-rp-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  );
  if (orphan) keys.push(`je:${orphan[1]}`);
  const eeId = String(row.sourceEconomicEventId || '').trim();
  if (eeId) keys.push(`ee:${eeId}`);
  return [...new Set(keys)];
}

/** Entity + strict movement dedupe only — no loose date|amount merge. */
export function dedupeRoznamchaRows<T extends RoznamchaDedupeRow>(rows: T[]): T[] {
  const bestByEntity = new Map<string, T>();
  const withoutEntity: T[] = [];
  for (const row of rows) {
    const entityKeys = roznamchaEntityKeys(row);
    if (entityKeys.length > 0) {
      let canonical: T = row;
      for (const entityKey of entityKeys) {
        const prev = bestByEntity.get(entityKey);
        if (prev) canonical = pickBetterRoznamchaRow(prev, canonical) as T;
        bestByEntity.set(entityKey, canonical);
      }
    } else {
      withoutEntity.push(row);
    }
  }

  const entityCandidates = [...new Set([...bestByEntity.values(), ...withoutEntity])];
  const entityDeduped = entityCandidates.filter((row) => {
    const rowKeys = roznamchaEntityKeys(row);
    return !entityCandidates.some((other) => {
      if (other === row) return false;
      const otherKeys = roznamchaEntityKeys(other);
      const linked = rowKeys.some((k) => otherKeys.includes(k));
      return linked && pickBetterRoznamchaRow(other, row) === other;
    });
  });

  const movementMerged: T[] = [];
  for (const row of entityDeduped) {
    const mKey = roznamchaMovementKey(row);
    const mergeIdx = movementMerged.findIndex((existing) => {
      if (roznamchaMovementKey(existing) !== mKey) return false;
      if (rowsShareMovementEvidence(existing, row)) return true;
      return !hasStableEntityId(existing) && !hasStableEntityId(row);
    });
    if (mergeIdx >= 0) {
      movementMerged[mergeIdx] = pickBetterRoznamchaRow(movementMerged[mergeIdx], row) as T;
    } else {
      movementMerged.push(row);
    }
  }
  return movementMerged.map((r) => finalizeRoznamchaRow(r));
}
