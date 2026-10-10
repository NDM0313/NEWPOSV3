/**
 * V2-only: build rich WhatsApp message for a single ledger row.
 * Read-only document enrichment — does not affect official GL balance.
 */
import { shortenLedgerPaymentLabel } from '@/app/lib/ledgerStatementV2Enrichment';
import { supabase } from '@/lib/supabase';
import type { LedgerStatementV2Row } from '@/app/features/ledger-statement-center-v2/types';

function normalizeDocType(t: string): string {
  return String(t || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function fmtMoney(n: number, formatCurrency: (v: number) => string): string {
  const v = Number(n) || 0;
  return v !== 0 ? formatCurrency(v) : '—';
}

function fmtLine(label: string, value: string | undefined | null): string | null {
  const v = String(value || '').trim();
  if (!v || v === '—') return null;
  return `${label}: ${v}`;
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

async function enrichRentalBlock(rentalId: string): Promise<string[]> {
  const { data } = await supabase
    .from('rentals')
    .select('booking_no, total_amount, paid_amount, due_amount, customer:contacts(name), notes')
    .eq('id', rentalId)
    .maybeSingle();
  if (!data) return [];
  const cust = (data as { customer?: { name?: string } }).customer;
  return [
    fmtLine('Rental reference', (data as { booking_no?: string }).booking_no),
    fmtLine('Customer', cust?.name),
    fmtLine('Rental amount', String((data as { total_amount?: number }).total_amount ?? '')),
    fmtLine('Paid amount', String((data as { paid_amount?: number }).paid_amount ?? '')),
    fmtLine('Due amount', String((data as { due_amount?: number }).due_amount ?? '')),
    fmtLine('Notes', (data as { notes?: string }).notes),
  ].filter(Boolean) as string[];
}

async function enrichJournalBlock(journalEntryId: string): Promise<string[]> {
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit, account:accounts(name, code)')
    .eq('journal_entry_id', journalEntryId);
  if (!lines?.length) return [];
  const debits: string[] = [];
  const credits: string[] = [];
  for (const line of lines as { debit?: number; credit?: number; account?: { name?: string; code?: string } }[]) {
    const name = line.account?.name || line.account?.code || 'Account';
    if (Number(line.debit) > 0) debits.push(`${name} (${line.debit})`);
    if (Number(line.credit) > 0) credits.push(`${name} (${line.credit})`);
  }
  const out: string[] = [];
  if (debits.length) out.push(`Debit account(s): ${debits.join('; ')}`);
  if (credits.length) out.push(`Credit account(s): ${credits.join('; ')}`);
  return out;
}

export async function buildLedgerRowWhatsAppMessage(
  row: LedgerStatementV2Row,
  opts: {
    businessName: string;
    partyLabel: string;
    formatCurrency: (n: number) => string;
    formatDate: (iso: string) => string;
  },
): Promise<string> {
  const lines: string[] = [opts.businessName, '', 'Transaction Detail'];

  lines.push(fmtLine('Type', row.transactionType) || 'Type: —');
  lines.push(fmtLine('Ref', row.referenceNo) || 'Ref: —');
  lines.push(fmtLine('Date', row.date ? opts.formatDate(row.date) : '—') || 'Date: —');
  lines.push(fmtLine('Party/Account', opts.partyLabel) || 'Party/Account: —');

  if (row.debit > 0) lines.push(`Debit: ${fmtMoney(row.debit, opts.formatCurrency)}`);
  if (row.credit > 0) lines.push(`Credit: ${fmtMoney(row.credit, opts.formatCurrency)}`);
  lines.push(`Running balance: ${fmtMoney(row.runningBalance, opts.formatCurrency)}`);

  if (row.paymentMethod && row.paymentMethod !== '—') {
    lines.push(fmtLine('Payment method', shortenLedgerPaymentLabel(row.paymentMethod))!);
  }
  if (row.branch && row.branch !== '—') lines.push(fmtLine('Branch', row.branch)!);
  if (row.createdBy && row.createdBy !== '—') lines.push(fmtLine('Created by', row.createdBy)!);
  if (row.description?.trim()) lines.push(fmtLine('Description', row.description)!);

  const e = row.glEntry;
  const rt = normalizeDocType(e?.je_reference_type || e?.document_type || row.transactionType);

  let extra: string[] = [];
  if (e?.sale_id || rt.includes('sale')) {
    const sid = e?.sale_id;
    if (sid) extra = await enrichSaleBlock(sid);
  } else if (e?.payment_id || rt.includes('payment')) {
    const pid = e?.payment_id || row.paymentId;
    if (pid) extra = await enrichPaymentBlock(pid);
  } else if (e?.rental_id || rt.includes('rental')) {
    const rid = e?.rental_id;
    if (rid) extra = await enrichRentalBlock(rid);
  } else if (e?.journal_entry_id || rt.includes('journal') || rt.includes('reversal')) {
    const jeId = e?.journal_entry_id || row.journalEntryId;
    if (jeId) extra = await enrichJournalBlock(jeId);
  }

  if (extra.length) {
    lines.push('');
    lines.push(...extra);
  }

  lines.push('', 'Shared from Account Statements');
  return lines.join('\n');
}

export async function shareLedgerRowViaWhatsApp(
  row: LedgerStatementV2Row,
  opts: {
    businessName: string;
    partyLabel: string;
    formatCurrency: (n: number) => string;
    formatDate: (iso: string) => string;
    phone?: string | null;
  },
): Promise<void> {
  const { documentShareService } = await import('@/app/services/documentShareService');
  const message = await buildLedgerRowWhatsAppMessage(row, opts);
  documentShareService.shareViaWhatsApp(message, opts.phone);
}
