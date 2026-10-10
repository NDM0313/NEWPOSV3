import type { LedgerLine } from '../api/reports';
import type { LedgerPreviewRow } from '../components/shared/LedgerPreviewPdf';
import { resolveTimelinePresentation } from './transactionTimelinePresentation';

const GENERIC_DESCRIPTION_PATTERNS = [
  /^payment received\b/i,
  /^supplier payment\b/i,
  /^customer receipt\b/i,
  /^customer payment\b/i,
  /^manual payment\b/i,
  /^manual receipt\b/i,
  /^on-?account payment\b/i,
  /^shop expense\b/i,
  /^cash sale\b/i,
  /^rental payment\b/i,
  /^worker payment\b/i,
  /^payment\b/i,
  /^journal entry\b/i,
];

const CONTROL_ACCOUNT_CODES = new Set(['1100', '1200', '2100', '2000', '4000', '4100', '5000', '5010']);

const LIQUIDITY_COUNTER_TYPES = new Set(['cash', 'bank', 'wallet', 'mobile_wallet']);

const OPERATIONAL_REF_TYPES = new Set([
  'sale',
  'sale_return',
  'sale_reversal',
  'sale_adjustment',
  'sale_extra_expense',
  'party_discount',
  'customer_discount',
  'supplier_discount',
  'payment',
  'payment_adjustment',
  'on_account',
  'purchase',
  'purchase_return',
  'purchase_adjustment',
  'purchase_reversal',
  'rental',
  'expense',
  'extra_expense',
  'worker_payment',
]);

export type LedgerLinePresentationOpts = {
  viewedPartyName?: string | null;
  viewedAccountName?: string | null;
};

function isGenericLedgerDescription(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return true;
  return GENERIC_DESCRIPTION_PATTERNS.some((re) => re.test(t));
}

function isControlAccountName(name: string | null | undefined, code?: string | null): boolean {
  const c = String(code || '').trim();
  if (c && CONTROL_ACCOUNT_CODES.has(c)) return true;
  const n = String(name || '').trim().toLowerCase();
  return /accounts?\s+receivable|accounts?\s+payable|trade\s+debtors?|trade\s+creditors?|sales\s+revenue/.test(
    n,
  );
}

function isGlAccountLabel(text: string): boolean {
  const t = String(text || '').trim().toLowerCase();
  if (!t || t === '—') return true;
  return (
    /^sales revenue\b/.test(t) ||
    /^revenue\b/.test(t) ||
    /^cost of goods\b/.test(t) ||
    /^accounts receivable\b/.test(t) ||
    /^accounts payable\b/.test(t) ||
    /^receivable\s*[-–]/.test(t) ||
    /^payable\s*[-–]/.test(t) ||
    /^sales revenue\s*[-–]/.test(t)
  );
}

function leafCounterName(line: LedgerLine): string | null {
  const name = String(line.counterAccountName || '').trim();
  if (!name || isControlAccountName(name, line.counterAccountCode)) return null;
  if (isGlAccountLabel(name)) return null;
  return name;
}

function isLiquidityCounter(line: LedgerLine): boolean {
  const t = String(line.counterAccountType || '').toLowerCase();
  return LIQUIDITY_COUNTER_TYPES.has(t);
}

function mergeLedgerEntryDescription(
  entryDescription: string | null | undefined,
  lineDescription: string | null | undefined,
): string {
  const ed = String(entryDescription || '').trim();
  const ld = String(lineDescription || '').trim();
  if (!ed && !ld) return '—';
  if (!ld || ld.toLowerCase() === ed.toLowerCase()) return ed || ld || '—';
  if (ed.toLowerCase().includes(ld.toLowerCase())) return ed;
  if (isGlAccountLabel(ld) && ed) return ed;
  if (isGlAccountLabel(ed) && ld) return ld;
  return ed || ld;
}

