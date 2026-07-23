/**
 * Phase 3B-F — stable Cash Flow diagnostic row keys (export-only; no business logic change).
 */

import { isCorrectionReversalReferenceType } from '@/app/lib/reportVisibilityContract';

export type CashFlowRowKeyConfidence =
  | 'EXACT_KEY'
  | 'STRONG_KEY'
  | 'WEAK_KEY'
  | 'BUCKET_ONLY'
  | 'UNMATCHABLE_NEEDS_EXPORT_FIELD';

export type CashFlowRowSide =
  | 'cash_in'
  | 'cash_out'
  | 'transfer_in'
  | 'transfer_out'
  | 'opening'
  | 'reversal'
  | 'void'
  | 'unknown';

export type CashFlowVisibilityClass =
  | 'normal'
  | 'audit'
  | 'reversal'
  | 'void'
  | 'correction'
  | 'opening';

export type CashFlowTransferClass =
  | 'internal_transfer_in'
  | 'internal_transfer_out'
  | 'not_transfer';

export type CashFlowRowKeyInput = {
  journalEntryLineId?: string | null;
  journalEntryId?: string | null;
  paymentId?: string | null;
  legacyRowId?: string | null;
  date?: string | null;
  referenceType?: string | null;
  sourceModule?: string | null;
  cashIn?: number;
  cashOut?: number;
  accountCode?: string | null;
  accountName?: string | null;
  description?: string | null;
  status?: string | null;
};

const SECRET_FIELD_PATTERN = /password|secret|token|api[_-]?key|credential/i;

export function hashDescription(text: string): string {
  const s = String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return `dh${(h >>> 0).toString(16)}`;
}

export function normalizeDateKey(date: string | null | undefined): string {
  if (!date) return '';
  const d = String(date).trim();
  const iso = d.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const slash = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
  return d.slice(0, 10);
}

export function parseLegacyJournalLineId(row: CashFlowRowKeyInput): string | null {
  if (row.journalEntryLineId?.trim()) return row.journalEntryLineId.trim();
  const id = row.legacyRowId?.trim() || '';
  if (id.startsWith('jel-')) return id.replace(/^jel-/, '');
  return null;
}

export function classifyRowSide(input: CashFlowRowKeyInput): CashFlowRowSide {
  const rt = String(input.referenceType || '').toLowerCase();
  const sm = String(input.sourceModule || '').toLowerCase();
  const cashIn = Number(input.cashIn) || 0;
  const cashOut = Number(input.cashOut) || 0;
  if (rt.includes('opening_balance') || sm.includes('opening')) return 'opening';
  if (isCorrectionReversalReferenceType(rt) || String(input.status || '').toLowerCase() === 'reversed') {
    return 'reversal';
  }
  if (String(input.status || '').toLowerCase() === 'voided') return 'void';
  if (rt === 'transfer' || sm.includes('transfer')) {
    if (cashOut > 0 && cashIn === 0) return 'transfer_out';
    if (cashIn > 0 && cashOut === 0) return 'transfer_in';
    return cashIn >= cashOut ? 'transfer_in' : 'transfer_out';
  }
  if (cashIn > 0 && cashOut === 0) return 'cash_in';
  if (cashOut > 0 && cashIn === 0) return 'cash_out';
  return 'unknown';
}

export function classifyVisibility(input: CashFlowRowKeyInput, auditMode: boolean): CashFlowVisibilityClass {
  const rt = String(input.referenceType || '').toLowerCase();
  const status = String(input.status || '').toLowerCase();
  if (rt.includes('opening_balance')) return 'opening';
  if (isCorrectionReversalReferenceType(rt) || status === 'reversed') return 'reversal';
  if (status === 'voided') return auditMode ? 'audit' : 'void';
  if (auditMode && (status === 'voided' || status === 'reversed')) return 'audit';
  return 'normal';
}

export function classifyTransfer(input: CashFlowRowKeyInput): CashFlowTransferClass {
  const side = classifyRowSide(input);
  if (side === 'transfer_in') return 'internal_transfer_in';
  if (side === 'transfer_out') return 'internal_transfer_out';
  return 'not_transfer';
}

export function buildCashFlowStableRowKey(
  input: CashFlowRowKeyInput
): { stableRowKey: string; keyConfidence: CashFlowRowKeyConfidence } {
  const jel = parseLegacyJournalLineId(input);
  const je = input.journalEntryId?.trim() || null;
  const pay = input.paymentId?.trim() || null;
  const date = normalizeDateKey(input.date);
  const cashIn = Math.round((Number(input.cashIn) || 0) * 100) / 100;
  const cashOut = Math.round((Number(input.cashOut) || 0) * 100) / 100;
  const rt = String(input.referenceType || input.sourceModule || 'unknown').toLowerCase();
  const acct = String(input.accountCode || input.accountName || '').toLowerCase().slice(0, 32);

  if (jel) {
    return {
      stableRowKey: `jel:${jel}`,
      keyConfidence: 'EXACT_KEY',
    };
  }

  if (je && date && (cashIn > 0 || cashOut > 0)) {
    return {
      stableRowKey: `je:${je}|${date}|in:${cashIn}|out:${cashOut}`,
      keyConfidence: 'STRONG_KEY',
    };
  }

  if (pay && date && (cashIn > 0 || cashOut > 0)) {
    return {
      stableRowKey: `pay:${pay}|${date}|in:${cashIn}|out:${cashOut}`,
      keyConfidence: 'STRONG_KEY',
    };
  }

  if (date && (cashIn > 0 || cashOut > 0) && rt) {
    return {
      stableRowKey: `weak:${date}|${rt}|${acct}|in:${cashIn}|out:${cashOut}`,
      keyConfidence: 'WEAK_KEY',
    };
  }

  if (rt && (cashIn > 0 || cashOut > 0)) {
    return {
      stableRowKey: `bucket:${rt}|in:${cashIn}|out:${cashOut}`,
      keyConfidence: 'BUCKET_ONLY',
    };
  }

  const descHash = hashDescription(input.description || '');
  return {
    stableRowKey: `unmatch:${descHash}|in:${cashIn}|out:${cashOut}`,
    keyConfidence: 'UNMATCHABLE_NEEDS_EXPORT_FIELD',
  };
}

export function redactExportSecrets<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_FIELD_PATTERN.test(k)) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = redactExportSecrets(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
