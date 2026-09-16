/**
 * Pure helpers for Ledger V2 Payment / Created-by enrichment (testable without Supabase).
 */

export const LEDGER_V2_EMPTY = '—';

const LIQUIDITY_ACCOUNT_TYPES = new Set(['cash', 'bank', 'wallet']);

export type CounterAccountLine = {
  lineId: string;
  accountId: string;
  name: string;
  code: string;
  type: string;
};

/** Parse bank/settlement label from transfer-style JE descriptions. */
export function parseTransferSettlementFromDescription(description: string): string | null {
  const s = String(description || '').trim();
  if (!s) return null;

  const arrow = s.match(/\btransfer\b.+?\s*(?:→|->|—>|to)\s*(.+?)(?:\s*[-—]|$)/i);
  if (arrow?.[1]) {
    const label = arrow[1].trim();
    return label || null;
  }

  const via = s.match(/\bvia\s+(.+?)(?:\s*[-—]|$)/i);
  if (via?.[1]) {
    const label = via[1].trim();
    return label || null;
  }

  return null;
}

export function formatAccountLabel(name: string, code?: string | null): string {
  const n = String(name || '').trim();
  const c = String(code || '').trim();
  if (!n) return '';
  return c ? `${n} (${c})` : n;
}

/** Pick counter-side account label; prefer cash/bank/wallet when multiple lines exist. */
export function pickCounterAccountLabel(
  lines: CounterAccountLine[],
  excludeLineId?: string | null,
  excludeAccountIds?: Set<string>,
): string | null {
  const candidates = lines.filter((line) => {
    if (excludeLineId && line.lineId === excludeLineId) return false;
    if (excludeAccountIds?.has(line.accountId)) return false;
    return Boolean(String(line.name || '').trim());
  });
  if (!candidates.length) return null;

  const liquidity = candidates.filter((line) =>
    LIQUIDITY_ACCOUNT_TYPES.has(String(line.type || '').toLowerCase()),
  );
  const pick = liquidity.length ? liquidity : candidates;
  const labels = pick.map((line) => formatAccountLabel(line.name, line.code)).filter(Boolean);
  return labels.length ? [...new Set(labels)].join(', ') : null;
}

export function isLedgerV2Placeholder(value?: string | null): boolean {
  const v = String(value || '').trim();
  return !v || v === LEDGER_V2_EMPTY;
}

/** True when Payment column should be replaced (empty or shows viewed/party GL account). */
export function shouldReplacePaymentMethod(
  current: string | undefined | null,
  viewedAccountNames: Set<string>,
): boolean {
  const v = String(current || '').trim();
  if (isLedgerV2Placeholder(v)) return true;
  if (viewedAccountNames.has(v)) return true;
  for (const name of viewedAccountNames) {
    if (!name) continue;
    if (v === name) return true;
    if (v.startsWith(`${name} (`)) return true;
    if (name.startsWith(v)) return true;
  }
  return false;
}

/** Display-only short label for Ledger V2 Payment column (full value kept in tooltip). */
export function shortenLedgerPaymentLabel(full: string): string {
  const original = String(full || '').trim();
  if (!original || original === LEDGER_V2_EMPTY) return original || LEDGER_V2_EMPTY;
  if (original.includes(',')) {
    return original
      .split(',')
      .map((part) => shortenSingleLedgerPaymentLabel(part.trim()))
      .join(', ');
  }
  return shortenSingleLedgerPaymentLabel(original);
}

function shortenSingleLedgerPaymentLabel(label: string): string {
  const full = String(label || '').trim();
  if (!full) return full;

  let s = full;
  s = s.replace(/^receivable\s*[-—]\s*/i, '');
  s = s.replace(/^payable\s*[-—]\s*/i, '');
  s = s.replace(/\s*\(AR-[^)]+\)\s*/gi, ' ');
  s = s.replace(/\s*\(AP-[^)]+\)\s*/gi, ' ');
  s = s.replace(/\s*\(\d+\)\s*/g, ' ');
  s = s.replace(/\s+payable\s*$/i, '');
  s = s.replace(/\s+receivable\s*$/i, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s || full;
}
