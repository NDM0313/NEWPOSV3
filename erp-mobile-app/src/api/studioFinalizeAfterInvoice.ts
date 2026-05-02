/**
 * Studio bill finalization from mobile (parity with web `studioProductionService.changeProductionStatus`).
 *
 * After mobile `upsertStudioInvoiceLine`, call `tryFinalizeStudioProductionAfterMobileInvoice` when all
 * stages are completed so worker costs backflush, sale becomes `final`, inventory moves, and the sale
 * document posts to GL via `record_sale_with_accounting` (same RPC family as other mobile documents).
 *
 * **Repair (stuck STD-* / bill on mobile but no COA):**
 * - On mobile: complete all stages (finalize runs on last stage complete) **or** save/update the invoice line again when all stages are already complete; **or**
 * - Web → Studio sale → **Final Complete** / same Product & invoice flow (requires invoice line linked).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createJournalEntry } from './accounts';
import { getNextDocumentNumber } from './documentNumber';

async function accountIdByCode(companyId: string, code: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/** Mirror web `resolveWorkerPayablePostingAccountId`: 2010 control or worker child under 2010. */
async function resolveWorkerPayableAccountId(
  companyId: string,
  workerContactId: string | null | undefined
): Promise<string | null> {
  const controlId = await accountIdByCode(companyId, '2010');
  if (!controlId) return null;
  if (!workerContactId) return controlId;
  const { data: child } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('linked_contact_id', workerContactId)
    .eq('parent_id', controlId)
    .eq('is_active', true)
    .maybeSingle();
  return (child as { id?: string } | null)?.id ?? controlId;
}

async function ensureWorkerLedgerRowForStage(params: {
  companyId: string;
  branchId: string | null;
  productionNo: string;
  stageId: string;
  workerId: string;
  amount: number;
}): Promise<void> {
  const { data: existing } = await supabase
    .from('worker_ledger_entries')
    .select('id')
    .eq('reference_type', 'studio_production_stage')
    .eq('reference_id', params.stageId)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  let documentNo: string | null = null;
  try {
    documentNo = await getNextDocumentNumber(params.companyId, params.branchId, 'job');
  } catch {
    /* optional */
  }

  const insertPayload: Record<string, unknown> = {
    company_id: params.companyId,
    worker_id: params.workerId,
    amount: params.amount,
    reference_type: 'studio_production_stage',
    reference_id: params.stageId,
    notes: `Studio production ${params.productionNo} – stage completed`,
    status: 'unpaid',
    ...(documentNo ? { document_no: documentNo } : {}),
  };
  const { error } = await supabase.from('worker_ledger_entries').insert(insertPayload);
  if (error) console.warn('[studioFinalizeAfterInvoice] worker_ledger insert:', error.message);
}

async function postPendingStageCosts(params: {
  companyId: string;
  branchId: string | null;
  productionId: string;
  productionNo: string;
  saleId: string | null;
}): Promise<void> {
  const { data: stageRows, error: stErr } = await supabase
    .from('studio_production_stages')
    .select('id, status, cost, assigned_worker_id, stage_type, journal_entry_id')
    .eq('production_id', params.productionId);
  if (stErr) throw stErr;

  const cost5000 = await accountIdByCode(params.companyId, '5000');
  if (!cost5000) {
    console.warn('[studioFinalizeAfterInvoice] Account 5000 not found; skipping stage JEs');
    return;
  }

  for (const s of (stageRows || []) as Array<Record<string, unknown>>) {
    if (String(s.status || '').toLowerCase() !== 'completed') continue;
    const cost = Number(s.cost) || 0;
    const workerId = s.assigned_worker_id as string | null;
    if (cost <= 0 || !workerId) continue;
    if (s.journal_entry_id) continue;

    const stageId = String(s.id);
    const stageType = String(s.stage_type || 'stage');
    const payableId = await resolveWorkerPayableAccountId(params.companyId, workerId);
    if (!payableId) {
      console.warn('[studioFinalizeAfterInvoice] No worker payable account for stage', stageId);
      continue;
    }

    const je = await createJournalEntry({
      companyId: params.companyId,
      branchId: params.branchId,
      entryDate: new Date().toISOString().slice(0, 10),
      description: `Studio production ${params.productionNo} – ${stageType} stage completed`,
      referenceType: 'studio_production_stage',
      referenceId: stageId,
      lines: [
        {
          accountId: cost5000,
          debit: cost,
          credit: 0,
          description: `Production cost – ${stageType}`,
        },
        {
          accountId: payableId,
          debit: 0,
          credit: cost,
          description: `Worker payable – ${stageType}`,
        },
      ],
    });
    if (je.error || !je.data?.id) {
      console.warn('[studioFinalizeAfterInvoice] Stage JE failed:', je.error);
      continue;
    }

    await supabase.from('studio_production_stages').update({ journal_entry_id: je.data.id }).eq('id', stageId);

    await ensureWorkerLedgerRowForStage({
      companyId: params.companyId,
      branchId: params.branchId,
      productionNo: params.productionNo,
      stageId,
      workerId,
      amount: cost,
    });
  }
}

