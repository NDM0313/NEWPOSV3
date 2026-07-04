/**
 * Ledger & Statement Center V2 — read-only wrapper over canonical GL services
 * (same engine as Accounting → Account Statements).
 * Operational/document adapters are NOT used for official balance — see ledgerStatementCenterV2Diagnostic.ts.
 */
import { accountingService, type AccountLedgerEntry } from '@/app/services/accountingService';
import { customerLedgerAPI } from '@/app/services/customerLedgerApi';
import { contactService } from '@/app/services/contactService';
import { accountService } from '@/app/services/accountService';
import { studioService } from '@/app/services/studioService';
import { supabase } from '@/lib/supabase';
import { resolveLedgerTransactionOpenRef } from '@/app/lib/ledgerTransactionOpenRef';
import type {
  LedgerEntityOption,
  LedgerStatementV2Filters,
  LedgerStatementV2Result,
  LedgerStatementV2Row,
  LedgerStatementV2Summary,
  LedgerStatementV2Type,
  LedgerTransactionTypeFilter,
} from '@/app/features/ledger-statement-center-v2/types';

/** Matches AccountLedgerReportPage — party/account statements use all branches. */
export const STATEMENT_ALL_BRANCHES_SCOPE = undefined;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s?: string | null): boolean {
  return Boolean(s && UUID_RE.test(String(s).trim()));
}

function displaySettlementAccount(e: AccountLedgerEntry): string {
  const counter = String(e.counter_account || '').trim();
  const account = String(e.account_name || '').trim();
  if (counter && !isUuid(counter)) return counter;
  if (account && !isUuid(account)) return account;
  return '—';
}

async function resolveUserDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const nameByUserId = new Map<string, string>();
  const unique = [...new Set(userIds.filter(Boolean))] as string[];
  if (!unique.length) return nameByUserId;

  const { data: usersByAuth } = await supabase
    .from('users')
    .select('auth_user_id, full_name, email')
    .in('auth_user_id', unique.slice(0, 200));
  (usersByAuth || []).forEach((u: { auth_user_id?: string; full_name?: string; email?: string }) => {
    if (u?.auth_user_id) nameByUserId.set(u.auth_user_id, (u.full_name || u.email || '').trim());
  });

  const missing = unique.filter((id) => !nameByUserId.has(id));
  if (missing.length) {
    const { data: usersById } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', missing.slice(0, 200));
    (usersById || []).forEach((u: { id?: string; full_name?: string; email?: string }) => {
      if (u?.id) nameByUserId.set(u.id, (u.full_name || u.email || '').trim());
    });
  }
  return nameByUserId;
}

