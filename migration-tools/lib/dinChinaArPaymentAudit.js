import {
  num,
  roundMoney,
  loadLegacyFinalSales,
  sumGlLines,
} from './dinChinaFinancialAuditShared.js';
import { buildArPaymentPartyReclassPlan } from './dinChinaArPaymentPartyReclass.js';

export async function auditArPayments(supabase, ctx) {
  const { companyId, accounts } = ctx;
  const arAccountId = accounts.ar.account?.id;

  const sales = await loadLegacyFinalSales(supabase, companyId);
  const salesTotal = roundMoney(sales.reduce((s, x) => s + num(x.total), 0));
  const paidTotal = roundMoney(sales.reduce((s, x) => s + num(x.paid_amount), 0));
  const expectedArOutstanding = roundMoney(sales.reduce((s, x) => s + num(x.due_amount), 0));
  const expectedArSalesMinusPayments = roundMoney(salesTotal - paidTotal);

  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount, reference_type, reference_id, payment_account_id')
    .eq('company_id', companyId)
    .eq('reference_type', 'sale');

  const paymentRecordsTotal = roundMoney(
    (payments || []).reduce((s, p) => s + num(p.amount), 0),
  );

  const glAccountsReceivableBalance = accounts.ar.account
    ? roundMoney(num(accounts.ar.account.balance))
    : await sumGlLines(supabase, companyId, arAccountId, 'debit');

  const arExpectedVsActualGap = roundMoney(
    expectedArOutstanding - glAccountsReceivableBalance,
  );

  const { data: paymentJes } = await supabase
    .from('journal_entries')
    .select('id, reference_id, payment_id')
    .eq('company_id', companyId)
    .not('payment_id', 'is', null);

  const paymentJeCount = (paymentJes || []).length;

  const phase4Plan = await buildArPaymentPartyReclassPlan(supabase, ctx);
  const paymentIssues = (phase4Plan.repairs || []).map((r) => ({
    kind: 'ar_credit_on_control_not_party',
    paymentRef: r.paymentRef,
    invoiceNo: r.invoiceNo,
    customerName: r.customerName,
    partyAccountCode: r.partyAccountCode,
    amount: r.amount,
    journalEntryNo: r.journalEntryNo,
    lineId: r.lineId,
  }));

  const customerRollups = new Map();

  for (const sale of sales) {
    const key = sale.invoice_no || sale.id;
    customerRollups.set(key, {
      invoiceNo: sale.invoice_no,
      total: num(sale.total),
      paid: num(sale.paid_amount),
      due: num(sale.due_amount),
    });
  }

  const partyGlGapCustomers = (phase4Plan.customerProjections || []).filter(
    (c) => Math.abs(c.gapBefore) > 0.02,
  );

  return {
    salesTotal,
    paidTotal,
    expectedArOutstanding,
    expectedArSalesMinusPayments,
    paymentRecordsTotal,
    glAccountsReceivableBalance,
    arExpectedVsActualGap,
    paymentJeCount,
    paymentIssues,
    phase4Plan,
    partyReclassEligible: phase4Plan.eligibleCount,
    partyReclassAmount: phase4Plan.totalReclassAmount,
    partyGlGapCustomerCount: partyGlGapCustomers.length,
    examples: {
      paymentIssues: paymentIssues.slice(0, 20),
      customers: [...customerRollups.values()].slice(0, 10),
      partyGlProjections: (phase4Plan.customerProjections || []).slice(0, 15),
    },
  };
}
