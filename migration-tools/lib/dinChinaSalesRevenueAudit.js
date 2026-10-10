import {
  num,
  roundMoney,
  withinTolerance,
  DIN_CHINA_BRANCH_ID,
  loadLegacyFinalSales,
  sumGlLines,
} from './dinChinaFinancialAuditShared.js';
import { findActiveCanonicalSaleDocumentJournalEntryId } from './dinChinaSaleJournal.js';

export async function auditSalesRevenueGl(supabase, ctx) {
  const { companyId, accounts } = ctx;
  const revenueAccountId = accounts.revenue.account?.id;
  const arAccountId = accounts.ar.account?.id;

  const sales = await loadLegacyFinalSales(supabase, companyId);
  const csvRows = ctx.csvBundle?.data?.sales?.rows || [];

  let operationalSalesTotal = 0;
  let wrongBranchSalesCount = 0;
  const proposedRepairs = [];
  const examples = { missing: [], wrongAmount: [], duplicate: [] };
  const mismatchInvoices = [];
  let missingRevenueJeCount = 0;
  let duplicateJeCount = 0;
  let wrongAmountCount = 0;
  let wrongAccountsCount = 0;
  let okCount = 0;

  for (const sale of sales) {
    operationalSalesTotal += num(sale.total);
    if (String(sale.branch_id) !== DIN_CHINA_BRANCH_ID) {
      wrongBranchSalesCount++;
      continue;
    }

    const jeId = await findActiveCanonicalSaleDocumentJournalEntryId(supabase, sale.id);
    if (!jeId) {
      missingRevenueJeCount++;
      proposedRepairs.push({
        saleId: sale.id,
        invoiceNo: sale.invoice_no,
        total: num(sale.total),
        action: 'createImportSaleJournalEntry',
      });
      examples.missing.push({ invoiceNo: sale.invoice_no, total: sale.total });
      continue;
    }

    const { data: jes } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('reference_type', 'sale')
      .eq('reference_id', sale.id)
      .is('payment_id', null)
      .or('is_void.is.null,is_void.eq.false');
    if ((jes || []).length > 1) {
      duplicateJeCount++;
      examples.duplicate.push({ invoiceNo: sale.invoice_no, count: jes.length });
      continue;
    }

    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('account_id, debit, credit')
      .eq('journal_entry_id', jeId);

    const revLine = (lines || []).find(
      (l) => l.account_id === revenueAccountId && num(l.credit) > 0,
    );
    const arLine = (lines || []).find((l) => l.account_id === arAccountId && num(l.debit) > 0);

    const expectedTotal = roundMoney(num(sale.total) + num(sale.discount_amount));
    if (!revLine || !arLine) {
      wrongAccountsCount++;
      mismatchInvoices.push(sale.invoice_no);
      continue;
    }

    const arDebit = num(arLine.debit);
    const revCredit = num(revLine.credit);
    if (
      !withinTolerance(arDebit, sale.total) ||
      !withinTolerance(revCredit, expectedTotal)
    ) {
      wrongAmountCount++;
      mismatchInvoices.push(sale.invoice_no);
      examples.wrongAmount.push({
        invoiceNo: sale.invoice_no,
        saleTotal: sale.total,
        discount: sale.discount_amount,
        arDebit,
        revCredit,
      });
    } else {
      okCount++;
    }
  }

  const glRevenueFromSaleDocumentJes = await sumGlRevenueOnSaleJes(
    supabase,
    companyId,
    revenueAccountId,
  );
  const gl4100CreditAggregate = await sumGlLines(supabase, companyId, revenueAccountId, 'credit');

  return {
    revenueAccount: accounts.revenue.account,
    operationalSalesCount: sales.length,
    operationalSalesTotal: roundMoney(operationalSalesTotal),
    csvSalesCount: csvRows.length,
    csvSalesTotal: roundMoney(
      csvRows.reduce((s, r) => s + num(r.final_total), 0),
    ),
    glRevenueFromSaleDocumentJes,
    gl4100CreditAggregate,
    missingRevenueJeCount,
    duplicateJeCount,
    wrongAmountCount,
    wrongAccountsCount,
    wrongBranchSalesCount,
    okCount,
    mismatchInvoices,
    proposedRepairs,
    examples,
  };
}

async function sumGlRevenueOnSaleJes(supabase, companyId, revenueAccountId) {
  if (!revenueAccountId) return 0;
  const { data: jes } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_type', 'sale')
    .is('payment_id', null)
    .or('is_void.is.null,is_void.eq.false');
  const jeIds = (jes || []).map((j) => j.id);
  if (!jeIds.length) return 0;

  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('credit')
    .eq('account_id', revenueAccountId)
    .in('journal_entry_id', jeIds);

  return roundMoney((lines || []).reduce((s, l) => s + num(l.credit), 0));
}