async function ensureProductionStockMovement(params: {
  production: Record<string, unknown>;
  productionId: string;
  studioCharges: number;
}): Promise<void> {
  const existing = params.production as {
    company_id: string;
    branch_id: string | null;
    quantity?: number | null;
    generated_product_id?: string | null;
    product_id?: string | null;
    production_no?: string | null;
    actual_cost?: number | null;
  };
  const qty = Number(existing.quantity) || 0;
  if (qty <= 0) return;

  const productIdForStock = (existing.generated_product_id || existing.product_id) as string | null;
  if (!productIdForStock) return;

  const { data: existingMovement } = await supabase
    .from('stock_movements')
    .select('id')
    .eq('reference_type', 'studio_production')
    .eq('reference_id', params.productionId)
    .eq('movement_type', 'PRODUCTION_IN')
    .limit(1)
    .maybeSingle();
  if (existingMovement) return;

  const totalCost =
    Number(existing.actual_cost) || params.studioCharges || 0;

  const insertPayload: Record<string, unknown> = {
    company_id: existing.company_id,
    branch_id: existing.branch_id,
    product_id: productIdForStock,
    movement_type: 'PRODUCTION_IN',
    quantity: qty,
    unit_cost: qty > 0 ? totalCost / qty : 0,
    total_cost: totalCost,
    reference_type: 'studio_production',
    reference_id: params.productionId,
    notes: `Production ${existing.production_no ?? ''} completed`,
    created_by: null,
  };
  const { error: movErr } = await supabase.from('stock_movements').insert(insertPayload);
  if (movErr) console.warn('[studioFinalizeAfterInvoice] PRODUCTION_IN:', movErr.message);
}

async function hasActiveSaleDocumentJe(companyId: string, saleId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, is_void')
    .eq('company_id', companyId)
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId)
    .is('payment_id', null)
    .limit(12);
  if (error) return false;
  const rows = (data || []) as { is_void?: boolean | null }[];
  return rows.some((r) => r.is_void !== true);
}

export type StudioFinalizeResult =
  | { ok: true; skipped: string }
  | { ok: true; finalized: true; saleId: string }
  | { ok: false; error: string };

/**
 * When studio invoice exists (`generated_invoice_item_id`) and every stage is `completed`,
 * runs the same accounting pipeline as web Final Complete / Product & Invoice finalize.
 */