async function enrichCreatedByNames(rows: LedgerStatementV2Row[]): Promise<void> {
  const ids = [...new Set(rows.map((r) => r.createdBy).filter((v) => v && v !== '—' && isUuid(v)))] as string[];
  if (!ids.length) return;
  const names = await resolveUserDisplayNames(ids);
  rows.forEach((r) => {
    if (r.createdBy && isUuid(r.createdBy)) {
      const name = names.get(r.createdBy);
      r.createdBy = name || '—';
    }
  });
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normalizeDocType(t: string): string {
  return String(t || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function mapGlReferenceType(refType?: string | null): LedgerStatementV2Row['sourceKind'] {
  const r = normalizeDocType(refType || '');
  if (r.includes('party_discount')) return 'journal';
  if (r.includes('opening')) return 'opening';
  if (r.includes('sale_return') || (r.includes('return') && r.includes('sale'))) return 'return';
  if (r.includes('sale')) return 'sale';
  if (r.includes('purchase_return') || (r.includes('return') && r.includes('purchase'))) return 'return';
  if (r.includes('purchase')) return 'purchase';
  if (r.includes('rental')) return 'rental';
  if (r.includes('expense')) return 'expense';
  if (r.includes('payment')) return 'payment';
  return 'journal';
}

function matchesTransactionFilter(row: LedgerStatementV2Row, filter: LedgerTransactionTypeFilter): boolean {
  if (filter === 'all') return true;
  const k = row.sourceKind;
  const t = normalizeDocType(row.transactionType);
  switch (filter) {
    case 'sale':
      return k === 'sale';
    case 'purchase':
      return k === 'purchase';
    case 'payment_received':
      return k === 'payment' && row.credit > 0;
    case 'payment_paid':
      return k === 'payment' && row.debit > 0;
    case 'return':
      return k === 'return' || t.includes('return');
    case 'rental':
      return k === 'rental';
    case 'expense':
      return k === 'expense';
    case 'journal':
      return k === 'journal';
    case 'opening':
      return k === 'opening';
    case 'discount':
      return normalizeDocType(row.transactionType).includes('discount');
    default:
      return true;
  }
}

function matchesSearch(row: LedgerStatementV2Row, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.toLowerCase();
  const blob = [
    row.referenceNo,
    row.transactionType,
    row.description,
    row.paymentMethod,
    row.createdBy,
    row.branch,
    String(row.debit),
    String(row.credit),
  ]
    .join(' ')
    .toLowerCase();
  return blob.includes(s);
}

export function glToRows(entries: AccountLedgerEntry[]): LedgerStatementV2Row[] {
  return entries.map((e, idx) => {
    const refType = normalizeDocType(e.je_reference_type || e.document_type || '');
    const transactionType =
      refType.includes('party_discount')
        ? 'Discount'
        : String(e.document_type || e.je_reference_type || 'Journal Entry');
    return {
      id: e.journal_entry_id || `${e.date}-${e.reference_number}-${idx}`,
      date: e.date,
      referenceNo: String(e.reference_number || e.entry_no || e.journal_entry_id || '—'),
      transactionType,
      description: String(e.description || ''),
      branch: String(e.branch_name || '—'),
      debit: round2(Number(e.debit) || 0),
      credit: round2(Number(e.credit) || 0),
      runningBalance: round2(Number(e.running_balance) || 0),
      paymentMethod: displaySettlementAccount(e),
      createdBy: String(e.created_by || '—'),
      hasAttachments: false,
      sourceKind: mapGlReferenceType(e.je_reference_type || e.document_type),
      sourceId: e.sale_id || e.payment_id || e.rental_id || undefined,
      journalEntryId: e.journal_entry_id,
      paymentId: e.payment_id || undefined,
      glEntry: e,
    };
  });
}

export function applyLedgerV2DisplayFilters(
  rows: LedgerStatementV2Row[],
  transactionType: LedgerTransactionTypeFilter,
  search: string,
): LedgerStatementV2Row[] {
  return rows
    .filter((r) => matchesTransactionFilter(r, transactionType))
    .filter((r) => matchesSearch(r, search));
}

export function summarizeLedgerV2Rows(
  rows: LedgerStatementV2Row[],
  opening: number,
  type: LedgerStatementV2Type,
): LedgerStatementV2Summary {
  return summarizeFromRows(rows, opening, type);
}

export function deriveLedgerV2Opening(rows: LedgerStatementV2Row[]): number {
  if (!rows.length) return 0;
  return round2(rows[0].runningBalance - (rows[0].debit - rows[0].credit));
}

function deriveOpeningFromGlRows(rows: LedgerStatementV2Row[]): number {
  return deriveLedgerV2Opening(rows);
}

function summarizeFromRows(rows: LedgerStatementV2Row[], opening: number, type: LedgerStatementV2Type): LedgerStatementV2Summary {
  let totalDebit = 0;
  let totalCredit = 0;
  let totalSales = 0;
  let totalSalesReturn = 0;
  let totalPaymentsReceived = 0;
  let totalPurchases = 0;
  let totalPurchaseReturns = 0;
  let totalPaymentsPaid = 0;
  let totalRentalCharges = 0;
  let totalRentalPayments = 0;
  let totalWorkCharges = 0;
  let totalAdjustments = 0;

  for (const r of rows) {
    totalDebit += r.debit;
    totalCredit += r.credit;
    const tl = normalizeDocType(r.transactionType);
    if (type === 'customer') {
      if (r.sourceKind === 'sale' && !tl.includes('return')) totalSales += r.debit;
      if (r.sourceKind === 'return' && tl.includes('sale')) totalSalesReturn += r.credit;
      if (r.sourceKind === 'payment' || tl.includes('payment')) totalPaymentsReceived += r.credit;
      if (r.sourceKind === 'rental') {
        if (r.debit > 0) totalRentalCharges += r.debit;
        if (r.credit > 0) totalRentalPayments += r.credit;
      }
    }
    if (type === 'supplier') {
      if (r.sourceKind === 'purchase' && !tl.includes('return')) totalPurchases += r.credit;
      if (r.sourceKind === 'return') totalPurchaseReturns += r.debit;
      if (r.sourceKind === 'payment') totalPaymentsPaid += r.debit;
    }
    if (type === 'worker') {
      if (r.debit > 0 && r.sourceKind !== 'payment') totalWorkCharges += r.debit;
      if (r.sourceKind === 'payment') totalPaymentsPaid += r.credit;
      if (tl.includes('adjust')) totalAdjustments += Math.abs(r.debit - r.credit);
    }
  }

  const closing = rows.length ? rows[rows.length - 1].runningBalance : opening;
  return {
    openingBalance: round2(opening),
    closingBalance: round2(closing),
    totalDebit: round2(totalDebit),
    totalCredit: round2(totalCredit),
    totalSales: round2(totalSales),
    totalSalesReturn: round2(totalSalesReturn),
    totalPaymentsReceived: round2(totalPaymentsReceived),
    totalRentalCharges: round2(totalRentalCharges),
    totalRentalPayments: round2(totalRentalPayments),
    totalPurchases: round2(totalPurchases),
    totalPurchaseReturns: round2(totalPurchaseReturns),
    totalPaymentsPaid: round2(totalPaymentsPaid),
    totalWorkCharges: round2(totalWorkCharges),
    totalAdjustments: round2(totalAdjustments),
    netMovement: round2(totalDebit - totalCredit),
  };
}

async function loadGlEntries(
  companyId: string,
  statementType: LedgerStatementV2Type,
  entityId: string,
  fromDate: string,
  toDate: string,
  search: string,
): Promise<AccountLedgerEntry[]> {
  const branchScope = STATEMENT_ALL_BRANCHES_SCOPE;
  const searchTerm = search.trim() || undefined;

  if (statementType === 'customer') {
    return accountingService.getCustomerLedger(
      entityId,
      companyId,
      branchScope,
      fromDate,
      toDate,
      searchTerm,
    );
  }
  if (statementType === 'supplier') {
    return accountingService.getSupplierApGlJournalLedger(
      entityId,
      companyId,
      branchScope,
      fromDate,
      toDate,
    );
  }
  if (statementType === 'worker') {
    return accountingService.getWorkerPartyGlJournalLedger(
      entityId,
      companyId,
      branchScope,
      fromDate,
      toDate,
    );
  }
  return accountingService.getAccountLedger(
    entityId,
    companyId,
    fromDate,
    toDate,
    branchScope,
    searchTerm,
  );
}

async function enrichAttachmentFlags(rows: LedgerStatementV2Row[]): Promise<void> {
  const jeIds = [...new Set(rows.map((r) => r.journalEntryId).filter(Boolean))] as string[];
  const payIds = [...new Set(rows.map((r) => r.paymentId).filter(Boolean))] as string[];
  const saleIds = [...new Set(rows.map((r) => r.glEntry?.sale_id).filter(Boolean))] as string[];
  const rentalIds = [...new Set(rows.map((r) => r.glEntry?.rental_id).filter(Boolean))] as string[];

  const jeHas = new Set<string>();
  const payHas = new Set<string>();
  const saleHas = new Set<string>();
  const rentalHas = new Set<string>();
  const purchaseHas = new Set<string>();
  const jePurchaseRefById = new Map<string, string>();
  const slice200 = <T>(arr: T[]) => arr.slice(0, 200);

  if (jeIds.length) {
    const { data: jeRows } = await supabase
      .from('journal_entries')
      .select('id, attachments, reference_type, reference_id')
      .in('id', slice200(jeIds));
    (jeRows || []).forEach((r: { id: string; attachments?: unknown; reference_type?: string; reference_id?: string }) => {
      if (Array.isArray(r.attachments) && r.attachments.length > 0) jeHas.add(r.id);
      const rt = normalizeDocType(r.reference_type || '');
      if (rt.includes('purchase') && r.reference_id) {
        jePurchaseRefById.set(r.id, String(r.reference_id));
      }
    });
  }
  if (payIds.length) {
    const { data } = await supabase.from('payments').select('id, attachments').in('id', slice200(payIds));
    (data || []).forEach((r: { id: string; attachments?: unknown }) => {
      if (Array.isArray(r.attachments) && r.attachments.length > 0) payHas.add(r.id);
    });
  }
  if (saleIds.length) {
    const { data } = await supabase.from('sales').select('id, attachments').in('id', slice200(saleIds));
    (data || []).forEach((r: { id: string; attachments?: unknown }) => {
      const att = r.attachments;
      if ((Array.isArray(att) && att.length > 0) || (typeof att === 'string' && att.trim())) saleHas.add(r.id);
    });
  }
  if (rentalIds.length) {
    const { data } = await supabase.from('rentals').select('id, attachments').in('id', slice200(rentalIds));
    (data || []).forEach((r: { id: string; attachments?: unknown }) => {
      const att = r.attachments;
      if ((Array.isArray(att) && att.length > 0) || (typeof att === 'string' && att.trim())) rentalHas.add(r.id);
    });
  }
  const purchaseIds = [...new Set(jePurchaseRefById.values())];
  if (purchaseIds.length) {
    const { data } = await supabase.from('purchases').select('id, attachments').in('id', slice200(purchaseIds));
    (data || []).forEach((r: { id: string; attachments?: unknown }) => {
      const att = r.attachments;
      if ((Array.isArray(att) && att.length > 0) || (typeof att === 'string' && att.trim())) purchaseHas.add(r.id);
    });
  }

  rows.forEach((r) => {
    if (r.journalEntryId && jeHas.has(r.journalEntryId)) r.hasAttachments = true;
    if (r.paymentId && payHas.has(r.paymentId)) r.hasAttachments = true;
    if (!r.paymentId) {
      const sid = r.glEntry?.sale_id;
      if (sid && saleHas.has(sid)) r.hasAttachments = true;
      const rid = r.glEntry?.rental_id;
      if (rid && rentalHas.has(rid)) r.hasAttachments = true;
      if (r.journalEntryId) {
        const purchaseId = jePurchaseRefById.get(r.journalEntryId);
        if (purchaseId && purchaseHas.has(purchaseId)) r.hasAttachments = true;
      }
    }
  });
}

export async function listLedgerEntitiesV2(
  companyId: string,
  type: LedgerStatementV2Type,
): Promise<LedgerEntityOption[]> {
  if (type === 'customer') {
    const list = await customerLedgerAPI.getCustomers(companyId);
    return (list || []).map((c) => ({
      id: c.id,
      label: c.name || c.code || c.id,
      sublabel: c.code,
      phone: c.phone,
    }));
  }
  if (type === 'supplier') {
    const list = await contactService.getAllContacts(companyId, 'supplier');
    const both = await contactService.getAllContacts(companyId, 'both');
    const combined = [...(list || []), ...(both || [])].filter(
      (c, i, arr) => arr.findIndex((x) => x.id === c.id) === i,
    );
    return combined.map((c) => ({
      id: c.id!,
      label: (c as { name?: string }).name || 'Supplier',
      phone: (c as { phone?: string }).phone,
    }));
  }
  if (type === 'worker') {
    const list = await studioService.getAllWorkers(companyId);
    return ((list || []) as { id: string; name?: string; phone?: string }[]).map((w) => ({
      id: w.id,
      label: w.name || w.id,
      phone: w.phone,
    }));
  }
  const accounts = await accountService.getAllAccounts(companyId);
  return (accounts || [])
    .filter((a: { is_active?: boolean }) => a.is_active !== false)
    .map((a: { id: string; name?: string; code?: string; type?: string }) => ({
      id: a.id,
      label: `${String(a.code || '').trim()} — ${String(a.name || '').trim()}`.replace(/^—\s*/, ''),
      sublabel: a.type,
      code: a.code,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function getLedgerStatementV2(
  companyId: string,
  filters: LedgerStatementV2Filters,
  entityLabel: string,
): Promise<LedgerStatementV2Result> {
  const { statementType, entityId, fromDate, toDate, transactionType, search } = filters;
  if (!entityId) {
    return {
      entityLabel,
      basis: 'gl',
      rows: [],
      summary: {
        openingBalance: 0,
        closingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
      },
    };
  }

  const entries = await loadGlEntries(companyId, statementType, entityId, fromDate, toDate, '');
  let rows = glToRows(entries);
  const opening = deriveOpeningFromGlRows(rows);

  await enrichAttachmentFlags(rows);
  await enrichCreatedByNames(rows);

  const summary = summarizeFromRows(rows, opening, statementType);
  return { entityLabel, basis: 'gl', rows, summary };
}

/** Open the correct transaction detail for a V2 row (read-only drill-down). */
export function openLedgerRowDetailV2(row: LedgerStatementV2Row): void {
  if (typeof window === 'undefined') return;
  if (row.glEntry) {
    const ref = resolveLedgerTransactionOpenRef(row.glEntry);
    window.dispatchEvent(
      new CustomEvent('openTransactionDetail', {
        detail: {
          referenceNumber: ref.referenceNumber,
          journalEntryId: ref.journalEntryId,
          autoLaunchUnifiedEdit: false,
        },
      }),
    );
    return;
  }
  const refNo = row.referenceNo || row.id;
  if (refNo && refNo !== 'Opening Balance') {
    window.dispatchEvent(
      new CustomEvent('openTransactionDetail', {
        detail: { referenceNumber: refNo, autoLaunchUnifiedEdit: false },
      }),
    );
  }
}

function normalizeAttachments(raw: unknown): { url: string; name: string }[] {
  if (Array.isArray(raw)) {
    return raw.filter((a) => a && typeof a === 'object' && 'url' in a) as { url: string; name: string }[];
  }
  if (typeof raw === 'string' && raw.trim()) {
    return [{ url: raw.trim(), name: 'Attachment' }];
  }
  return [];
}

export async function getLedgerAttachmentsV2(
  row: LedgerStatementV2Row,
): Promise<{ url: string; name: string }[]> {
  if (row.journalEntryId) {
    const { data } = await supabase
      .from('journal_entries')
      .select('attachments')
      .eq('id', row.journalEntryId)
      .maybeSingle();
    const att = normalizeAttachments((data as { attachments?: unknown } | null)?.attachments);
    if (att.length) return att;
  }
  if (row.paymentId) {
    const { data } = await supabase.from('payments').select('attachments').eq('id', row.paymentId).maybeSingle();
    const att = normalizeAttachments((data as { attachments?: unknown } | null)?.attachments);
    if (att.length) return att;
    return [];
  }
  const e = row.glEntry;
  if (e?.sale_id) {
    const { data } = await supabase.from('sales').select('attachments').eq('id', e.sale_id).maybeSingle();
    const att = normalizeAttachments((data as { attachments?: unknown } | null)?.attachments);
    if (att.length) return att;
  }
  if (e?.rental_id) {
    const { data } = await supabase.from('rentals').select('attachments').eq('id', e.rental_id).maybeSingle();
    const att = normalizeAttachments((data as { attachments?: unknown } | null)?.attachments);
    if (att.length) return att;
  }
  if (e?.journal_entry_id) {
    const rt = normalizeDocType(e.je_reference_type || e.document_type || '');
    if (rt.includes('purchase')) {
      const { data: je } = await supabase
        .from('journal_entries')
        .select('reference_id')
        .eq('id', e.journal_entry_id)
        .maybeSingle();
      const refId = (je as { reference_id?: string } | null)?.reference_id;
      if (refId) {
        const { data } = await supabase.from('purchases').select('attachments').eq('id', refId).maybeSingle();
        const att = normalizeAttachments((data as { attachments?: unknown } | null)?.attachments);
        if (att.length) return att;
      }
    }
  }
  return [];
}
