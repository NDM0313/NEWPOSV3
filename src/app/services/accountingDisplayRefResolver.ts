/**
 * Batch-resolves journal rows to AccountingUiRef for Integrity Lab, Reconciliation Center, trace.
 */

import { supabase } from '@/lib/supabase';
import {
  type AccountingUiRef,
  buildTechnicalRef,
  formatJournalEntryBadge,
  getPurchaseDisplayNumber,
  getSaleDisplayNumber,
  sourceLabelFromReferenceType,
} from '@/app/lib/accountingDisplayReference';

const CHUNK = 80;

type JeMeta = {
  id: string;
  entry_no: string | null;
  reference_type: string | null;
  reference_id: string | null;
  payment_id: string | null;
};

async function fetchInChunks<T>(ids: string[], fetchChunk: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const rows = await fetchChunk(chunk);
    out.push(...rows);
  }
  return out;
}

function buildUiForJournal(
  j: JeMeta,
  ctx: {
    sales: Map<string, Record<string, unknown>>;
    purchases: Map<string, Record<string, unknown>>;
    stages: Map<string, { id: string; production_id?: string; stage_type?: string }>;
    productions: Map<string, { production_no?: string | null }>;
    workers: Map<string, { name?: string | null }>;
    payments: Map<string, { reference_number?: string | null; contact_id?: string | null }>;
    expenses: Map<string, { expense_no?: string | null; description?: string | null }>;
    contacts: Map<string, { name?: string | null }>;
  }
): AccountingUiRef {
  const technicalRef = buildTechnicalRef(j.reference_type, j.reference_id, j.id);
  const entryNoBadge = formatJournalEntryBadge(j.entry_no, j.id);
  const rt = (j.reference_type || '').toLowerCase().trim();
  const rid = (j.reference_id || '').trim();
  const baseLabel = sourceLabelFromReferenceType(j.reference_type);

  const unresolved = (): AccountingUiRef => ({
    displayRef: technicalRef,
    technicalRef,
    sourceLabel: baseLabel,
    entryNoBadge,
    documentResolved: false,
  });

  if (!rid) {
    return {
      displayRef: entryNoBadge,
      technicalRef,
      sourceLabel: baseLabel,
      entryNoBadge,
      documentResolved: false,
    };
  }

  if (rt === 'sale' || rt === 'sale_extra_expense') {
    const sale = ctx.sales.get(rid);
    if (sale) {
      const disp = getSaleDisplayNumber(sale as Parameters<typeof getSaleDisplayNumber>[0]);
      if (disp) {
        return {
          displayRef: disp,
          technicalRef,
          sourceLabel: rt === 'sale_extra_expense' ? 'Sale (extra)' : 'Sale',
          entryNoBadge,
          documentResolved: true,
        };
      }
    }
    return unresolved();
  }

  if (rt === 'purchase') {
    const pur = ctx.purchases.get(rid);
    if (pur) {
      const disp = getPurchaseDisplayNumber(pur as Parameters<typeof getPurchaseDisplayNumber>[0]);
      if (disp) {
        return {
          displayRef: disp,
          technicalRef,
          sourceLabel: 'Purchase',
          entryNoBadge,
          documentResolved: true,
        };
      }
    }
    return unresolved();
  }

  if (rt === 'studio_production_stage') {
    const stage = ctx.stages.get(rid);
    if (stage) {
      const prodId = stage.production_id;
      const prod = prodId ? ctx.productions.get(prodId) : undefined;
      const productionNo = String(prod?.production_no || '').trim();
      const stype = String(stage.stage_type || '').trim();
      const parts = [productionNo || `Stage ${stage.id.slice(0, 8)}`];
      if (stype) parts.push(stype);
      return {
        displayRef: parts.join(' · '),
        technicalRef,
        sourceLabel: 'Studio / Stage',
        entryNoBadge,
        documentResolved: Boolean(productionNo),
      };
    }
    return unresolved();
  }

  if (rt === 'worker_payment' || rt === 'worker_advance_settlement') {
    let payLabel = '';
    if (j.payment_id) {
      const pay = ctx.payments.get(j.payment_id);
      payLabel = String(pay?.reference_number || '').trim();
    }
    const wrk = ctx.workers.get(rid);
    const wname = String(wrk?.name || '').trim();
    const bits: string[] = [];
    if (payLabel) bits.push(payLabel);
    if (wname) bits.push(wname);
    const displayRef =
      bits.join(' · ') ||
      (rt === 'worker_advance_settlement' ? `Advance settlement · worker ${rid.slice(0, 8)}` : `Worker payment · ${rid.slice(0, 8)}`);
    return {
      displayRef,
      technicalRef,
      sourceLabel: 'Studio / Worker',
      entryNoBadge,
      documentResolved: Boolean(payLabel || wname),
    };
  }

  if (rt === 'payment_adjustment' || rt === 'payment') {
    const pay = ctx.payments.get(rid);
    const ref = String(pay?.reference_number || '').trim();
    if (ref) {
      return {
        displayRef: ref,
        technicalRef,
        sourceLabel: rt === 'payment_adjustment' ? 'Payment adjustment' : 'Payment',
        entryNoBadge,
        documentResolved: true,
      };
    }
    return unresolved();
  }

  if (rt === 'expense' || rt === 'extra_expense') {
    const ex = ctx.expenses.get(rid);
    const no = String(ex?.expense_no || '').trim();
    const desc = String(ex?.description || '').trim();
    const displayRef = no || desc.slice(0, 40) || `Expense ${rid.slice(0, 8)}`;
    return {
      displayRef,
      technicalRef,
      sourceLabel: 'Expense',
      entryNoBadge,
      documentResolved: Boolean(no),
    };
  }

  if (rt === 'manual_receipt') {
    const pay = j.payment_id ? ctx.payments.get(j.payment_id) : undefined;
    const ref = String(pay?.reference_number || '').trim();
    const cust = rid ? ctx.contacts.get(rid) : undefined;
    const cname = String(cust?.name || '').trim();
    const bits: string[] = [];
    if (ref) bits.push(ref);
    if (cname) bits.push(cname);
    const displayRef = bits.join(' · ') || ref || cname || entryNoBadge;
    return {
      displayRef,
      technicalRef,
      sourceLabel: 'Customer receipt',
      entryNoBadge,
      documentResolved: Boolean(ref || cname),
    };
  }

  if (rt === 'manual_payment') {
    const pay = j.payment_id ? ctx.payments.get(j.payment_id) : undefined;
    const ref = String(pay?.reference_number || '').trim();
    const cid = pay?.contact_id ? String(pay.contact_id).trim() : '';
    const sup = cid ? ctx.contacts.get(cid) : undefined;
    const sname = String(sup?.name || '').trim();
    const bits: string[] = [];
    if (ref) bits.push(ref);
    if (sname) bits.push(sname);
    const displayRef = bits.join(' · ') || ref || sname || entryNoBadge;
    return {
      displayRef,
      technicalRef,
      sourceLabel: 'Supplier payment',
      entryNoBadge,
      documentResolved: Boolean(ref || sname),
    };
  }

  return unresolved();
}

