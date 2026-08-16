/**
 * Fetch party GL lines with visibility metadata for effective variance adjustment (read-only).
 */

import { supabase } from '@/lib/supabase';
import { fetchInBatches } from '@/app/lib/chunkInQuery';
import type { PartyGlLineForVariance } from '@/app/lib/arApEffectiveVariance';

type RawLine = {
  debit?: number | null;
  credit?: number | null;
  journal_entry?: {
    reference_type?: string | null;
    action_fingerprint?: string | null;
    is_void?: boolean | null;
    payment_id?: string | null;
    reference_id?: string | null;
  } | null;
};

async function collectDescendantAccountIds(
  companyId: string,
  rootCode: string
): Promise<string[]> {
  const { data: rows } = await supabase
    .from('accounts')
    .select('id, parent_id, code')
    .eq('company_id', companyId)
    .eq('is_active', true);
  const list = (rows || []) as { id: string; parent_id?: string | null; code?: string }[];
  const root = list.find((a) => String(a.code || '').trim() === rootCode);
  if (!root) return [];

  const byParent = new Map<string, string[]>();
  list.forEach((a) => {
    const pid = a.parent_id ? String(a.parent_id) : '';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(a.id);
  });

  const out: string[] = [];
  const stack = [root.id];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    (byParent.get(id) || []).forEach((c) => stack.push(c));
  }
  return out;
}

function mapLineToVarianceInput(
  line: RawLine,
  saleStatusById: Map<string, string>,
  paymentMetaById: Map<string, { voidedAt: string | null; saleId: string | null }>
): PartyGlLineForVariance {
  const entry = line.journal_entry || {};
  const rt = String(entry.reference_type || '').toLowerCase().trim();
  const debit = Number(line.debit) || 0;
  const credit = Number(line.credit) || 0;

  let linkedSaleStatus: string | null = null;
  if (entry.reference_id && ['sale', 'sale_reversal', 'sale_return', 'gl_correction'].includes(rt)) {
    linkedSaleStatus = saleStatusById.get(String(entry.reference_id)) ?? null;
  }

  let paymentVoidedAt: string | null = null;
  const payId = entry.payment_id ? String(entry.payment_id) : null;
  if (payId) {
    const pm = paymentMetaById.get(payId);
    if (pm) {
      paymentVoidedAt = pm.voidedAt;
      if (!linkedSaleStatus && pm.saleId) {
        linkedSaleStatus = saleStatusById.get(pm.saleId) ?? null;
      }
    }
  }
  if (rt === 'payment' && entry.reference_id) {
    const pm = paymentMetaById.get(String(entry.reference_id));
    if (pm) {
      paymentVoidedAt = pm.voidedAt;
      if (!linkedSaleStatus && pm.saleId) {
        linkedSaleStatus = saleStatusById.get(pm.saleId) ?? null;
      }
    }
  }

  return {
    jeReferenceType: rt || null,
    jeActionFingerprint: (entry as { action_fingerprint?: string | null }).action_fingerprint ?? null,
    linkedSaleStatus,
    paymentVoidedAt,
    journalIsVoid: entry.is_void === true,
    netDrMinusCr: debit - credit,
  };
}

export async function fetchPartyGlLinesForEffectiveVariance(
  companyId: string,
  bucket: 'AR' | 'AP',
  asOfDate: string
): Promise<PartyGlLineForVariance[]> {
  const rootCode = bucket === 'AR' ? '1100' : '2000';
  const accountIds = await collectDescendantAccountIds(companyId, rootCode);
  if (!accountIds.length) return [];

  const lines = await fetchInBatches(accountIds, async (chunk) => {
    const { data, error } = await supabase
      .from('journal_entry_lines')
      .select(
        `
        debit,
        credit,
        journal_entry:journal_entries!inner(
          id,
          entry_date,
          reference_type,
          reference_id,
          payment_id,
          action_fingerprint,
          is_void,
          company_id
        )
      `
      )
      .in('account_id', chunk)
      .eq('journal_entries.company_id', companyId)
      .lte('journal_entries.entry_date', asOfDate);
    if (error) throw error;
    return (data || []) as RawLine[];
  });

  const activeLines = lines.filter((l) => l.journal_entry && l.journal_entry.is_void !== true);

  const saleIds = new Set<string>();
  const paymentIds = new Set<string>();
  activeLines.forEach((l) => {
    const e = l.journal_entry!;
    const rt = String(e.reference_type || '').toLowerCase();
    if (e.reference_id && ['sale', 'sale_reversal', 'sale_return', 'gl_correction'].includes(rt)) {
      saleIds.add(String(e.reference_id));
    }
    if (e.payment_id) paymentIds.add(String(e.payment_id));
    if (rt === 'payment' && e.reference_id) paymentIds.add(String(e.reference_id));
  });

  const saleStatusById = new Map<string, string>();
  if (saleIds.size) {
    const ids = [...saleIds];
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase
        .from('sales')
        .select('id, status')
        .eq('company_id', companyId)
        .in('id', ids.slice(i, i + 200));
      (data || []).forEach((s: { id: string; status?: string }) => {
        if (s?.id) saleStatusById.set(String(s.id), String(s.status || ''));
      });
    }
  }

  const paymentMetaById = new Map<string, { voidedAt: string | null; saleId: string | null }>();
  if (paymentIds.size) {
    const ids = [...paymentIds];
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase
        .from('payments')
        .select('id, voided_at, reference_type, reference_id')
        .eq('company_id', companyId)
        .in('id', ids.slice(i, i + 200));
      (data || []).forEach((p: { id: string; voided_at?: string | null; reference_type?: string; reference_id?: string }) => {
        const saleId =
          String(p.reference_type || '').toLowerCase() === 'sale' && p.reference_id
            ? String(p.reference_id)
            : null;
        paymentMetaById.set(String(p.id), {
          voidedAt: p.voided_at ?? null,
          saleId,
        });
      });
    }
  }

  return activeLines.map((l) => mapLineToVarianceInput(l, saleStatusById, paymentMetaById));
}
