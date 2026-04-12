#!/usr/bin/env npx tsx
/**
 * Restore the latest voided sale return (or a specific return) to **final** — inverse of voidSaleReturn:
 * - DELETE stock_movements where movement_type = sale_return_void for this return
 * - SET is_void = true on active journal_entries where reference_type = correction_reversal
 *   and reference_id = each active sale_return JE id for this document
 * - UPDATE sale_returns status void → final
 * - recalc_sale_payment_totals when linked to a sale
 *
 * Does NOT remove original sale_return stock or original sale_return JEs.
 * Does NOT undo arbitrary manual journal reversals (only correction_reversal rows keyed to those document JEs).
 *
 * Usage:
 *   npx tsx scripts/admin/restore-last-voided-sale-return.ts --dry-run
 *   npx tsx scripts/admin/restore-last-voided-sale-return.ts --company <uuid> --apply
 *   npx tsx scripts/admin/restore-last-voided-sale-return.ts --return-id <uuid> --apply
 *
 * Env: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (see scripts/lib/adminSupabase.ts).
 */

import { createAdminSupabase, formatSupabaseAuthError } from '../lib/adminSupabase';
import type { SupabaseClient } from '@supabase/supabase-js';

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
    else if (a === '--return-id' && argv[i + 1]) returnId = argv[++i]!;
    else if (a === '--company' && argv[i + 1]) companyId = argv[++i]!;
  }
  if (!apply && !dryRun) dryRun = true;
  if (apply && dryRun) {
    console.error('Use either --apply or --dry-run, not both.');
    process.exit(1);
  }
  return { dryRun: !apply, apply, returnId, companyId };
}

async function restoreOne(sb: SupabaseClient, returnId: string, companyId: string, dryRun: boolean): Promise<void> {
  const { data: sr, error: sErr } = await sb
    .from('sale_returns')
    .select('id, status, return_no, original_sale_id')
    .eq('id', returnId)
    .eq('company_id', companyId)
    .single();
  if (sErr || !sr) {
    console.error('sale_return not found:', formatSupabaseAuthError(sErr));
    process.exit(1);
  }
  const st = String((sr as { status?: string }).status || '').toLowerCase();
  if (st === 'final') {
    console.log('Already final — nothing to do.', returnId);
    return;
  }
  if (st !== 'void') {
    console.error('Expected status void, got:', st);
    process.exit(1);
  }

  const refId = String(returnId);
  const { data: docJes } = await sb
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_type', 'sale_return')
    .eq('reference_id', refId)
    .or('is_void.is.null,is_void.eq.false');

  const jeIds = (docJes || []).map((r: { id: string }) => r.id);
  let revCount = 0;
  for (const origId of jeIds) {
    const { data: revs } = await sb
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_type', 'correction_reversal')
      .eq('reference_id', origId)
      .or('is_void.is.null,is_void.eq.false');
    revCount += (revs || []).length;
  }

  const { count: voidStockCount } = await sb
    .from('stock_movements')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('reference_type', 'sale_return')
    .eq('reference_id', refId)
    .eq('movement_type', 'sale_return_void');

  console.log('Target:', {
    return_id: returnId,
    return_no: (sr as { return_no?: string }).return_no,
    status: st,
    document_je_ids: jeIds,
    active_correction_reversal_rows_to_void: revCount,
    sale_return_void_stock_rows_to_delete: voidStockCount ?? 0,
  });

  if (dryRun) {
    console.log('[dry-run] No changes applied.');
    return;
  }

  for (const origId of jeIds) {
    const { data: revs } = await sb
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_type', 'correction_reversal')
      .eq('reference_id', origId)
      .or('is_void.is.null,is_void.eq.false');
    for (const rev of revs || []) {
      const { error: uErr } = await sb
        .from('journal_entries')
        .update({ is_void: true })
        .eq('id', (rev as { id: string }).id)
        .eq('company_id', companyId);
      if (uErr) console.warn('Void reversal JE failed', (rev as { id: string }).id, uErr.message);
    }
  }

  const { error: delErr } = await sb
    .from('stock_movements')
    .delete()
    .eq('company_id', companyId)
    .eq('reference_type', 'sale_return')
    .eq('reference_id', refId)
    .eq('movement_type', 'sale_return_void');
  if (delErr) {
    console.error('Delete sale_return_void stock failed:', delErr.message);
    process.exit(1);
  }

  const { data: claimed, error: claimErr } = await sb
    .from('sale_returns')
    .update({ status: 'final', updated_at: new Date().toISOString() })
    .eq('id', returnId)
    .eq('company_id', companyId)
    .eq('status', 'void')
    .select('id')
    .maybeSingle();
  if (claimErr || !claimed) {
    console.error('Claim void→final failed:', claimErr?.message || 'no row');
    process.exit(1);
  }

  const origSale = (sr as { original_sale_id?: string | null }).original_sale_id;
  if (origSale) {
    const { error: rpcErr } = await sb.rpc('recalc_sale_payment_totals', { p_sale_id: origSale });
    if (rpcErr) console.warn('recalc_sale_payment_totals:', rpcErr.message);
    else console.log('recalc_sale_payment_totals OK');
  }

  console.log('Done. Return is **final** again — you may void again from Sales if needed.');
}

async function main(): Promise<void> {
  const { dryRun, apply, returnId: argReturnId, companyId: argCompany } = parseArgs(process.argv);
  const sb = createAdminSupabase();

  let returnId = argReturnId;
  if (!returnId) {
    if (!argCompany) {
      console.error('Provide --return-id <uuid> or --company <uuid> for latest void return.');
      process.exit(1);
    }
    const { data, error } = await sb
      .from('sale_returns')
      .select('id')
      .eq('company_id', argCompany)
      .eq('status', 'void')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error(formatSupabaseAuthError(error));
      process.exit(1);
    }
    if (!data?.id) {
      console.error('No voided sale_returns for company', argCompany);
      process.exit(1);
    }
    returnId = data.id as string;
  }

  const { data: row } = await sb.from('sale_returns').select('company_id').eq('id', returnId).single();
  if (!row) {
    console.error('Return not found:', returnId);
    process.exit(1);
  }
  const companyId = (row as { company_id: string }).company_id;

  await restoreOne(sb, returnId, companyId, dryRun);
  if (!apply) process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