/**
 * Load journal metadata and resolve display strings. Reuses one resolution per journal id.
 */
export async function resolveJournalUiRefsByJournalIds(
  companyId: string,
  pairs: Array<{ key: string; journalEntryId: string | null | undefined }>
): Promise<Map<string, AccountingUiRef>> {
  const out = new Map<string, AccountingUiRef>();
  const validPairs = pairs.filter((p) => p.journalEntryId && String(p.journalEntryId).length > 10);
  if (!validPairs.length) return out;

  const jeIds = [...new Set(validPairs.map((p) => String(p.journalEntryId)))];
  const jeRows = await fetchInChunks(jeIds, async (chunk) => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id, entry_no, reference_type, reference_id, payment_id')
      .eq('company_id', companyId)
      .in('id', chunk);
    if (error) {
      console.warn('[accountingDisplayRefResolver] journal_entries:', error.message);
      return [];
    }
    return (data || []) as JeMeta[];
  });

  const jeById = new Map<string, JeMeta>();
  for (const j of jeRows) jeById.set(j.id, j);

  const saleIds = new Set<string>();
  const purchaseIds = new Set<string>();
  const stageIds = new Set<string>();
  const workerIds = new Set<string>();
  const paymentRefIds = new Set<string>();
  const expenseIds = new Set<string>();
  const paymentIdsFromJe = new Set<string>();
  const contactIdsForLabels = new Set<string>();

  for (const j of jeById.values()) {
    const rt = (j.reference_type || '').toLowerCase().trim();
    const rid = (j.reference_id || '').trim();
    if (j.payment_id) paymentIdsFromJe.add(j.payment_id);
    if (rt === 'manual_receipt' && rid) contactIdsForLabels.add(rid);
    if (!rid) continue;
    if (rt === 'sale' || rt === 'sale_extra_expense') saleIds.add(rid);
    else if (rt === 'purchase') purchaseIds.add(rid);
    else if (rt === 'studio_production_stage') stageIds.add(rid);
    else if (rt === 'worker_payment' || rt === 'worker_advance_settlement') workerIds.add(rid);
    else if (rt === 'payment_adjustment' || rt === 'payment') paymentRefIds.add(rid);
    else if (rt === 'expense' || rt === 'extra_expense') expenseIds.add(rid);
  }
  for (const pid of paymentIdsFromJe) paymentRefIds.add(pid);

  const sales = new Map<string, Record<string, unknown>>();
  if (saleIds.size) {
    const rows = await fetchInChunks([...saleIds], async (chunk) => {
      const { data } = await supabase
        .from('sales')
        .select('id, status, invoice_no, draft_no, quotation_no, order_no')
        .eq('company_id', companyId)
        .in('id', chunk);
      return (data || []) as Record<string, unknown>[];
    });
    for (const r of rows) sales.set(String((r as { id: string }).id), r);
  }

  const purchases = new Map<string, Record<string, unknown>>();
  if (purchaseIds.size) {
    const rows = await fetchInChunks([...purchaseIds], async (chunk) => {
      const { data } = await supabase
        .from('purchases')
        .select('id, status, po_no, draft_no, order_no')
        .eq('company_id', companyId)
        .in('id', chunk);
      return (data || []) as Record<string, unknown>[];
    });
    for (const r of rows) purchases.set(String((r as { id: string }).id), r);
  }

  const stages = new Map<string, { id: string; production_id?: string; stage_type?: string }>();
  const productionIds = new Set<string>();
  if (stageIds.size) {
    const { data } = await supabase
      .from('studio_production_stages')
      .select('id, production_id, stage_type')
      .in('id', [...stageIds]);
    for (const s of data || []) {
      const row = s as { id: string; production_id?: string; stage_type?: string };
      stages.set(row.id, row);
      if (row.production_id) productionIds.add(row.production_id);
    }
  }

  const productions = new Map<string, { production_no?: string | null }>();
  if (productionIds.size) {
    const rows = await fetchInChunks([...productionIds], async (chunk) => {
      const { data } = await supabase
        .from('studio_productions')
        .select('id, production_no')
        .eq('company_id', companyId)
        .in('id', chunk);
      return (data || []) as { id: string; production_no?: string | null }[];
    });
    for (const p of rows) productions.set(p.id, p);
  }

  const workers = new Map<string, { name?: string | null }>();
  if (workerIds.size) {
    const rows = await fetchInChunks([...workerIds], async (chunk) => {
      const { data } = await supabase.from('workers').select('id, name').eq('company_id', companyId).in('id', chunk);
      return (data || []) as { id: string; name?: string | null }[];
    });
    for (const w of rows) workers.set(w.id, w);
  }

  const payments = new Map<string, { reference_number?: string | null; contact_id?: string | null }>();
  if (paymentRefIds.size) {
    const rows = await fetchInChunks([...paymentRefIds], async (chunk) => {
      const { data } = await supabase
        .from('payments')
        .select('id, reference_number, contact_id')
        .eq('company_id', companyId)
        .in('id', chunk);
      return (data || []) as { id: string; reference_number?: string | null; contact_id?: string | null }[];
    });
    for (const p of rows) {
      payments.set(p.id, p);
      if (p.contact_id) contactIdsForLabels.add(p.contact_id);
    }
  }

  const expenses = new Map<string, { expense_no?: string | null; description?: string | null }>();
  if (expenseIds.size) {
    const rows = await fetchInChunks([...expenseIds], async (chunk) => {
      const { data } = await supabase
        .from('expenses')
        .select('id, expense_no, description')
        .eq('company_id', companyId)
        .in('id', chunk);
      return (data || []) as { id: string; expense_no?: string | null; description?: string | null }[];
    });
    for (const e of rows) expenses.set(e.id, e);
  }

  const contacts = new Map<string, { name?: string | null }>();
  if (contactIdsForLabels.size) {
    const rows = await fetchInChunks([...contactIdsForLabels], async (chunk) => {
      const { data } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('company_id', companyId)
        .in('id', chunk);
      return (data || []) as { id: string; name?: string | null }[];
    });
    for (const c of rows) contacts.set(c.id, c);
  }

  const ctx = { sales, purchases, stages, productions, workers, payments, expenses, contacts };

  const resolvedByJe = new Map<string, AccountingUiRef>();
  for (const jid of jeIds) {
    const j = jeById.get(jid);
    if (!j) {
      const technicalRef = `journal:${jid}`;
      resolvedByJe.set(jid, {
        displayRef: technicalRef,
        technicalRef,
        sourceLabel: 'Journal',
        entryNoBadge: formatJournalEntryBadge(null, jid),
        documentResolved: false,
      });
    } else {
      resolvedByJe.set(jid, buildUiForJournal(j, ctx));
    }
  }

  for (const p of validPairs) {
    const jid = String(p.journalEntryId);
    const ui = resolvedByJe.get(jid);
    if (ui) out.set(p.key, ui);
  }

  return out;
}

