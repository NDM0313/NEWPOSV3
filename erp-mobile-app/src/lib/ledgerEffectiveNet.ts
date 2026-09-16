import type { LedgerLine } from '../api/reports';
import { compareLedgerLineChronological } from './ledgerChronology';

function normalizeLower(value: string | null | undefined): string {
  return String(value || '').toLowerCase().trim();
}

export function isReversalLedgerLine(line: LedgerLine): boolean {
  const d = normalizeLower(line.description);
  const t = normalizeLower(line.referenceType);
  return (
    t === 'correction_reversal' ||
    t === 'sale_reversal' ||
    d.includes('reversal') ||
    t.includes('reversal')
  );
}

function isPaymentLikeLedgerLine(line: LedgerLine): boolean {
  const d = normalizeLower(line.description);
  const t = normalizeLower(line.referenceType);
  return d.includes('payment') || t.includes('payment') || t.includes('receipt') || Boolean(line.paymentId);
}

function movementOf(line: LedgerLine): number {
  return Number(line.debit || 0) - Number(line.credit || 0);
}

function sortDayMs(line: LedgerLine): number {
  const d = String(line.date || '').slice(0, 10);
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

function buildReversalTwinMatcher(lines: LedgerLine[]) {
  const reversalRows = lines.filter((line) => isReversalLedgerLine(line));
  const reversalTextTargets = reversalRows
    .map((line) => normalizePaymentTargetText(String(line.description || '')))
    .filter(Boolean);
  const reversalPaymentIds = new Set(reversalRows.map((line) => String(line.paymentId || '')).filter(Boolean));

  const hasReversalTwin = (line: LedgerLine): boolean => {
    if (!isPaymentLikeLedgerLine(line) || isReversalLedgerLine(line)) return false;
    if (line.paymentId && reversalPaymentIds.has(String(line.paymentId))) return true;
    const rowText = normalizeLower(line.description || '');
    if (reversalTextTargets.some((t) => t && rowText.includes(t))) return true;
    const rowMove = movementOf(line);
    return reversalRows.some((rev) => {
      const revMove = movementOf(rev);
      return Math.abs(rowMove + revMove) < 0.0001 && sortDayMs(line) <= sortDayMs(rev);
    });
  };

  const hasOriginalTwin = (line: LedgerLine): boolean => {
    if (!isReversalLedgerLine(line)) return false;
    const paymentId = String(line.paymentId || '');
    if (paymentId) {
      return lines.some(
        (candidate) =>
          !isReversalLedgerLine(candidate) &&
          isPaymentLikeLedgerLine(candidate) &&
          String(candidate.paymentId || '') === paymentId,
      );
    }
    const revText = normalizePaymentTargetText(String(line.description || ''));
    if (revText) {
      return lines.some((candidate) => {
        if (isReversalLedgerLine(candidate) || !isPaymentLikeLedgerLine(candidate)) return false;
        return normalizeLower(candidate.description || '').includes(revText);
      });
    }
    const revMove = movementOf(line);
    return lines.some((candidate) => {
      if (isReversalLedgerLine(candidate) || !isPaymentLikeLedgerLine(candidate)) return false;
      const candMove = movementOf(candidate);
      return Math.abs(candMove + revMove) < 0.0001 && sortDayMs(candidate) <= sortDayMs(line);
    });
  };

  return { hasReversalTwin, hasOriginalTwin };
}

/** Hide paired reversal rows and their offsetting payment twins — matches web Include reversals OFF. */
export function filterEffectiveNetLedgerLines(lines: LedgerLine[]): LedgerLine[] {
  const { hasReversalTwin, hasOriginalTwin } = buildReversalTwinMatcher(lines);
  return lines.filter((line) => {
    if (isReversalLedgerLine(line)) return !hasOriginalTwin(line);
    return !hasReversalTwin(line);
  });
}

export function rebuildRunningBalanceFromOpening(
  lines: LedgerLine[],
  openingBalance: number,
  apLiabilityStyle = false,
): LedgerLine[] {
  const sorted = [...lines].sort(compareLedgerLineChronological);
  let running = openingBalance;
  return sorted.map((line) => {
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    running = apLiabilityStyle ? running + credit - debit : running + debit - credit;
    return { ...line, runningBalance: running };
  });
}

export function effectiveNetLedgerPresentation(
  lines: LedgerLine[],
  openingBalance: number,
  apLiabilityStyle = false,
): { lines: LedgerLine[]; closingBalance: number } {
  const filtered = filterEffectiveNetLedgerLines(lines);
  if (!filtered.length) {
    return { lines: [], closingBalance: openingBalance };
  }
  const presented = rebuildRunningBalanceFromOpening(filtered, openingBalance, apLiabilityStyle);
  return {
    lines: presented,
    closingBalance: presented[presented.length - 1]?.runningBalance ?? openingBalance,
  };
}

export function formatPartyLedgerLoadError(rpcError: string | null | undefined): string | null {
  if (!rpcError) return null;
  return `Party ledger could not be loaded (${rpcError}). Balance may be unavailable until connection is restored.`;
}
