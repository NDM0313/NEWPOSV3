import { isLiquidityPaymentAccount } from './liquidityPaymentAccount';
import { isOperationalExtendedCoaCode } from './coaTreeRows';

export type RoznamchaJeLineRef = {
  debit?: number | null;
  credit?: number | null;
  account?: {
    name?: string | null;
    type?: string | null;
    code?: string | null;
  } | null;
};

const GENERIC_ROZNAMCHA_PARTY_LABELS = new Set([
  'supplier payment',
  'customer receipt',
  'customer payment',
  'manual payment',
  'manual receipt',
  'on-account payment',
  'shop expense',
  'journal entry',
  'general entry',
  'manual entry',
  'payment',
  'cash sale',
  'rental payment',
  'worker payment',
  'courier payment',
]);

export function isGenericRoznamchaPartyLabel(label: string | null | undefined): boolean {
  const norm = String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s*\(voided\)\s*$/i, '')
    .trim();
  if (!norm) return true;
  return GENERIC_ROZNAMCHA_PARTY_LABELS.has(norm);
}

function formatAccountLabel(acc: { name?: string | null; code?: string | null }): string {
  const name = String(acc.name || '').trim();
  const code = acc.code != null ? String(acc.code).trim() : '';
  if (!name) return code || '';
  return code ? `${name} (${code})` : name;
}

/** True for postable operating expense GL accounts — excludes AR/AP/revenue/liquidity. */
export function isExpenseGlAccount(
  acc: { name?: string | null; type?: string | null; code?: string | null } | null | undefined
): boolean {
  if (!acc || isLiquidityPaymentAccount(acc)) return false;
  const type = String(acc.type || '').toLowerCase();
  const name = String(acc.name || '').toLowerCase();
  if (!type.includes('expense')) return false;
  if (/receivable|payable|revenue|income|cogs|cost of production|inventory/.test(name)) {
    return false;
  }
  return true;
}

/** Manual transfer targets: expense GL + operational extended codes (3003 HOME EXPENSES, 117x, …). */
export function isManualTransferCounterpartyAccount(
  acc: { name?: string | null; type?: string | null; code?: string | null } | null | undefined
): boolean {
  if (!acc || isLiquidityPaymentAccount(acc)) return false;
  const code = String(acc.code ?? '').trim();
  if (isOperationalExtendedCoaCode(code)) return true;
  return isExpenseGlAccount(acc);
}

function resolveCounterpartyFromJeLinesFiltered(
  lines: RoznamchaJeLineRef[] | null | undefined,
  direction: 'IN' | 'OUT',
  accountFilter: (acc: NonNullable<RoznamchaJeLineRef['account']>) => boolean
): string | null {
  if (!lines?.length) return null;

  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const acc = line.account;
    if (!acc || isLiquidityPaymentAccount(acc) || !accountFilter(acc)) continue;

    const debit = Number(line.debit) || 0;
    const credit = Number(line.credit) || 0;
    const onBusinessSide = direction === 'OUT' ? debit > 0 : credit > 0;
    if (!onBusinessSide) continue;

    const label = formatAccountLabel(acc);
    if (!label) continue;
    const norm = label.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    candidates.push(label);
  }

  return candidates.length > 0 ? candidates.join(', ') : null;
}

/** Non-liquidity counterparty account(s) on the business side of a cash movement row. */
export function resolveCounterpartyLabelFromJeLines(
  lines: RoznamchaJeLineRef[] | null | undefined,
  direction: 'IN' | 'OUT'
): string | null {
  return resolveCounterpartyFromJeLinesFiltered(lines, direction, () => true);
}

/** Expense / manual-transfer GL leg — for replacing generic Supplier Payment / Customer Receipt labels. */
export function resolveExpenseCounterpartyFromJeLines(
  lines: RoznamchaJeLineRef[] | null | undefined,
  direction: 'IN' | 'OUT'
): string | null {
  return resolveCounterpartyFromJeLinesFiltered(lines, direction, isManualTransferCounterpartyAccount);
}

export type CounterpartyByDirection = { IN?: string; OUT?: string };

export function buildCounterpartyByDirectionFromJeLines(
  lines: RoznamchaJeLineRef[] | null | undefined
): CounterpartyByDirection {
  const out: CounterpartyByDirection = {};
  const inLabel = resolveCounterpartyLabelFromJeLines(lines, 'IN');
  const outLabel = resolveCounterpartyLabelFromJeLines(lines, 'OUT');
  if (inLabel) out.IN = inLabel;
  if (outLabel) out.OUT = outLabel;
  return out;
}

export function buildExpenseCounterpartyByDirectionFromJeLines(
  lines: RoznamchaJeLineRef[] | null | undefined
): CounterpartyByDirection {
  const out: CounterpartyByDirection = {};
  const inLabel = resolveExpenseCounterpartyFromJeLines(lines, 'IN');
  const outLabel = resolveExpenseCounterpartyFromJeLines(lines, 'OUT');
  if (inLabel) out.IN = inLabel;
  if (outLabel) out.OUT = outLabel;
  return out;
}