/** Search helpers: match display-style prefixes to source tables (company-scoped). */
export async function searchJournalIdsByDisplayRef(
  companyId: string,
  rawQuery: string,
  limitPerSource = 15
): Promise<string[]> {
  const q = rawQuery.trim();
  if (!q) return [];
  const ids = new Set<string>();

  const { data: payRows } = await supabase
    .from('payments')
    .select('id')
    .eq('company_id', companyId)
    .ilike('reference_number', `%${q}%`)
    .limit(limitPerSource);
  for (const r of payRows || []) {
    const { data: jrows } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('payment_id', (r as { id: string }).id)
      .limit(25);
    for (const j of jrows || []) ids.add((j as { id: string }).id);
  }

  const upper = q.toUpperCase();
  if (/^SL[-\s]/i.test(q) || (upper.startsWith('SL') && q.length >= 3)) {
    const { data } = await supabase
      .from('sales')
      .select('id')
      .eq('company_id', companyId)
      .or(`invoice_no.ilike.%${q}%,draft_no.ilike.%${q}%,quotation_no.ilike.%${q}%,order_no.ilike.%${q}%`)
      .limit(limitPerSource);
    for (const r of data || []) {
      const { data: jrows } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'sale')
        .eq('reference_id', (r as { id: string }).id)
        .limit(10);
      for (const j of jrows || []) ids.add((j as { id: string }).id);
    }
  }

  if (/^PUR[-\s]/i.test(q) || /^PO[-\s]/i.test(q) || (upper.startsWith('PUR') && q.length >= 3)) {
    const { data } = await supabase
      .from('purchases')
      .select('id')
      .eq('company_id', companyId)
      .or(`po_no.ilike.%${q}%,draft_no.ilike.%${q}%,order_no.ilike.%${q}%`)
      .limit(limitPerSource);
    for (const r of data || []) {
      const { data: jrows } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'purchase')
        .eq('reference_id', (r as { id: string }).id)
        .limit(10);
      for (const j of jrows || []) ids.add((j as { id: string }).id);
    }
  }

  if (/^STD[-\s]/i.test(q) || /^PRD[-\s]/i.test(q) || (upper.startsWith('PRD') && q.length >= 3)) {
    const { data: prods } = await supabase
      .from('studio_productions')
      .select('id')
      .eq('company_id', companyId)
      .ilike('production_no', `%${q}%`)
      .limit(limitPerSource);
    const prodIds = (prods || []).map((p: { id: string }) => p.id);
    if (prodIds.length) {
      const { data: stages } = await supabase.from('studio_production_stages').select('id').in('production_id', prodIds).limit(80);
      for (const s of stages || []) {
        const sid = (s as { id: string }).id;
        const { data: jrows } = await supabase
          .from('journal_entries')
          .select('id')
          .eq('company_id', companyId)
          .eq('reference_type', 'studio_production_stage')
          .eq('reference_id', sid)
          .limit(5);
        for (const j of jrows || []) ids.add((j as { id: string }).id);
      }
    }
  }

  if (/^EXP/i.test(upper) || /^EX[-\s]/i.test(q)) {
    const { data } = await supabase
      .from('expenses')
      .select('id')
      .eq('company_id', companyId)
      .ilike('expense_no', `%${q}%`)
      .limit(limitPerSource);
    for (const r of data || []) {
      const { data: jrows } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'expense')
        .eq('reference_id', (r as { id: string }).id)
        .limit(5);
      for (const j of jrows || []) ids.add((j as { id: string }).id);
    }
  }

  return [...ids];
}
