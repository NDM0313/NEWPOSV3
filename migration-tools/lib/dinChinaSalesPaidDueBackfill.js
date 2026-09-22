/**
 * Phase 4.5 — Backfill sales.paid_amount / due_amount from linked payment rows
 * where document fields drifted from payment truth (import legacy).
 */

import { num, roundMoney, DIN_CHINA_BRANCH_ID } from './dinChinaFinancialAuditShared.js';

export async function buildSalesPaidDueBackfillPlan(supabase, ctx, options = {}) {
  const { companyId } = ctx;
  const { customerId = null, dryRunOnly = true } = options;

  const { data: sales, error } = await supabase
    .from('sales')
    .select('id, invoice_no, customer_id, customer_name, total, paid_amount, due_amount, branch_id, status')
    .eq('company_id', companyId)
    .eq('status', 'final')
    .eq('branch_id', DIN_CHINA_BRANCH_ID);
  if (error) throw new Error(`sales load: ${error.message}`);

  const repairs = [];
  for (const sale of sales || []) {
    if (customerId && String(sale.customer_id) !== String(customerId)) continue;

    const { data: pays } = await supabase
      .from('payments')
      .select('amount')
      .eq('company_id', companyId)
      .eq('reference_type', 'sale')
      .eq('reference_id', sale.id)
      .is('voided_at', null);

    const paymentSum = roundMoney((pays || []).reduce((s, p) => s + num(p.amount), 0));
    const total = roundMoney(num(sale.total));
    const expectedDue = roundMoney(Math.max(0, total - paymentSum));
    const currentPaid = roundMoney(num(sale.paid_amount));
    const currentDue = roundMoney(num(sale.due_amount));

    // Only fix when linked payments exist — do not reopen invoices marked paid with no payment rows.
    if ((pays || []).length === 0) continue;

    if (Math.abs(currentPaid - paymentSum) < 0.02 && Math.abs(currentDue - expectedDue) < 0.02) {
      continue;
    }

    repairs.push({
      saleId: sale.id,
      invoiceNo: sale.invoice_no,
      customerName: sale.customer_name,
      total,
      paidBefore: currentPaid,
      dueBefore: currentDue,
      paidAfter: paymentSum,
      dueAfter: expectedDue,
      paymentCount: (pays || []).length,
    });
  }

  return {
    dryRunOnly,
    eligibleCount: repairs.length,
    repairs,
    strategyNote:
      'UPDATE sales SET paid_amount, due_amount from SUM(payments) for reference_type=sale. Does not change GL.',
  };
}

export async function applySalesPaidDueBackfill(supabase, plan) {
  const results = { updated: 0, skipped: 0, errors: [], rows: [] };

  for (const r of plan.repairs || []) {
    const { error } = await supabase
      .from('sales')
      .update({ paid_amount: r.paidAfter, due_amount: r.dueAfter })
      .eq('id', r.saleId);

    if (error) {
      results.errors.push(`${r.invoiceNo}: ${error.message}`);
      continue;
    }
    results.updated++;
    results.rows.push({ ...r, status: 'updated' });
  }

  results.ok = results.errors.length === 0;
  return results;
}