export function inferLedgerReferenceType(referenceType: string, description: string): string {
  const rt = String(referenceType || '').trim().toLowerCase();
  if (rt) return rt;
  const d = String(description || '').trim().toLowerCase();
  if (/sale\s+return|return\s+refund/.test(d)) return 'sale_return';
  if (/\bdiscount\b/.test(d)) return 'party_discount';
  if (/payment\s+received|customer\s+receipt/.test(d)) return 'payment';
  if (/^sale\b|sale\s+#|sale\s+inv|invoice\s+/.test(d)) return 'sale';
  if (/^purchase\b|purchase\s+#|purchase\s+inv/.test(d)) return 'purchase';
  return '';
}

export function ledgerDocumentTypeLabel(referenceType: string, description: string): string {
  const rt = inferLedgerReferenceType(referenceType, description);
  const d = String(description || '').trim().toLowerCase();

  if (rt === 'sale' || rt === 'sale_adjustment' || rt === 'sale_extra_expense') {
    if (/\bdiscount\b/.test(d) && !/^sale\b/.test(d)) return 'Discount';
    return 'Sale';
  }
  if (rt === 'sale_return') return 'Sale Return';
  if (rt === 'sale_reversal') return 'Sale Reversal';
  if (rt === 'party_discount' || rt === 'customer_discount' || rt === 'supplier_discount') return 'Discount';
  if (rt === 'payment' || rt === 'payment_adjustment') return 'Payment Received';
  if (rt === 'manual_receipt') return 'Payment Received';
  if (rt === 'manual_payment') return 'Payment';
  if (rt === 'purchase' || rt === 'purchase_adjustment') return 'Purchase';
  if (rt === 'purchase_return') return 'Purchase Return';
  if (rt === 'purchase_reversal') return 'Purchase Reversal';
  if (rt === 'on_account') return 'On Account';
  if (rt === 'rental') return 'Rental';
  if (rt === 'expense' || rt === 'extra_expense') return 'Expense';
  if (rt === 'worker_payment') return 'Worker Payment';

  if (/\bdiscount\b/.test(d)) return 'Discount';
  if (/sale\s+return|return\s+refund/.test(d)) return 'Sale Return';
  if (/payment\s+received|customer\s+receipt/.test(d)) return 'Payment Received';
  if (/^sale\b|sale\s+#|sale\s+inv/.test(d)) return 'Sale';

  return 'Journal Entry';
}

export function isOperationalLedgerRefType(referenceType: string, description: string): boolean {
  const rt = inferLedgerReferenceType(referenceType, description);
  return OPERATIONAL_REF_TYPES.has(rt);
}

function resolveOperationalDetail(line: LedgerLine): string | null {
  const merged = mergeLedgerEntryDescription(line.entryDescription, line.description);
  const detail = String(merged || '').trim();
  if (!detail || detail === '—' || isGlAccountLabel(detail)) return null;
  if (isGenericLedgerDescription(detail)) return detail;
  return detail;
}

function formatOperationalLedgerPresentation(line: LedgerLine): { title: string; subline?: string } | null {
  const raw = String(line.description || '').trim() || '—';
  const rt = inferLedgerReferenceType(line.referenceType, raw);
  if (!OPERATIONAL_REF_TYPES.has(rt)) return null;

  const docLabel = ledgerDocumentTypeLabel(rt, raw);
  const detail = resolveOperationalDetail(line);

  if (detail && detail.toLowerCase() !== docLabel.toLowerCase()) {
    return { title: docLabel, subline: detail };
  }
  if (
    (rt === 'payment' || rt === 'payment_adjustment') &&
    isGenericLedgerDescription(raw)
  ) {
    return { title: docLabel, subline: raw };
  }
  if (isGenericLedgerDescription(raw) && raw.toLowerCase() !== docLabel.toLowerCase()) {
    return { title: docLabel, subline: raw };
  }
  return { title: docLabel };
}

function inferPaymentDirection(line: LedgerLine): 'received' | 'paid' {
  const rt = String(line.referenceType || '').toLowerCase();
  if (rt === 'manual_receipt') return 'received';
  if (rt === 'manual_payment') return 'paid';
  if (line.credit > 0 && line.debit === 0) return 'received';
  return 'paid';
}

function liquidityTimelineTitle(line: LedgerLine, viewedAccountName?: string | null): string | null {
  const rt = String(line.referenceType || '').toLowerCase();
  if (rt !== 'manual_receipt' && rt !== 'manual_payment') return null;
  const viewed = viewedAccountName?.trim() || null;
  const counter = leafCounterName(line);
  if (!viewed && !counter) return null;

  const direction = inferPaymentDirection(line);
  const pres = resolveTimelinePresentation({
    direction,
    referenceType: rt,
    paymentAccountName: viewed || counter,
    paymentAccountCode: null,
    paymentAccountType: 'bank',
    partyAccountName: counter || viewed,
    partyAccountCode: line.counterAccountCode,
    partyAccountType: line.counterAccountType || 'bank',
    partyName: line.partyName ?? null,
    paymentAccountId: null,
    partyAccountId: null,
    notes: line.description,
  });
  return pres.title;
}

export function formatLedgerLinePresentation(
  line: LedgerLine,
  opts: LedgerLinePresentationOpts = {},
): { title: string; subline?: string } {
  const raw = String(line.description || '').trim() || '—';

  const liquidityTitle = liquidityTimelineTitle(line, opts.viewedAccountName);
  if (liquidityTitle) {
    return {
      title: liquidityTitle,
      subline: isGenericLedgerDescription(raw) && raw.toLowerCase() !== liquidityTitle.toLowerCase() ? raw : undefined,
    };
  }

  const operational = formatOperationalLedgerPresentation(line);
  if (operational) return operational;

  const enrichedParty = String(line.partyName || '').trim();
  const rt = inferLedgerReferenceType(line.referenceType, raw);
  if (enrichedParty && rt !== 'sale' && rt !== 'purchase') {
    return {
      title: enrichedParty,
      subline: isGenericLedgerDescription(raw) && raw.toLowerCase() !== enrichedParty.toLowerCase() ? raw : undefined,
    };
  }

  const counter = leafCounterName(line);
  const isPaymentLike =
    rt === 'payment' ||
    rt === 'manual_receipt' ||
    rt === 'manual_payment' ||
    rt === 'on_account';
  if (counter && (isLiquidityCounter(line) || isPaymentLike)) {
    return {
      title: counter,
      subline: isGenericLedgerDescription(raw) && raw.toLowerCase() !== counter.toLowerCase() ? raw : undefined,
    };
  }

  const merged = mergeLedgerEntryDescription(line.entryDescription, line.description);
  return { title: merged };
}

export function toLedgerPreviewRow(
  line: LedgerLine,
  reference: string,
  opts: LedgerLinePresentationOpts = {},
): LedgerPreviewRow {
  const pres = formatLedgerLinePresentation(line, opts);
  return {
    date: line.date,
    reference,
    description: pres.title,
    descriptionSubline: pres.subline,
    debit: line.debit,
    credit: line.credit,
    balance: line.runningBalance,
    hasAttachment: line.hasAttachments,
  };
}
