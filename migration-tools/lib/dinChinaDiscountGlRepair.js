import {
  num,
  roundMoney,
  withinTolerance,
  loadLegacyFinalSales,
} from './dinChinaFinancialAuditShared.js';
import { findActiveCanonicalSaleDocumentJournalEntryId } from './dinChinaSaleJournal.js';

export async function buildDiscountGlRepairPlan(supabase, ctx) {
  const { companyId, accounts } = ctx;
  const revenueAccountId = accounts.revenue.account?.id;
  const discountAccount = accounts.discount.account;

  const sales = await loadLegacyFinalSales(supabase, companyId);
  const proposedRepairs = [];

  for (const sale of sales) {
    const discount = roundMoney(num(sale.discount_amount));
    if (discount <= 0) continue;

    const jeId = await findActiveCanonicalSaleDocumentJournalEntryId(supabase, sale.id);
    if (!jeId) {
      proposedRepairs.push({
        invoiceNo: sale.invoice_no,
        ok: false,
        error: 'no_document_je',
      });
      continue;
    }

    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('account_id, debit, credit')
      .eq('journal_entry_id', jeId);

    const revLine = (lines || []).find(
      (l) => l.account_id === revenueAccountId && num(l.credit) > 0,
    );
    const discLine = discountAccount
      ? (lines || []).find((l) => l.account_id === discountAccount.id && num(l.debit) > 0)
      : null;

    const expectedRev = roundMoney(num(sale.total) + discount);
    const already =
      discLine &&
      withinTolerance(num(discLine.debit), discount) &&
      revLine &&
      withinTolerance(num(revLine.credit), expectedRev);

    proposedRepairs.push({
      saleId: sale.id,
      invoiceNo: sale.invoice_no,
      discountAmount: discount,
      journalEntryId: jeId,
      alreadyComplete: already,
      ok: true,
    });
  }

  const pending = proposedRepairs.filter((r) => r.ok && !r.alreadyComplete);
  return {
    dryRunOnly: true,
    proposedRepairs,
    eligibleCount: pending.length,
    expectedDiscountTotal: roundMoney(
      pending.reduce((s, r) => s + num(r.discountAmount), 0),
    ),
    strategyNote:
      'Phase 7 amends document JE: Cr 4100 gross, Dr AR net, Dr 5200 discount. Phase 7.5 handles screenshot-only discounts.',
  };
}

export async function applyDiscountGlRepairs(supabase, ctx, plan) {
  return {
    ok: true,
    updated: 0,
    skipped: plan.proposedRepairs?.filter((r) => r.alreadyComplete).length ?? 0,
    errors: [],
    note: 'Use Phase 7.5 screenshot backfill for approved discount rows; Phase 7 skips already-complete JEs',
  };
}
