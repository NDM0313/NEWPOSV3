#!/usr/bin/env npx tsx
/**
 * Void the latest finalized sale return (or a specific return) using the same data effects as the app:
 * status → void, correction_reversal JEs for active sale_return postings, sale_return_void stock lines,
 * recalc_sale_payment_totals for the original sale when linked.
 *
 * Usage:
 *   npx tsx scripts/admin/void-last-sale-return.ts --dry-run
 *   npx tsx scripts/admin/void-last-sale-return.ts --company <uuid> --apply
 *   npx tsx scripts/admin/void-last-sale-return.ts --return-id <uuid> --apply
 *
 * Env: SUPABASE_URL (or VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY via .env.local (see scripts/lib/adminSupabase.ts).
 */

import { createAdminSupabase, formatSupabaseAuthError } from '../lib/adminSupabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type SaleReturnRow = {
  id: string;
  company_id: string;
  branch_id: string | null;
  original_sale_id: string | null;
  return_no: string | null;
  status: string;
  customer_id: string | null;
};

type ReturnItem = {
  product_id: string;
  variation_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  packing_details: Record<string, unknown> | null;
};

function parseArgs(argv: string[]): {
  dryRun: boolean;
  apply: boolean;
  returnId: string | null;
  companyId: string | null;
} {
  let dryRun = false;
  let apply = false;
  let returnId: string | null = null;
  let companyId: string | null = null;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') dryRun = true;
    else if (a === '--apply') apply = true;
    else if (a === '--return-id' && argv[i + 1]) {
      returnId = argv[++i]!;
    } else if (a === '--company' && argv[i + 1]) {
      companyId = argv[++i]!;
    }
  }
  if (!apply && !dryRun) dryRun = true;
  if (apply && dryRun) {
    console.error('Use either --apply or --dry-run, not both.');
    process.exit(1);
  }
  return { dryRun: !apply, apply, returnId, companyId };
}

async function hasStockLine(
  sb: SupabaseClient,
  companyId: string,
  returnId: string,
  movementType: string,
  productId: string,
  variationId: string | null | undefined
): Promise<boolean> {
  let q = sb
    .from('stock_movements')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_type', 'sale_return')
    .eq('reference_id', returnId)
    .eq('movement_type', movementType)
    .eq('product_id', productId)
    .limit(1);
  if (variationId) q = q.eq('variation_id', variationId);
  else q = q.is('variation_id', null);
  const { data } = await q.maybeSingle();
  return !!data;
}

