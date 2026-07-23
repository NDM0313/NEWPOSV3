import type { LiquidityAccountRef } from './liquidityPaymentAccount';
import { isRoznamchaLiquidityAccount } from './liquidityPaymentAccount';

export type TimelinePresentationVariant = 'in' | 'out' | 'transfer' | 'party';

export interface TimelinePresentation {
  variant: TimelinePresentationVariant;
  isReceived: boolean;
  title: string;
  from: string;
  to: string;
  amountClass: string;
  badgeClass: string;
  signPrefix: '+' | '−' | '↔';
}

export interface JournalLiquidityPresentationInput {
  referenceType?: string | null;
  paymentType?: string | null;
  linkedPaymentReferenceType?: string | null;
  paymentAccountName?: string | null;
  paymentAccountCode?: string | null;
  paymentAccountType?: string | null;
  counterpartyAccountName?: string | null;
  counterpartyAccountCode?: string | null;
  counterpartyAccountType?: string | null;
  isInternalLiquidityTransfer?: boolean;
}

export type TransactionRowLike = {
  direction: 'received' | 'paid';
  referenceType: string;
  paymentAccountId?: string | null;
  paymentAccountName?: string | null;
  partyAccountId?: string | null;
  partyAccountName?: string | null;
  partyName?: string | null;
  notes?: string | null;
  expenseCategoryLabel?: string | null;
  paymentAccountCode?: string | null;
  partyAccountCode?: string | null;
  paymentAccountType?: string | null;
  partyAccountType?: string | null;
  isInternalLiquidityTransfer?: boolean;
};

const CONTROL_ACCOUNT_PATTERNS = [
  /^accounts?\s+receivable$/i,
  /^accounts?\s+payable$/i,
  /^trade\s+debtors?$/i,
  /^trade\s+creditors?$/i,
];

const CONTROL_ACCOUNT_CODES = new Set(['1100', '1200', '2100', '2000']);

export function isLiquidityBackedPayment(refType: string | null | undefined): boolean {
  const rt = String(refType || '').toLowerCase();
  return rt === 'manual_receipt' || rt === 'manual_payment';
}

function isControlAccountDisplay(name: string | null | undefined, code?: string | null): boolean {
  const n = String(name || '').trim();
  if (!n) return false;
  const c = String(code || '').trim();
  if (c && CONTROL_ACCOUNT_CODES.has(c)) return true;
  return CONTROL_ACCOUNT_PATTERNS.some((re) => re.test(n));
}

function leafAccountName(name: string | null | undefined, code?: string | null): string | null {
  const n = String(name || '').trim();
  if (!n || isControlAccountDisplay(n, code)) return null;
  return n;
}

function liquidityRef(
  name: string | null | undefined,
  code?: string | null,
  type?: string | null,
): LiquidityAccountRef | null {
  const n = String(name || '').trim();
  if (!n) return null;
  return { name: n, code: code ?? null, type: type ?? null };
}

function paymentLiquidityRef(tx: TransactionRowLike): LiquidityAccountRef | null {
  return liquidityRef(tx.paymentAccountName, tx.paymentAccountCode, tx.paymentAccountType);
}

function partyLiquidityRef(tx: TransactionRowLike): LiquidityAccountRef | null {
  return liquidityRef(tx.partyAccountName, tx.partyAccountCode, tx.partyAccountType);
}

export function isInternalLiquidityTransferRow(tx: TransactionRowLike): boolean {
  if (tx.isInternalLiquidityTransfer === true) return true;
  if (!isLiquidityBackedPayment(tx.referenceType)) return false;
  const payLiq = paymentLiquidityRef(tx);
  const partyLiq = partyLiquidityRef(tx);
  return Boolean(payLiq && partyLiq && isRoznamchaLiquidityAccount(payLiq) && isRoznamchaLiquidityAccount(partyLiq));
}

function partySideLabel(tx: TransactionRowLike): string {
  const party = tx.partyName?.trim();
  if (party) return party;
  const acc = leafAccountName(tx.partyAccountName, tx.partyAccountCode);
  if (acc) return acc;
  return tx.partyAccountName?.trim() || '—';
}

function paymentSideLabel(tx: TransactionRowLike): string {
  return leafAccountName(tx.paymentAccountName, tx.paymentAccountCode) || tx.paymentAccountName?.trim() || '—';
}

const IN_STYLES = {
  amountClass: 'text-emerald-400',
  badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35',
};

const OUT_STYLES = {
  amountClass: 'text-red-400',
  badgeClass: 'bg-red-500/20 text-red-300 border-red-500/35',
};

const TRANSFER_STYLES = {
  amountClass: 'text-indigo-400',
  badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/35',
};

