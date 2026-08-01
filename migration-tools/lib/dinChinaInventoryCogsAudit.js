import {
  num,
  roundMoney,
  withinTolerance,
  DIN_CHINA_BRANCH_ID,
  loadLegacyFinalSales,
  sumGlLines,
} from './dinChinaFinancialAuditShared.js';
import { findActiveCanonicalSaleDocumentJournalEntryId } from './dinChinaSaleJournal.js';

export async function auditInventoryCogs(supabase, ctx) {
  const { companyId, accounts } = ctx;
  const cogsAccountId = accounts.cogs.account?.id;
  const invAccountId = accounts.inventory.account?.id;

  const sales = await loadLegacyFinalSales(supabase, companyId);
  const saleIds = sales.map((s) => s.id);

  const { data: saleItems } = await supabase
    .from('sales_items')
    .select('id, sale_id, product_id, variation_id, quantity, unit_price')
    .in('sale_id', saleIds.length ? saleIds : ['00000000-0000-4000-8000-000000000001']);

  const { data: products } = await supabase
    .from('products')
    .select('id, sku, name, cost_price')
    .eq('company_id', companyId);

  const productMap = new Map((products || []).map((p) => [p.id, p]));

  const { data: movements } = await supabase
    .from('stock_movements')
    .select('reference_id, product_id, variation_id, quantity, unit_cost, total_cost, movement_type, reference_type')
    .eq('company_id', companyId)
    .eq('reference_type', 'sale');

  const purchaseInventoryGlDebit = await sumGlLines(
    supabase,
    companyId,
    invAccountId,
    'debit',
  );
  const actualCogsPosted = await sumGlLines(supabase, companyId, cogsAccountId, 'debit');
  const actualInventoryCreditFromSales = await sumGlCreditOnSaleJes(
    supabase,
    companyId,
    invAccountId,
  );

  const { data: purchMovements } = await supabase
    .from('stock_movements')
    .select('quantity, total_cost')
    .eq('company_id', companyId)
    .eq('reference_type', 'purchase');

  let stockInQty = 0;
  let stockInValue = 0;
  for (const m of purchMovements || []) {
    stockInQty += num(m.quantity);
    stockInValue += num(m.total_cost);
  }

  let saleStockOutQty = 0;
  let saleItemQtyTotal = 0;
  const missingCostProducts = [];
  const proposedCogsRepairs = [];
  const examples = [];
  let missingStockOutCount = 0;
  let stockQtyMismatchCount = 0;
  let expectedCogsTotal = 0;

  for (const sale of sales) {
    if (String(sale.branch_id) !== DIN_CHINA_BRANCH_ID) continue;
    const items = (saleItems || []).filter((i) => i.sale_id === sale.id);
    let saleExpectedCogs = 0;

    for (const item of items) {
      const qty = num(item.quantity);
      if (qty <= 0) continue;
      saleItemQtyTotal += qty;

      const prod = productMap.get(item.product_id);
      const cost = num(prod?.cost_price);
      if (cost <= 0) {
        if (!missingCostProducts.find((p) => p.productId === item.product_id)) {
          missingCostProducts.push({
            productId: item.product_id,
            sku: prod?.sku,
            name: prod?.name,
          });
        }
        continue;
      }

      const lineCogs = roundMoney(cost * qty);
      saleExpectedCogs += lineCogs;

      const stockLines = (movements || []).filter(
        (m) =>
          m.reference_id === sale.id &&
          m.product_id === item.product_id &&
          variationKey(m.variation_id) === variationKey(item.variation_id),
      );
      const stockQty = stockLines.reduce((s, m) => s + num(m.quantity), 0);
      saleStockOutQty += Math.abs(stockQty);

      if (!stockLines.length) missingStockOutCount++;
      else if (!withinTolerance(stockQty, -qty)) stockQtyMismatchCount++;

      examples.push({
        saleId: sale.id,
        invoiceNo: sale.invoice_no,
        productId: item.product_id,
        qty,
        unitCost: cost,
        expectedCogs: lineCogs,
        stockQty,
      });
    }

    expectedCogsTotal += saleExpectedCogs;
    if (saleExpectedCogs > 0) {
      const jeId = await findActiveCanonicalSaleDocumentJournalEntryId(supabase, sale.id);
      const hasCogs = jeId
        ? await jeHasCogs(supabase, jeId, cogsAccountId, invAccountId)
        : false;
      if (!hasCogs) {
        proposedCogsRepairs.push({
          saleId: sale.id,
          invoiceNo: sale.invoice_no,
          expectedCogs: roundMoney(saleExpectedCogs),
        });
      }
    }
  }

  expectedCogsTotal = roundMoney(expectedCogsTotal);
  const cogsGap = roundMoney(expectedCogsTotal - actualCogsPosted);

  return {
    importStrategyNote:
      'Legacy import posted Dr AR / Cr 4100 only. Phase 2 adds Dr 5010 / Cr 1200 when product cost_price is set.',
    purchaseInventoryGlDebit,
    stockMovementInSummary: { qty: roundMoney(stockInQty), value: roundMoney(stockInValue) },
    saleStockOutQty: roundMoney(saleStockOutQty),
    saleItemQtyTotal: roundMoney(saleItemQtyTotal),
    expectedCogsTotal,
    actualCogsPosted,
    actualInventoryCreditFromSales,
    cogsGap,
    inventoryOverstatementEstimate: roundMoney(
      Math.max(0, actualInventoryCreditFromSales - expectedCogsTotal),
    ),
    missingStockOutCount,
    stockQtyMismatchCount,
    balanceSheetInventoryOverstated: cogsGap > 0.02,
    cogsAccount: accounts.cogs.account,
    inventoryAccount: accounts.inventory.account,
    missingCostProducts,
    proposedCogsRepairs,
    examples,
  };
}

function variationKey(v) {
  return v ? String(v) : '__null__';
}

async function sumGlCreditOnSaleJes(supabase, companyId, accountId) {
  if (!accountId) return 0;
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
    .eq('account_id', accountId)
    .in('journal_entry_id', jeIds);
  return roundMoney((lines || []).reduce((s, l) => s + num(l.credit), 0));
}

async function jeHasCogs(supabase, jeId, cogsAccountId, invAccountId) {
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('account_id, debit, credit')
    .eq('journal_entry_id', jeId);
  const hasCogs = (lines || []).some(
    (l) => l.account_id === cogsAccountId && num(l.debit) > 0,
  );
  const hasInv = (lines || []).some(
    (l) => l.account_id === invAccountId && num(l.credit) > 0,
  );
  return hasCogs && hasInv;
}
