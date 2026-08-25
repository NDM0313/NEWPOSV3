/**
 * Receivables variance breakdown — server buckets explaining operational vs GL raw gap.
 */

import { safeBranchForFilter } from '@/app/services/arApReconciliationCenterService';
import { supabase } from '@/lib/supabase';

export type VarianceBreakdownBucket = {
  key: string;
  label: string;
  amount: number;
  lineCount: number;
  sampleJournalEntryIds: string[];
};

export type LinkedUnpostedSale = {
  saleId: string;
  invoiceNo: string;
  status: string | null;
  paidAmount: number;
  documentDate: string | null;
};

export type NegativeClampedContact = {
  contactId: string;
  contactName: string;
  signedAr: number;
  clampedLoss: number;
  linkedUnpostedSales: LinkedUnpostedSale[];
};

export type ReceivablesVarianceBreakdown = {
  ok: boolean;
  error?: string;
  asOfDate?: string;
  varianceTotal?: number;
  operationalClamped?: number;
  operationalSigned?: number;
  glArRaw?: number;
  buckets: VarianceBreakdownBucket[];
  negativeClampedContacts: NegativeClampedContact[];
};

export async function fetchReceivablesVarianceBreakdown(
  companyId: string,
  branchId: string | null | undefined,
  asOfDate?: string
): Promise<ReceivablesVarianceBreakdown> {
  const end = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const b = safeBranchForFilter(branchId);

  const { data, error } = await supabase.rpc('ar_ap_receivables_variance_breakdown', {
    p_company_id: companyId,
    p_branch_id: b,
    p_as_of_date: end,
  });

  if (error) {
    return { ok: false, error: error.message, buckets: [], negativeClampedContacts: [] };
  }

  const row = data as Record<string, unknown> | null;
  if (!row?.ok) {
    return {
      ok: false,
      error: String(row?.error || 'Variance breakdown unavailable'),
      buckets: [],
      negativeClampedContacts: [],
    };
  }

  const buckets = ((row.buckets as unknown[]) || []).map((b) => {
    const bucket = b as Record<string, unknown>;
    const sample = bucket.sampleJournalEntryIds;
    return {
      key: String(bucket.key || ''),
      label: String(bucket.label || ''),
      amount: Number(bucket.amount) || 0,
      lineCount: Number(bucket.lineCount) || 0,
      sampleJournalEntryIds: Array.isArray(sample) ? sample.map(String) : [],
    };
  });

  const negativeClampedContacts = ((row.negativeClampedContacts as unknown[]) || []).map((c) => {
    const contact = c as Record<string, unknown>;
    const linkedRaw = contact.linkedUnpostedSales;
    const linkedUnpostedSales = (Array.isArray(linkedRaw) ? linkedRaw : []).map((s) => {
      const sale = s as Record<string, unknown>;
      return {
        saleId: String(sale.saleId || ''),
        invoiceNo: String(sale.invoiceNo || ''),
        status: sale.status != null ? String(sale.status) : null,
        paidAmount: Number(sale.paidAmount) || 0,
        documentDate: sale.documentDate != null ? String(sale.documentDate) : null,
      };
    });
    return {
      contactId: String(contact.contactId || ''),
      contactName: String(contact.contactName || 'Contact'),
      signedAr: Number(contact.signedAr) || 0,
      clampedLoss: Number(contact.clampedLoss) || 0,
      linkedUnpostedSales,
    };
  });

  return {
    ok: true,
    asOfDate: String(row.asOfDate || end),
    varianceTotal: Number(row.varianceTotal) || 0,
    operationalClamped: Number(row.operationalClamped) || 0,
    operationalSigned: Number(row.operationalSigned) || 0,
    glArRaw: Number(row.glArRaw) || 0,
    buckets,
    negativeClampedContacts,
  };
}
