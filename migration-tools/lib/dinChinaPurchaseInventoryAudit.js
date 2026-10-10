import { num, roundMoney, withinTolerance, sumGlLines } from './dinChinaFinancialAuditShared.js';
import { dinChinaUuid } from './dinChinaLegacyMap.js';

const UPDATED_CSV_PURCHASE_TOTAL = 67514347.4;

export async function auditPurchaseInventoryGl(supabase, ctx) {
  const { companyId, accounts } = ctx;
  const invAccountId = accounts.inventory.account?.id;
  const apAccountId = accounts.ap.account?.id;

  const { data: purchases } = await supabase
    .from('purchases')
    .select('id, po_no, total, paid_amount, due_amount, status, notes')
    .eq('company_id', companyId);

  const legacyPurchases = (purchases || []).filter((p) =>
    String(p.notes || '').includes('legacy_din_china'),
  );
  const purchase = legacyPurchases[0] || null;
  const erpPurchaseTotal = roundMoney(purchase ? num(purchase.total) : 0);

  const csvRows = ctx.csvBundle?.data?.purchases?.rows || [];
  const latestCsvTotal = roundMoney(
    csvRows.reduce((s, r) => s + num(r.final_total), 0),
  );
  const updatedCsvTotal = UPDATED_CSV_PURCHASE_TOTAL;

  const { data: items } = purchase
    ? await supabase
        .from('purchase_items')
        .select('quantity, unit_price, total')
        .eq('purchase_id', purchase.id)
    : { data: [] };

  const purchaseItemsTotal = roundMoney(
    (items || []).reduce((s, i) => s + num(i.total || num(i.quantity) * num(i.unit_price)), 0),
  );

  const glInventoryDebit = await sumGlLines(supabase, companyId, invAccountId, 'debit');
  const glApCredit = await sumGlLines(supabase, companyId, apAccountId, 'credit');

  const { data: payments } = purchase
    ? await supabase
        .from('payments')
        .select('amount')
        .eq('company_id', companyId)
        .eq('reference_type', 'purchase')
        .eq('reference_id', purchase.id)
    : { data: [] };

  const paymentsTotal = roundMoney((payments || []).reduce((s, p) => s + num(p.amount), 0));
  const apRemainingDue = purchase ? roundMoney(num(purchase.due_amount)) : 0;

  const mismatchAmount = roundMoney(erpPurchaseTotal - updatedCsvTotal);
  const requiresUserApproval = Math.abs(mismatchAmount) > 0.02;

  return {
    erpPurchaseTotal,
    latestCsvTotal,
    updatedCsvTotal,
    purchaseItemsTotal,
    glInventoryDebit,
    glApCredit,
    paymentsTotal,
    apRemainingDue,
    mismatchAmount,
    requiresUserApproval,
    purchaseDetail: purchase
      ? {
          id: purchase.id,
          poNo: purchase.po_no,
          total: erpPurchaseTotal,
          status: purchase.status,
        }
      : null,
    proposedRepairStrategy: requiresUserApproval
      ? {
          phase: 3,
          note: 'Manual approval required — adjust purchase header total via approved migration only',
          erpTotal: erpPurchaseTotal,
          targetTotal: updatedCsvTotal,
          delta: mismatchAmount,
        }
      : null,
  };
}

export async function findLegacyPurchaseId(supabase, companyId, legacyTxnId) {
  return dinChinaUuid('transactions', legacyTxnId);
}