export function counterpartyForPaymentDirection(
  map: CounterpartyByDirection | undefined,
  direction: 'IN' | 'OUT'
): string | null {
  if (!map) return null;
  return direction === 'IN' ? map.IN ?? null : map.OUT ?? null;
}

export function resolveExpenseCounterpartyForPayment(
  paymentId: string,
  direction: 'IN' | 'OUT',
  journalEntryIdByPaymentId: Map<string, string>,
  expenseCounterpartyByJeId: Map<string, CounterpartyByDirection>
): string | null {
  const jeId = journalEntryIdByPaymentId.get(paymentId);
  if (!jeId) return null;
  return counterpartyForPaymentDirection(expenseCounterpartyByJeId.get(jeId), direction);
}

export function resolveGenericPaymentExpenseLabel(
  genericLabel: string,
  paymentId: string,
  direction: 'IN' | 'OUT',
  journalEntryIdByPaymentId: Map<string, string>,
  expenseCounterpartyByJeId: Map<string, CounterpartyByDirection>
): string | null {
  if (!isGenericRoznamchaPartyLabel(genericLabel)) return null;
  return resolveExpenseCounterpartyForPayment(
    paymentId,
    direction,
    journalEntryIdByPaymentId,
    expenseCounterpartyByJeId
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Manual liquidity journals from Add Entry — legacy JV- and new JE- refs. */
export function isGeneralLiquidityJournalRef(no: string | null | undefined): boolean {
  return /^(JE|JV)-/i.test(String(no || '').trim());
}

/** @deprecated Use isGeneralLiquidityJournalRef — kept for existing callers/tests. */
export function isJvJournalEntryNo(no: string | null | undefined): boolean {
  return isGeneralLiquidityJournalRef(no);
}

export type ManualJournalPaymentRef = {
  id: string;
  reference_type?: string | null;
  reference_id?: string | null;
  reference_number?: string | null;
};

/** Backfill JE id/no from manual journal liquidity payments (reference_id = JE uuid, reference_number = JE-/JV-…). */
export function seedManualJournalPaymentJeMaps(
  payments: ManualJournalPaymentRef[],
  journalEntryNoByPaymentId: Map<string, string>,
  journalEntryIdByPaymentId: Map<string, string>,
): void {
  for (const p of payments) {
    const rt = String(p.reference_type || '').toLowerCase();
    if (rt !== 'manual_receipt' && rt !== 'manual_payment') continue;
    const pid = String(p.id || '').trim();
    if (!pid) continue;
    const refId = String(p.reference_id || '').trim();
    if (refId && UUID_RE.test(refId) && !journalEntryIdByPaymentId.has(pid)) {
      journalEntryIdByPaymentId.set(pid, refId);
    }
    const refNo = String(p.reference_number || '').trim();
    if (isGeneralLiquidityJournalRef(refNo) && !journalEntryNoByPaymentId.has(pid)) {
      journalEntryNoByPaymentId.set(pid, refNo);
    }
  }
}

export function formatJvRoznamchaSubtitle(counterpartyMap: CounterpartyByDirection | undefined): string {
  if (!counterpartyMap) return '';
  const outLeg = counterpartyMap.OUT?.trim() || '';
  const inLeg = counterpartyMap.IN?.trim() || '';
  if (outLeg && inLeg) return `${outLeg} → ${inLeg}`;
  return outLeg || inLeg;
}

export function isJvBoilerplatePaymentNote(notes: string | null | undefined): boolean {
  const t = String(notes || '').trim();
  if (!t) return true;
  if (/^receipt\s+(jv|je)-/i.test(t)) return true;
  if (/^customer receipt$/i.test(t)) return true;
  if (/^supplier payment$/i.test(t)) return true;
  if (isGenericRoznamchaPartyLabel(t)) return true;
  return false;
}

export function resolveJvLinkedCounterpartyLabel(
  paymentId: string,
  direction: 'IN' | 'OUT',
  journalEntryNoOrRef: string | null | undefined,
  journalEntryIdByPaymentId: Map<string, string>,
  counterpartyByJeId: Map<string, CounterpartyByDirection>,
  journalEntryIdFallback?: string | null,
): string | null {
  if (!isGeneralLiquidityJournalRef(journalEntryNoOrRef)) return null;
  const jeId =
    journalEntryIdByPaymentId.get(paymentId)?.trim() ||
    (journalEntryIdFallback && UUID_RE.test(String(journalEntryIdFallback).trim())
      ? String(journalEntryIdFallback).trim()
      : null);
  if (!jeId) return null;
  return counterpartyForPaymentDirection(counterpartyByJeId.get(jeId), direction);
}
