import type { TransactionRow } from '../api/transactions';
import { isRoznamchaLiquidityAccount, type LiquidityAccountRef } from './liquidityPaymentAccount';

export type TimelinePresentationVariant = 'in' | 'out' | 'transfer' | 'party';

export interface TimelinePresentation {
  variant: TimelinePresentationVariant;
  isReceived: boolean;
  title: string;
  from: string;
  to: string;
  amountClass: string;
  pillClass: string;
  signPrefix: '+' | '−' | '↔';
}

export type TransactionRowLike = Pick<
  TransactionRow,
  | 'direction'
  | 'referenceType'
  | 'paymentAccountId'
  | 'paymentAccountName'
  | 'partyAccountId'
  | 'partyAccountName'
  | 'partyName'
  | 'notes'
  | 'expenseCategoryLabel'
> & {
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

function isExpenseReference(refType: string): boolean {
  const rt = refType.toLowerCase();
  return rt === 'expense' || rt === 'expense_payment';
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
  const payLiq = paymentLiquidityRef(tx);
  const partyLiq = partyLiquidityRef(tx);
  if (!payLiq || !partyLiq) return false;
  if (!isRoznamchaLiquidityAccount(payLiq) || !isRoznamchaLiquidityAccount(partyLiq)) return false;
  const rt = String(tx.referenceType || '').toLowerCase();
  return (
    isLiquidityBackedPayment(rt) || rt === 'transfer' || rt === 'general' || rt === 'journal'
  );
}

function partySideLabel(tx: TransactionRowLike): string {
  const party = tx.partyName?.trim();
  if (party) return party;
  const acc = leafAccountName(tx.partyAccountName, tx.partyAccountCode);
  if (acc) return acc;
  if (isExpenseReference(tx.referenceType) && tx.expenseCategoryLabel?.trim()) {
    return tx.expenseCategoryLabel.trim();
  }
  return tx.partyAccountName?.trim() || '—';
}

function paymentSideLabel(tx: TransactionRowLike): string {
  return leafAccountName(tx.paymentAccountName, tx.paymentAccountCode) || tx.paymentAccountName?.trim() || '—';
}

function partyPrimaryTitle(tx: TransactionRowLike): string {
  if (isExpenseReference(tx.referenceType)) {
    const cat = tx.expenseCategoryLabel?.trim();
    if (cat) return cat;
    const notes = tx.notes?.trim();
    if (notes && !isControlAccountDisplay(notes)) return notes;
  }
  const party = tx.partyName?.trim();
  if (party) return party;
  const partyAcc = leafAccountName(tx.partyAccountName, tx.partyAccountCode);
  if (partyAcc) return partyAcc;
  const payAcc = leafAccountName(tx.paymentAccountName, tx.paymentAccountCode);
  if (payAcc) return payAcc;
  const notes = tx.notes?.trim();
  if (notes) return notes;
  return tx.referenceType.replace(/_/g, ' ');
}

const IN_STYLES = {
  amountClass: 'text-[#10B981]',
  pillClass: 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30',
};

const OUT_STYLES = {
  amountClass: 'text-[#EF4444]',
  pillClass: 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/30',
};

const TRANSFER_STYLES = {
  amountClass: 'text-[#818CF8]',
  pillClass: 'bg-[#6366F1]/20 text-[#818CF8] border border-[#6366F1]/30',
};

export function usesLiquidityTimelinePresentation(tx: TransactionRowLike): boolean {
  if (isLiquidityBackedPayment(tx.referenceType)) return true;
  const rt = String(tx.referenceType || '').toLowerCase();
  if (rt !== 'transfer' && rt !== 'general' && rt !== 'journal') return false;
  const payRef = paymentLiquidityRef(tx);
  return Boolean(payRef && isRoznamchaLiquidityAccount(payRef));
}

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

/** Roznamcha-aligned timeline row presentation (liquidity IN/OUT/transfer). */
export function resolveTimelinePresentation(tx: TransactionRowLike): TimelinePresentation {
  const isReceived = tx.direction === 'received';
  const liquidityBacked = usesLiquidityTimelinePresentation(tx);
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

  const title = partyPrimaryTitle(tx);
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