async function findActiveReversalJeId(
  sb: SupabaseClient,
  companyId: string,
  originalJeId: string
): Promise<string | null> {
  const { data, error } = await sb
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_type', 'correction_reversal')
    .eq('reference_id', originalJeId)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

async function createMirrorReversal(
  sb: SupabaseClient,
  companyId: string,
  branchId: string | null,
  originalJeId: string,
  returnNo: string
): Promise<string | null> {
  const existing = await findActiveReversalJeId(sb, companyId, originalJeId);
  if (existing) return existing;

  const { data: original, error: oErr } = await sb
    .from('journal_entries')
    .select(
      `
      *,
      lines:journal_entry_lines(id, account_id, debit, credit, description)
    `
    )
    .eq('id', originalJeId)
    .single();
  if (oErr || !original) {
    console.warn('[void-last-sale-return] Could not load JE', originalJeId, oErr?.message);
    return null;
  }

  const pid = String((original as { payment_id?: string | null }).payment_id || '').trim();
  if (pid) {
    console.warn(
      '[void-last-sale-return] JE has payment_id set; multi-step chain reversal is not implemented in this script. Aborting GL reversal for:',
      originalJeId
    );
    return null;
  }

  const lines = (original as { lines?: Array<{ account_id: string; debit: number; credit: number; description?: string }> })
    .lines;
  if (!Array.isArray(lines) || lines.length === 0) return null;

  const entryNo = `JE-REV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const entryDate = new Date().toISOString().split('T')[0]!;
  const reason = `Void sale return ${returnNo}`;
  const totalDebit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.02) {
    console.warn('[void-last-sale-return] Reversal would be unbalanced; skip JE', originalJeId);
    return null;
  }

  const insertHeader: Record<string, unknown> = {
    company_id: companyId,
    entry_no: entryNo,
    entry_date: entryDate,
    description: `Reversal: ${reason}`,
    reference_type: 'correction_reversal',
    reference_id: originalJeId,
    created_by: null,
  };
  if (branchId && branchId !== 'all') insertHeader.branch_id = branchId;

  const { data: jeRow, error: jeIns } = await sb.from('journal_entries').insert(insertHeader).select('id').single();
  if (jeIns || !jeRow) {
    console.warn('[void-last-sale-return] reversal JE insert failed', jeIns?.message);
    return null;
  }
  const newJeId = (jeRow as { id: string }).id;

  const linesData = lines.map((line) => ({
    journal_entry_id: newJeId,
    account_id: line.account_id,
    debit: Number(line.credit) || 0,
    credit: Number(line.debit) || 0,
    description: line.description ? `Reversal: ${line.description}` : null,
  }));
  const { error: linesErr } = await sb.from('journal_entry_lines').insert(linesData);
  if (linesErr) {
    console.warn('[void-last-sale-return] reversal lines failed', linesErr.message);
    return null;
  }

  await sb
    .from('journal_entries')
    .update({ total_debit: totalDebit, total_credit: totalCredit })
    .eq('id', newJeId)
    .eq('company_id', companyId);

  return newJeId;
}

function voidPackingAdjustments(
  item: ReturnItem,
  originalItem: { quantity: number; packing_details?: unknown } | undefined
): { boxChange: number; pieceChange: number } {
  let boxChange = 0;
  let pieceChange = 0;
  if (originalItem && item.packing_details) {
    const originalPacking = item.packing_details as { total_boxes?: number; total_pieces?: number };
    const originalQty = Number(originalItem.quantity);
    const returnQty = Number(item.quantity);
    if (originalQty > 0) {
      const returnRatio = returnQty / originalQty;
      const originalBoxes = originalPacking.total_boxes || 0;
      const originalPieces = originalPacking.total_pieces || 0;
      boxChange = -Math.round(originalBoxes * returnRatio);
      pieceChange = -Math.round(originalPieces * returnRatio);
    }
  } else if (item.packing_details) {
    const packing = item.packing_details as { total_boxes?: number; total_pieces?: number };
    boxChange = -Math.round(Number(packing.total_boxes || 0));
    pieceChange = -Math.round(Number(packing.total_pieces || 0));
  }
  return { boxChange, pieceChange };
}

async function main() {
  const { dryRun, apply, returnId: argReturnId, companyId: argCompany } = parseArgs(process.argv);

  let sb: SupabaseClient;
  try {
    sb = createAdminSupabase();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  let saleReturn: SaleReturnRow | null = null;
  let items: ReturnItem[] = [];

  if (argReturnId) {
    const { data, error } = await sb
      .from('sale_returns')
      .select('id, company_id, branch_id, original_sale_id, return_no, status, customer_id, items:sale_return_items(*)')
      .eq('id', argReturnId)
      .maybeSingle();
    if (error) {
      console.error(formatSupabaseAuthError(error));
      process.exit(1);
    }
    if (!data) {
      console.error('No sale_return for --return-id', argReturnId);
      process.exit(1);
    }
    saleReturn = data as SaleReturnRow;
    items = ((data as { items?: ReturnItem[] }).items || []) as ReturnItem[];
  } else {
    if (!argCompany) {
      console.error('Provide --return-id <uuid> or --company <uuid> to pick the latest final return for that company.');
      process.exit(1);
    }
    const { data, error } = await sb
      .from('sale_returns')
      .select('id, company_id, branch_id, original_sale_id, return_no, status, customer_id, items:sale_return_items(*)')
      .eq('company_id', argCompany)
      .eq('status', 'final')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error(formatSupabaseAuthError(error));
      process.exit(1);
    }
    if (!data) {
      console.error('No final sale_returns for company', argCompany);
      process.exit(1);
    }
    saleReturn = data as SaleReturnRow;
    items = ((data as { items?: ReturnItem[] }).items || []) as ReturnItem[];
  }

  const st = String(saleReturn!.status || '').toLowerCase();
  console.log('Target:', {
    id: saleReturn!.id,
    return_no: saleReturn!.return_no,
    status: st,
    company_id: saleReturn!.company_id,
    original_sale_id: saleReturn!.original_sale_id,
    item_count: items.length,
  });

  if (st === 'void') {
    console.log('Already void — nothing to do.');
    process.exit(0);
  }
  if (st !== 'final') {
    console.error('Only finalized returns can be voided this way (draft: delete from UI).');
    process.exit(1);
  }

  if (dryRun) {
    console.log('[dry-run] Would: set status void, post correction_reversal for each active sale_return JE, insert sale_return_void stock, recalc_sale_payment_totals if linked sale.');
    process.exit(0);
  }

  const returnId = saleReturn!.id;
  const companyId = saleReturn!.company_id;
  const branchForJe =
    saleReturn!.branch_id && saleReturn!.branch_id !== 'all' ? saleReturn!.branch_id : null;
  const branchIdToUse = branchForJe;

  let originalItems: Array<{ product_id: string; variation_id: string | null; quantity: number; packing_details?: unknown }> =
    [];
  if (saleReturn!.original_sale_id) {
    const { data: si } = await sb
      .from('sales_items')
      .select('id, product_id, variation_id, quantity')
      .eq('sale_id', saleReturn!.original_sale_id);
    if (si?.length) {
      originalItems = si as typeof originalItems;
    } else {
      const { data: legacy } = await sb
        .from('sale_items')
        .select('id, product_id, variation_id, quantity, packing_details')
        .eq('sale_id', saleReturn!.original_sale_id);
      if (legacy) originalItems = legacy as typeof originalItems;
    }
  }

  const { data: claimed, error: claimErr } = await sb
    .from('sale_returns')
    .update({ status: 'void', updated_at: new Date().toISOString() })
    .eq('id', returnId)
    .eq('company_id', companyId)
    .eq('status', 'final')
    .select('id')
    .maybeSingle();

  if (claimErr) {
    console.error('Claim void failed:', claimErr.message);
    process.exit(1);
  }
  if (!claimed) {
    const { data: cur } = await sb.from('sale_returns').select('status').eq('id', returnId).maybeSingle();
    if (String((cur as { status?: string } | null)?.status).toLowerCase() === 'void') {
      console.log('Already void (race).');
      process.exit(0);
    }
    console.error('Could not claim final→void (concurrent update?).');
    process.exit(1);
  }

  const rollbackToFinal = async () => {
    await sb
      .from('sale_returns')
      .update({ status: 'final', updated_at: new Date().toISOString() })
      .eq('id', returnId)
      .eq('company_id', companyId)
      .eq('status', 'void');
  };

  try {
    const { data: docJes, error: jeListErr } = await sb
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_type', 'sale_return')
      .eq('reference_id', returnId)
      .or('is_void.is.null,is_void.eq.false');

    if (jeListErr) {
      console.warn('List sale_return JEs:', jeListErr.message);
    } else {
      const returnNo = saleReturn!.return_no || returnId;
      for (const row of docJes || []) {
        const jeId = (row as { id: string }).id;
        const revId = await createMirrorReversal(sb, companyId, branchForJe, jeId, returnNo);
        if (revId) console.log('Posted / had reversal for JE', jeId, '→', revId);
        else console.warn('No reversal created for JE', jeId);
      }
    }

    for (const item of items) {
      const originalItem = originalItems.find(
        (oi) =>
          oi.product_id === item.product_id &&
          (oi.variation_id === item.variation_id || (!oi.variation_id && !item.variation_id))
      );
      const { boxChange, pieceChange } = voidPackingAdjustments(item, originalItem);

      if (await hasStockLine(sb, companyId, returnId, 'sale_return_void', item.product_id, item.variation_id)) {
        console.log('Skip duplicate sale_return_void', item.product_id);
        continue;
      }

      const insertData: Record<string, unknown> = {
        company_id: companyId,
        branch_id: branchIdToUse,
        product_id: item.product_id,
        variation_id: item.variation_id || null,
        movement_type: 'sale_return_void',
        quantity: -Number(item.quantity),
        unit_cost: Number(item.unit_price),
        total_cost: Number(item.total),
        reference_type: 'sale_return',
        reference_id: returnId,
        notes: `Void Sale Return ${saleReturn!.return_no || returnId}: ${item.product_name}`,
        created_by: null,
      };
      if (boxChange !== 0) insertData.box_change = boxChange;
      if (pieceChange !== 0) insertData.piece_change = pieceChange;

      const { error: smErr } = await sb.from('stock_movements').insert(insertData);
      if (smErr) {
        throw new Error(`stock_movements insert: ${smErr.message}`);
      }
      console.log('Inserted sale_return_void stock for', item.product_id, 'qty', -Number(item.quantity));
    }

    if (saleReturn!.original_sale_id) {
      const { error: rpcErr } = await sb.rpc('recalc_sale_payment_totals', { p_sale_id: saleReturn!.original_sale_id });
      if (rpcErr) console.warn('recalc_sale_payment_totals:', rpcErr.message);
      else console.log('recalc_sale_payment_totals OK for sale', saleReturn!.original_sale_id);
    }

    console.log('Done. Return is void; create a new return in the app to re-test.');
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    await rollbackToFinal();
    console.error('Rolled sale_return status back to final.');
    process.exit(1);
  }
}

main();
