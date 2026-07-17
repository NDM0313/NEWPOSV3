/** Customer bill book / REF # merged into sale notes and payment descriptions. */

export const BILL_REF_NOTE_PREFIX = 'Bill/REF:';

/** Remove managed Bill/REF line(s) from free-form notes. */
export function stripCustomerBillRefLine(notes: string | null | undefined): string {
  return String(notes ?? '')
    .split('\n')
    .filter((line) => !line.trim().startsWith(BILL_REF_NOTE_PREFIX))
    .join('\n')
    .trim();
}

/** Idempotent merge: replace prior Bill/REF line, preserve user free text. */
export function mergeCustomerBillRefIntoNotes(
  billRef: string | null | undefined,
  existingNotes: string | null | undefined,
): string {
  const ref = String(billRef ?? '').trim();
  const userPart = stripCustomerBillRefLine(existingNotes);
  if (!ref) return userPart;
  const billLine = `${BILL_REF_NOTE_PREFIX} ${ref}`;
  return userPart ? `${billLine}\n${userPart}` : billLine;
}

export function buildCustomerSalePaymentAutoNotes(params: {
  partyName: string;
  invoiceRef?: string | null;
  customerBillRef?: string | null;
  /** Selected cash/bank account display name (e.g. FHD MZ). */
  paymentAccountName?: string | null;
  /** @deprecated Fallback when account name unavailable */
  paymentMethod?: string | null;
}): string {
  const party = String(params.partyName ?? '').trim() || 'Customer';
  const invoiceRef = String(params.invoiceRef ?? '').trim();
  const customerBillRef = String(params.customerBillRef ?? '').trim();
  const parts: string[] = [`Customer receipt from ${party}.`];
  if (invoiceRef) parts.push(`Invoice: ${invoiceRef}.`);
  if (customerBillRef) parts.push(`${BILL_REF_NOTE_PREFIX} ${customerBillRef}.`);
  const accountName = String(params.paymentAccountName ?? '').trim();
  if (accountName) {
    parts.push(`Account: ${accountName}.`);
  } else {
    const method = String(params.paymentMethod ?? '').trim();
    if (method) parts.push(`Method: ${method}.`);
  }
  return parts.join(' ').replace(/\s{2,}/g, ' ').trim();
}

/** Auto description + user add-on + optional bank trace (RPC notes field). */
export function composeSalePaymentNotes(params: {
  autoNotes: string;
  userNotes?: string | null;
  bankTraceId?: string | null;
  /** When false, omit auto sentence; keep add-on + bank trace. Default true. */
  includeAuto?: boolean;
}): string {
  const includeAuto = params.includeAuto !== false;
  const auto = includeAuto ? String(params.autoNotes ?? '').trim() : '';
  const user = String(params.userNotes ?? '').trim();
  const base = auto && user ? `${auto}\n\n${user}` : auto || user;
  const trace = String(params.bankTraceId ?? '').trim();
  if (trace) {
    return base ? `${base} | Bank Trace ID: ${trace}` : `Bank Trace ID: ${trace}`;
  }
  return base;
}

export const PAYMENT_AUTO_DESCRIPTION_STORAGE_KEY = 'erp.mobile.paymentAutoDescription';

export function readPaymentAutoDescriptionEnabled(): boolean {
  try {
    const raw = localStorage.getItem(PAYMENT_AUTO_DESCRIPTION_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== '0' && raw !== 'false';
  } catch {
    return true;
  }
}

export function writePaymentAutoDescriptionEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PAYMENT_AUTO_DESCRIPTION_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}

/** Recompose customer payment notes so Bill/REF auto block is always enforced on submit. */
export function composeCustomerPaymentNotesForRpc(params: {
  partyName: string;
  invoiceRef?: string | null;
  customerBillRef?: string | null;
  paymentAccountName?: string | null;
  paymentMethod?: string | null;
  combinedNotes?: string | null;
  bankTraceId?: string | null;
}): string {
  const auto = buildCustomerSalePaymentAutoNotes({
    partyName: params.partyName,
    invoiceRef: params.invoiceRef,
    customerBillRef: params.customerBillRef,
    paymentAccountName: params.paymentAccountName,
    paymentMethod: params.paymentMethod,
  });
  const combined = String(params.combinedNotes ?? '').trim();
  let userAddon = '';
  if (combined) {
    userAddon = combined.startsWith(auto)
      ? combined.slice(auto.length).trim().replace(/^\n\n?/, '')
      : combined;
  }
  return composeSalePaymentNotes({
    autoNotes: auto,
    userNotes: userAddon,
    bankTraceId: params.bankTraceId,
  });
}