/** Manual receipt/payment between two COA accounts (no contact party). */
export function isCoaAccountTransfer(tx: TransactionRowLike): boolean {
  if (!isLiquidityBackedPayment(tx.referenceType)) return false;
  if (tx.partyName?.trim()) return false;
  const pay = paymentSideLabel(tx);
  const party = partySideLabel(tx);
  return pay !== '—' && party !== '—';
}

function resolveLiquidityRowTitle(
  tx: TransactionRowLike,
  liquidityTitle: string,
  to: string,
): string {
  if (tx.partyName?.trim()) return tx.partyName.trim();
  if (isCoaAccountTransfer(tx)) return to;
  return liquidityTitle;
}

export function resolveTimelinePresentation(tx: TransactionRowLike): TimelinePresentation {
  const isReceived = tx.direction === 'received';
  const liquidityBacked = isLiquidityBackedPayment(tx.referenceType);
  const internalTransfer = liquidityBacked && isInternalLiquidityTransferRow(tx);

  if (liquidityBacked) {
    const liquidityTitle = paymentSideLabel(tx);
    const counterparty = partySideLabel(tx);
    if (internalTransfer) {
      const from = isReceived ? counterparty : liquidityTitle;
      const to = isReceived ? liquidityTitle : counterparty;
      return {
        variant: 'transfer',
        isReceived,
        title: resolveLiquidityRowTitle(tx, liquidityTitle, to),
        from,
        to,
        signPrefix: '↔',
        ...TRANSFER_STYLES,
      };
    }
    if (isReceived) {
      const from = counterparty;
      const to = liquidityTitle;
      return {
        variant: 'in',
        isReceived: true,
        title: resolveLiquidityRowTitle(tx, liquidityTitle, to),
        from,
        to,
        signPrefix: '+',
        ...IN_STYLES,
      };
    }
    const from = liquidityTitle;
    const to = counterparty;
    return {
      variant: 'out',
      isReceived: false,
      title: resolveLiquidityRowTitle(tx, liquidityTitle, to),
      from,
      to,
      signPrefix: '−',
      ...OUT_STYLES,
    };
  }

  const title =
    tx.partyName?.trim() ||
    leafAccountName(tx.partyAccountName, tx.partyAccountCode) ||
    leafAccountName(tx.paymentAccountName, tx.paymentAccountCode) ||
    tx.referenceType.replace(/_/g, ' ');
  const from = isReceived ? paymentSideLabel(tx) : partySideLabel(tx);
  const to = isReceived ? partySideLabel(tx) : paymentSideLabel(tx);
  return {
    variant: 'party',
    isReceived,
    title,
    from,
    to,
    signPrefix: isReceived ? '+' : '−',
    ...(isReceived ? IN_STYLES : OUT_STYLES),
  };
}

/** Web journal list: liquidity-aware amount/badge when linked payment is manual receipt/payment. */
export function resolveJournalLiquidityPresentation(input: JournalLiquidityPresentationInput): {
  amountClass: string;
  badgeClass: string;
  typeLabel: string;
} | null {
  const linkedRt = String(input.linkedPaymentReferenceType || '').toLowerCase();
  const refRt = String(input.referenceType || '').toLowerCase();
  const payType = String(input.paymentType || '').toLowerCase();
  const liquidityRt = isLiquidityBackedPayment(linkedRt) ? linkedRt : isLiquidityBackedPayment(refRt) ? refRt : '';
  if (!liquidityRt && refRt !== 'journal' && refRt !== 'general' && refRt !== 'transfer') return null;

  const tx: TransactionRowLike = {
    direction: payType === 'paid' || liquidityRt === 'manual_payment' ? 'paid' : 'received',
    referenceType: liquidityRt || refRt,
    paymentAccountName: input.paymentAccountName,
    paymentAccountCode: input.paymentAccountCode,
    paymentAccountType: input.paymentAccountType,
    partyAccountName: input.counterpartyAccountName,
    partyAccountCode: input.counterpartyAccountCode,
    partyAccountType: input.counterpartyAccountType,
    isInternalLiquidityTransfer: input.isInternalLiquidityTransfer,
  };

  if (!isLiquidityBackedPayment(tx.referenceType)) {
    if (refRt === 'transfer') {
      return { typeLabel: 'Transfer', ...TRANSFER_STYLES };
    }
    return null;
  }

  const pres = resolveTimelinePresentation(tx);
  const typeLabel =
    pres.variant === 'transfer'
      ? 'Internal transfer'
      : pres.variant === 'in'
        ? 'Liquidity in'
        : 'Liquidity out';
  return { amountClass: pres.amountClass, badgeClass: pres.badgeClass, typeLabel };
}
