import { supabase } from '../lib/supabase';
import type { LedgerLine } from '../api/reports';
import { formatReferenceTypeLabel } from './formatReferenceTypeLabel';

function fmtLine(label: string, value: string | undefined | null): string | null {
  const v = String(value || '').trim();
  if (!v || v === '—') return null;
  return `${label}: ${v}`;
}

function normalizeDocType(t: string): string {
  return String(t || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

async function enrichPaymentBlock(paymentId: string): Promise<string[]> {
  const { data } = await supabase
    .from('payments')
    .select(
      'reference_number, amount, payment_method, payment_date, notes, contact:contacts(name), payment_account:accounts(name)',
    )
    .eq('id', paymentId)
    .maybeSingle();
  if (!data) return [];
  const contact = (data as { contact?: { name?: string } }).contact;
  const account = (data as { payment_account?: { name?: string } }).payment_account;
  return [
    fmtLine('Receipt/payment number', (data as { reference_number?: string }).reference_number),
    fmtLine('Payment date', (data as { payment_date?: string }).payment_date),
    fmtLine('Amount', String((data as { amount?: number }).amount ?? '')),
    fmtLine('Payment method', (data as { payment_method?: string }).payment_method),
    fmtLine('Paid into / from account', account?.name),
    fmtLine('Related party', contact?.name),
    fmtLine('Notes', (data as { notes?: string }).notes),
  ].filter(Boolean) as string[];
}

async function enrichSaleBlock(saleId: string): Promise<string[]> {
  const { data } = await supabase
    .from('sales')
    .select('invoice_no, total, paid_amount, balance, sale_date, customer:contacts(name)')
    .eq('id', saleId)
    .maybeSingle();
  if (!data) return [];
  const cust = (data as { customer?: { name?: string } | { name?: string }[] }).customer;
  const customerName = Array.isArray(cust) ? cust[0]?.name : cust?.name;
  return [
    fmtLine('Sale number', (data as { invoice_no?: string }).invoice_no),
    fmtLine('Customer', customerName),
    fmtLine('Sale date', (data as { sale_date?: string }).sale_date),
    fmtLine('Total amount', String((data as { total?: number }).total ?? '')),
    fmtLine('Paid amount', String((data as { paid_amount?: number }).paid_amount ?? '')),
    fmtLine('Balance', String((data as { balance?: number }).balance ?? '')),
  ].filter(Boolean) as string[];
}

export async function buildLedgerRowShareMessage(
  line: LedgerLine,
  opts: {
    businessName: string;
    partyLabel: string;
    formatCurrency: (n: number) => string;
    formatDate: (iso: string) => string;
    displayReference: (entryNo: string, refType?: string) => string;
  },
): Promise<string> {
  const transactionType = line.transactionType ?? formatReferenceTypeLabel(line.referenceType);
  const refNo = opts.displayReference(line.entryNo, line.referenceType);
  const lines: string[] = [opts.businessName, '', 'Transaction Detail'];

  lines.push(fmtLine('Type', transactionType) || 'Type: —');
  lines.push(fmtLine('Ref', refNo) || 'Ref: —');
  lines.push(fmtLine('Date', line.date ? opts.formatDate(line.date) : '—') || 'Date: —');
  lines.push(fmtLine('Party/Account', opts.partyLabel) || 'Party/Account: —');

  if (line.debit > 0) lines.push(`Debit: ${opts.formatCurrency(line.debit)}`);
  if (line.credit > 0) lines.push(`Credit: ${opts.formatCurrency(line.credit)}`);
  lines.push(`Running balance: ${opts.formatCurrency(line.runningBalance)}`);

  if (line.paymentMethod && line.paymentMethod !== '—') {
    lines.push(fmtLine('Payment method', line.paymentMethod)!);
  }
  if (line.branch && line.branch !== '—') lines.push(fmtLine('Branch', line.branch)!);
  if (line.createdBy && line.createdBy !== '—') lines.push(fmtLine('Created by', line.createdBy)!);
  if (line.description?.trim()) lines.push(fmtLine('Description', line.description)!);

  const rt = normalizeDocType(line.referenceType);
  let extra: string[] = [];
  if (rt.includes('sale') && line.sourceReferenceId) {
    extra = await enrichSaleBlock(line.sourceReferenceId);
  } else if (rt.includes('payment') && (line.paymentId || line.sourceReferenceId)) {
    extra = await enrichPaymentBlock(line.paymentId || line.sourceReferenceId!);
  }

  if (extra.length) {
    lines.push('');
    lines.push(...extra);
  }

  lines.push('', 'Shared from mobile ERP');
  return lines.join('\n');
}
