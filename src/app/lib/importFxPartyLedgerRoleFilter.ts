/**
 * Path 21 operational role split for party Supplier vs Agent FX ledgers.
 * Official CoA account ledger stays unfiltered; party Supplier views use supplierRole.
 */

export type PartyLedgerRoleView = 'supplier' | 'agent_fx' | 'all';

export type ImportFxLedgerRoleRow = {
  je_reference_type?: string | null;
  reference_type?: string | null;
  document_type?: string | null;
  payment_id?: string | null;
  description?: string | null;
  debit?: number;
  credit?: number;
};

function normalizeRef(raw: string | null | undefined): string {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

/** True when JE is Path 21 FX credit-buy (Agent AP). */
export function isFxCurrencyPurchaseReference(refType: string | null | undefined): boolean {
  const r = normalizeRef(refType);
  return r === 'fx_currency_purchase' || r.includes('fx_currency_purchase');
}

/**
 * Classify fx_currency_purchase before generic includes('purchase').
 * Returns 'fx_agent' for Path 21 credit; otherwise null (caller continues).
 */
export function mapFxAgentSourceKind(
  refType: string | null | undefined
): 'fx_agent' | null {
  return isFxCurrencyPurchaseReference(refType) ? 'fx_agent' : null;
}

export function isSupplierMerchandiseReference(refType: string | null | undefined): boolean {
  const r = normalizeRef(refType);
  if (!r) return false;
  if (isFxCurrencyPurchaseReference(r)) return false;
  if (r.includes('purchase_return') || (r.includes('return') && r.includes('purchase'))) return true;
  if (r.includes('purchase_adjustment') || r.includes('purchase_reversal')) return true;
  if (r === 'purchase' || r.startsWith('purchase_')) return true;
  return false;
}

/**
 * Keep supplier-role rows: merchandise purchase* docs + payments not in agent FX settlements.
 * Opening balance rows (no payment / not fx credit) kept.
 */
export function isSupplierOperationalApRow(
  row: ImportFxLedgerRoleRow,
  agentSettlementPaymentIds: ReadonlySet<string>
): boolean {
  const ref =
    row.je_reference_type ||
    row.reference_type ||
    row.document_type ||
    '';
  const r = normalizeRef(ref);

  if (r.includes('opening') || (row.description || '').toLowerCase().includes('opening balance')) {
    return true;
  }

  if (isFxCurrencyPurchaseReference(r)) return false;

  const payId = row.payment_id ? String(row.payment_id) : '';
  if (payId && agentSettlementPaymentIds.has(payId)) return false;

  // payment JE / generic payment: keep unless settlement-excluded above
  if (r.includes('payment') || payId) return true;

  if (isSupplierMerchandiseReference(r)) return true;

  // Unknown journal on same AP: exclude from supplier operational to avoid agent mix
  if (r.includes('fx_') || r.includes('agent')) return false;

  // Keep other non-FX AP activity (adjustments etc.)
  return !isFxCurrencyPurchaseReference(r);
}

export function isAgentFxOperationalApRow(
  row: ImportFxLedgerRoleRow,
  agentSettlementPaymentIds: ReadonlySet<string>
): boolean {
  const ref =
    row.je_reference_type ||
    row.reference_type ||
    row.document_type ||
    '';
  const r = normalizeRef(ref);
  if (isFxCurrencyPurchaseReference(r)) return true;
  const payId = row.payment_id ? String(row.payment_id) : '';
  if (payId && agentSettlementPaymentIds.has(payId)) return true;
  return false;
}

export function filterApRowsByPartyRole<T extends ImportFxLedgerRoleRow>(
  rows: T[],
  role: PartyLedgerRoleView,
  agentSettlementPaymentIds: ReadonlySet<string>
): T[] {
  if (role === 'all') return rows;
  if (role === 'supplier') {
    return rows.filter((r) => isSupplierOperationalApRow(r, agentSettlementPaymentIds));
  }
  return rows.filter((r) => isAgentFxOperationalApRow(r, agentSettlementPaymentIds));
}

/** Recalculate AP liability running balances after filtering (credit − debit). */
export function recalcApLiabilityRunningBalances<
  T extends { debit?: number; credit?: number; running_balance?: number },
>(rows: T[], openingBalance = 0): T[] {
  let bal = openingBalance;
  return rows.map((row, idx) => {
    const isOpening =
      idx === 0 &&
      Number(row.debit || 0) === 0 &&
      Number(row.credit || 0) === 0 &&
      String((row as { description?: string }).description || '')
        .toLowerCase()
        .includes('opening');
    if (isOpening) {
      bal = Number(row.running_balance ?? openingBalance);
      return { ...row, running_balance: bal };
    }
    bal = bal + Number(row.credit || 0) - Number(row.debit || 0);
    return { ...row, running_balance: bal };
  });
}

/**
 * Wave 0: role-filtered opening must match the same filtered dataset as table rows.
 * Sum credit−debit for rows strictly before startDate; return in-range rows separately.
 */
export function splitRoleFilteredApRowsByPeriod<
  T extends { date?: string; debit?: number; credit?: number; description?: string },
>(filteredRows: T[], startDate: string | null | undefined): { opening: number; inRange: T[] } {
  const start = startDate ? String(startDate).slice(0, 10) : '';
  if (!start) {
    return { opening: 0, inRange: filteredRows };
  }
  let opening = 0;
  const inRange: T[] = [];
  for (const row of filteredRows) {
    const desc = String(row.description || '').toLowerCase();
    if (desc.includes('opening balance')) continue;
    const d = String(row.date || '').slice(0, 10);
    if (d && d < start) {
      opening += Number(row.credit || 0) - Number(row.debit || 0);
    } else {
      inRange.push(row);
    }
  }
  return { opening: Math.round(opening * 100) / 100, inRange };
}

/** Summarize AP liability rows for cards/exports (same dataset as table). */
export function summarizeRoleFilteredApRows(
  rows: Array<{ debit?: number; credit?: number; payment_id?: string | null; je_reference_type?: string | null }>,
  opening: number
): {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  paymentsPaid: number;
} {
  let totalDebit = 0;
  let totalCredit = 0;
  let paymentsPaid = 0;
  for (const r of rows) {
    const d = Number(r.debit || 0);
    const c = Number(r.credit || 0);
    totalDebit += d;
    totalCredit += c;
    const ref = String(r.je_reference_type || '').toLowerCase();
    if (r.payment_id || ref.includes('payment')) {
      paymentsPaid += d;
    }
  }
  const closing = Math.round((opening + totalCredit - totalDebit) * 100) / 100;
  return {
    openingBalance: opening,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    closingBalance: closing,
    paymentsPaid: Math.round(paymentsPaid * 100) / 100,
  };
}

export function sumSupplierPaymentsPaidFromRows(
  rows: Array<{ debit?: number; credit?: number; sourceKind?: string; payment_id?: string | null }>,
  agentSettlementPaymentIds: ReadonlySet<string>
): number {
  let paid = 0;
  for (const r of rows) {
    const payId = r.payment_id ? String(r.payment_id) : '';
    if (payId && agentSettlementPaymentIds.has(payId)) continue;
    if (r.sourceKind === 'payment' || payId) {
      paid += Number(r.debit || 0);
    }
  }
  return Math.round(paid * 100) / 100;
}

/** Pure eligibility: Path 21 agent list. */
export function isEligibleMoneyExchangeAgentType(type: string | null | undefined): boolean {
  return String(type || '').toLowerCase().trim() === 'money_exchange';
}

export function assertAgentDistinctFromSupplier(
  agentContactId: string | null | undefined,
  supplierContactId: string | null | undefined
): string | null {
  const a = String(agentContactId || '').trim();
  const s = String(supplierContactId || '').trim();
  if (!a || !s) return null;
  if (a === s) {
    return 'The money-exchange agent cannot be the same party as the purchase supplier.';
  }
  return null;
}

export function filterSearchableOptionsByQuery<T extends Record<string, unknown>>(
  options: T[],
  query: string,
  fields: (keyof T | string)[]
): T[] {
  const q = String(query || '')
    .toLowerCase()
    .trim();
  if (!q) return options;
  return options.filter((opt) =>
    fields.some((f) => String(opt[f as string] ?? '').toLowerCase().includes(q))
  );
}
