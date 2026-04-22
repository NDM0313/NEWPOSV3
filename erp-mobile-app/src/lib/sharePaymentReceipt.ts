/**
 * Share payment receipt via native share sheet (WhatsApp, SMS, email, etc.).
 * Falls back to opening whatsapp:// or a mailto: link when Web Share API is unavailable.
 */

export interface PaymentReceiptInput {
  /** e.g. "Payment Received", "Payment Made", "Rental Payment" */
  heading: string;
  /** Reference number (PMT-xxxx / JE-xxxx). */
  referenceNumber?: string | null;
  amount: number;
  currency?: string;
  /** Customer / supplier / worker name. */
  partyName?: string | null;
  /** Cash / bank / wallet account the money came from / went to. */
  fromAccountName?: string | null;
  /** AR / AP child account name ("Receivable — ABC"). */
  toAccountName?: string | null;
  /** Payment method label (Cash, Bank, Card, Wallet). */
  method?: string | null;
  /** ISO date + time. */
  dateTime?: string | Date | null;
  /** Optional notes. */
  notes?: string | null;
  /** Company header for the receipt. */
  companyName?: string | null;
  /** Branch name. */
  branchName?: string | null;
}

function formatAmount(n: number, currency = 'Rs.'): string {
  try {
    return `${currency} ${Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } catch {
    return `${currency} ${n}`;
  }
}

function formatDateTime(d: string | Date | null | undefined): string {
  const date = d ? new Date(d) : new Date();
  if (isNaN(date.getTime())) return '';
  try {
    return date.toLocaleString('en-PK', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return date.toISOString();
  }
}

export function buildPaymentReceiptText(input: PaymentReceiptInput): string {
  const lines: string[] = [];
  lines.push(`*${input.heading}*`);
  if (input.companyName) lines.push(input.companyName);
  if (input.branchName) lines.push(`Branch: ${input.branchName}`);
  lines.push('');
  if (input.partyName) lines.push(`Party: ${input.partyName}`);
  lines.push(`Amount: ${formatAmount(input.amount, input.currency)}`);
  if (input.referenceNumber) lines.push(`Ref: ${input.referenceNumber}`);
  if (input.method) lines.push(`Method: ${input.method}`);
  const dt = formatDateTime(input.dateTime);
  if (dt) lines.push(`Date: ${dt}`);
  if (input.fromAccountName || input.toAccountName) {
    const from = input.fromAccountName || '—';
    const to = input.toAccountName || '—';
    lines.push('');
    lines.push(`From: ${from}`);
    lines.push(`To:   ${to}`);
  }
  if (input.notes) {
    lines.push('');
    lines.push(`Notes: ${input.notes}`);
  }
  return lines.join('\n');
}

export type ShareResult = 'native' | 'whatsapp' | 'clipboard' | 'unsupported';

/**
 * Try native share (iOS/Android share sheet from Capacitor / WebView).
 * Fall back to WhatsApp deeplink, then clipboard.
 */
export async function sharePaymentReceipt(input: PaymentReceiptInput): Promise<ShareResult> {
  const text = buildPaymentReceiptText(input);
  const title = input.heading || 'Payment Receipt';

  const navAny = typeof navigator !== 'undefined' ? (navigator as unknown as {
    share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    clipboard?: { writeText?: (s: string) => Promise<void> };
  }) : undefined;

  if (navAny?.share) {
    try {
      await navAny.share({ title, text });
      return 'native';
    } catch (err) {
      const msg = String((err as { message?: string })?.message || '').toLowerCase();
      if (msg.includes('abort') || msg.includes('cancel')) {
        return 'native';
      }
    }
  }

  try {
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    if (typeof window !== 'undefined') {
      window.location.href = url;
      return 'whatsapp';
    }
  } catch {}

  try {
    if (navAny?.clipboard?.writeText) {
      await navAny.clipboard.writeText(text);
      return 'clipboard';
    }
  } catch {}

  return 'unsupported';
}
