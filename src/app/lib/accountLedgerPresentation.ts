/**
 * Account ledger reversal / twin presentation helpers.
 * Used by AccountLedgerReportPage audit vs effective modes and unit tests.
 */

export type LedgerPresentationRow = {
  date: string;
  created_at?: string;
  description?: string;
  debit: number;
  credit: number;
  running_balance: number;
  document_type?: string;
  ledger_kind?: string;
  je_reference_type?: string | null;
  payment_id?: string;
  reference_number?: string;
  source_module?: string;
};

function normalizeLower(value: string | null | undefined): string {
  return String(value || '').toLowerCase().trim();
}

export function isReversalLedgerRow(e: LedgerPresentationRow): boolean {
  const d = normalizeLower(e.description);
  const t = normalizeLower(e.document_type);
  const jeRt = normalizeLower(e.je_reference_type);
  return (
    e.ledger_kind === 'reversal' ||
    jeRt === 'correction_reversal' ||
    jeRt === 'sale_reversal' ||
    d.includes('reversal') ||
    t.includes('reversal')
  );
}

export function isPaymentLikeLedgerRow(e: LedgerPresentationRow): boolean {
  const d = normalizeLower(e.description);
  const t = normalizeLower(e.document_type);
  return d.includes('payment') || t.includes('payment') || Boolean(e.payment_id);
}

export function movementOfLedgerRow(e: LedgerPresentationRow): number {
  return Number(e.debit || 0) - Number(e.credit || 0);
}

function sortDayMs(e: LedgerPresentationRow): number {
  const d = (e.date || '').toString().slice(0, 10);
  const t = Date.parse(d);
  return Number.isNaN(t) ? 0 : t;
}

function normalizePaymentTargetText(description: string): string {
  const d = normalizeLower(description);
  return d
    .replace(/^reversal of:\s*/i, '')
    .replace(/^reversal\s*-\s*/i, '')
    .replace(/^reversal\s*/i, '')
    .trim();
}

export type ReversalTwinMatcher<T extends LedgerPresentationRow> = {
  reversalRows: T[];
  hasReversalTwin: (row: T) => boolean;
  hasOriginalTwin: (row: T) => boolean;
};

export function buildReversalTwinMatcher<T extends LedgerPresentationRow>(base: T[]): ReversalTwinMatcher<T> {
  const reversalRows = base.filter((e) => isReversalLedgerRow(e));
  const reversalTextTargets = reversalRows
    .map((e) => normalizePaymentTargetText(String(e.description || '')))
    .filter(Boolean);
  const reversalPaymentIds = new Set(reversalRows.map((e) => String(e.payment_id || '')).filter(Boolean));

  const hasReversalTwin = (row: T): boolean => {
    if (!isPaymentLikeLedgerRow(row) || isReversalLedgerRow(row)) return false;
    if (row.payment_id && reversalPaymentIds.has(String(row.payment_id))) return true;
    const rowText = normalizeLower(row.description || '');
    if (reversalTextTargets.some((t) => t && rowText.includes(t))) return true;
    const rowMove = movementOfLedgerRow(row);
    return reversalRows.some((rev) => {
      const revMove = movementOfLedgerRow(rev);
      return Math.abs(rowMove + revMove) < 0.0001 && sortDayMs(row) <= sortDayMs(rev);
    });
  };

  const hasOriginalTwin = (row: T): boolean => {
    if (!isReversalLedgerRow(row)) return false;
    const paymentId = String(row.payment_id || '');
    if (paymentId) {
      return base.some(
        (candidate) =>
          !isReversalLedgerRow(candidate) &&
          isPaymentLikeLedgerRow(candidate) &&
          String(candidate.payment_id || '') === paymentId,
      );
    }
    const revText = normalizePaymentTargetText(String(row.description || ''));
    if (revText) {
      return base.some((candidate) => {
        if (isReversalLedgerRow(candidate) || !isPaymentLikeLedgerRow(candidate)) return false;
        return normalizeLower(candidate.description || '').includes(revText);
      });
    }
    const revMove = movementOfLedgerRow(row);
    return base.some((candidate) => {
      if (isReversalLedgerRow(candidate) || !isPaymentLikeLedgerRow(candidate)) return false;
      const candMove = movementOfLedgerRow(candidate);
      return Math.abs(candMove + revMove) < 0.0001 && sortDayMs(candidate) <= sortDayMs(row);
    });
  };

  return { reversalRows, hasReversalTwin, hasOriginalTwin };
}

/** Audit mode: when reversals are hidden, drop paired reversal rows and their payment twins. */
export function filterAuditRowsForReversals<T extends LedgerPresentationRow>(
  rows: T[],
  includeReversals: boolean,
  matcher: Pick<ReversalTwinMatcher<T>, 'hasReversalTwin' | 'hasOriginalTwin'>,
): T[] {
  if (includeReversals) return rows;
  return rows.filter((e) => {
    if (isReversalLedgerRow(e)) return !matcher.hasOriginalTwin(e);
    return !matcher.hasReversalTwin(e);
  });
}

/**
 * Full audit set (adjustments + reversals visible) should keep RPC running balances.
 * Realign only when rows were filtered out of the audit chain.
 */
export function shouldPreserveRpcRunningBalancesForAudit(
  includeReversals: boolean,
  includeAdjustments: boolean,
): boolean {
  return includeReversals && includeAdjustments;
}

export type PresentedLedgerBalanceRow = LedgerPresentationRow & {
  displayDebit: number;
  displayCredit: number;
  displayRunningBalance: number;
};

/**
 * Recompute the balance column from row 0 so rollups and filters still chain correctly.
 * Supplier AP: liability running_balance += credit − debit.
 * Customer AR / cash GL: asset-style += debit − credit.
 */
export function alignLedgerRunningBalances<T extends PresentedLedgerBalanceRow>(
  rows: T[],
  apLiabilityStyle: boolean,
): T[] {
  if (!rows.length) return rows;
  const out: T[] = [];
  let prevBal = Number(rows[0].displayRunningBalance ?? rows[0].running_balance ?? 0);
  out.push({ ...rows[0], displayRunningBalance: prevBal });
  for (let idx = 1; idx < rows.length; idx++) {
    const row = rows[idx];
    const d = Number(row.displayDebit || 0);
    const c = Number(row.displayCredit || 0);
    prevBal = apLiabilityStyle ? prevBal + c - d : prevBal + d - c;
    out.push({ ...row, displayRunningBalance: prevBal });
  }
  return out;
}