export async function tryFinalizeStudioProductionAfterMobileInvoice(params: {
  productionId: string;
}): Promise<StudioFinalizeResult> {
  if (!isSupabaseConfigured) return { ok: false, error: 'App not configured.' };

  const productionId = params.productionId;
  try {
    const { data: prodRow, error: prodErr } = await supabase
      .from('studio_productions')
      .select(
        'id, company_id, branch_id, sale_id, production_no, status, quantity, actual_cost, product_id, generated_product_id, generated_invoice_item_id'
      )
      .eq('id', productionId)
      .single();

    if (prodErr || !prodRow) return { ok: false, error: 'Production not found.' };

    const existing = prodRow as Record<string, unknown>;
    const saleId = existing.sale_id as string | null;
    if (!saleId) return { ok: true, skipped: 'no_sale_id' };

    if (!existing.generated_invoice_item_id) {
      return { ok: true, skipped: 'no_generated_invoice_item' };
    }

    const { data: stages, error: stErr } = await supabase
      .from('studio_production_stages')
      .select('id, status')
      .eq('production_id', productionId);
    if (stErr) return { ok: false, error: stErr.message };

    const stageList = (stages || []) as { status?: string }[];
    if (stageList.length === 0) return { ok: true, skipped: 'no_stages' };

    const allDone = stageList.every((s) => String(s.status || '').toLowerCase() === 'completed');
    if (!allDone) return { ok: true, skipped: 'stages_incomplete' };

    const companyId = existing.company_id as string;
    const branchId = (existing.branch_id as string | null) || null;

    const { data: saleRow } = await supabase
      .from('sales')
      .select('id, status, total, paid_amount, company_id, order_no, invoice_no')
      .eq('id', saleId)
      .maybeSingle();

    if (!saleRow) return { ok: false, error: 'Linked sale not found.' };

    const saleStatus = String((saleRow as { status?: string }).status || '').toLowerCase();
    const alreadyFinal = saleStatus === 'final';
    const docJe = await hasActiveSaleDocumentJe(companyId, saleId);
    const prodStatus = String(existing.status || '').toLowerCase();

    if (alreadyFinal && docJe && prodStatus === 'completed') {
      return { ok: true, skipped: 'already_finalized' };
    }

    await postPendingStageCosts({
      companyId,
      branchId,
      productionId,
      productionNo: String(existing.production_no || ''),
      saleId,
    });

    const { data: stagesFull } = await supabase
      .from('studio_production_stages')
      .select('id, assigned_worker_id, cost, status')
      .eq('production_id', productionId);

    let studioCharges = 0;
    for (const st of (stagesFull || []) as Array<{ status?: string; cost?: number }>) {
      if (String(st.status || '').toLowerCase() === 'completed') {
        studioCharges += Number(st.cost) || 0;
      }
    }

    for (const st of (stagesFull || []) as Array<{
      id: string;
      status?: string;
      assigned_worker_id?: string | null;
      cost?: number;
    }>) {
      if (String(st.status || '').toLowerCase() !== 'completed') continue;
      const amount = Number(st.cost) || 0;
      const workerId = st.assigned_worker_id;
      if (!workerId || amount <= 0) continue;

      const { data: existingLedger } = await supabase
        .from('worker_ledger_entries')
        .select('id')
        .eq('reference_type', 'studio_production_stage')
        .eq('reference_id', st.id)
        .limit(1)
        .maybeSingle();
      if (existingLedger) continue;

      await ensureWorkerLedgerRowForStage({
        companyId,
        branchId,
        productionNo: String(existing.production_no || ''),
        stageId: st.id,
        workerId,
        amount,
      });
    }

    await ensureProductionStockMovement({
      production: existing,
      productionId,
      studioCharges,
    });

    const saleData = saleRow as {
      total?: number;
      paid_amount?: number;
      invoice_no?: string | null;
      order_no?: string | null;
    };
    const currentTotal = Number(saleData.total) || 0;
    const paidAmount = Number(saleData.paid_amount) || 0;
    const hasGeneratedItem = true;
    const dueAmount = hasGeneratedItem
      ? Math.max(0, currentTotal - paidAmount)
      : Math.max(0, currentTotal + studioCharges - paidAmount);

    const saleUpdate: Record<string, unknown> = {
      studio_charges: studioCharges,
      due_amount: dueAmount,
      status: 'final',
      updated_at: new Date().toISOString(),
    };
    if (!saleData.invoice_no && saleData.order_no) {
      saleUpdate.invoice_no = saleData.order_no;
    }

    const { error: saleUpErr } = await supabase.from('sales').update(saleUpdate).eq('id', saleId);
    if (saleUpErr) return { ok: false, error: saleUpErr.message };

    const genProductId = existing.generated_product_id as string | null;
    if (genProductId && studioCharges > 0) {
      await supabase.from('products').update({ cost_price: studioCharges }).eq('id', genProductId);
    }

    const { data: rpcResult, error: rpcErr } = await supabase.rpc('record_sale_with_accounting', {
      p_sale_id: saleId,
    });

    if (rpcErr) {
      if (rpcErr.code === '42883' || String(rpcErr.message || '').includes('does not exist')) {
        console.warn('[studioFinalizeAfterInvoice] record_sale_with_accounting RPC missing:', rpcErr.message);
      } else {
        console.warn('[studioFinalizeAfterInvoice] record_sale_with_accounting:', rpcErr.message);
      }
    } else {
      const r = rpcResult as { success?: boolean; error?: string; skipped?: boolean } | null;
      if (r && r.success === false && r.error) {
        console.warn('[studioFinalizeAfterInvoice] record_sale_with_accounting returned:', r.error);
      }
    }

    const completedAt = new Date().toISOString();
    await supabase
      .from('studio_productions')
      .update({
        status: 'completed',
        completed_at: completedAt,
        updated_at: completedAt,
      })
      .eq('id', productionId);

    return { ok: true, finalized: true, saleId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
