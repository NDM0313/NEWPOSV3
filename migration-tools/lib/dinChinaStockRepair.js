import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { SOURCE_SYSTEM } from './dinChinaLegacyMap.js';

function num(v) {
  return Number(v) || 0;
}

function withinTolerance(a, b, tol = 0.01) {
  return Math.abs(num(a) - num(b)) <= tol;
}

function normMovementType(t) {
  return String(t || '').trim().toLowerCase();
}

function variationKey(variationId) {
  return variationId ? String(variationId) : '__null__';
}

function lineKey(referenceType, referenceId, productId, variationId) {
  return `${referenceType}|${referenceId}|${productId}|${variationKey(variationId)}`;
}

async function loadLegacySales(supabase, companyId) {
  const { data, error } = await supabase
    .from('sales')
    .select('id, company_id, branch_id, invoice_no, status, cancelled_at, source, notes')
    .eq('company_id', companyId)
    .eq('status', 'final');
  if (error) throw new Error(`sales load: ${error.message}`);

  return (data || []).filter((s) => {
    if (s.cancelled_at) return false;
    if (String(s.source || '') === SOURCE_SYSTEM) return true;
    return String(s.notes || '').includes('legacy_din_china');
  });
}

async function loadLegacyPurchases(supabase, companyId) {
  const { data, error } = await supabase
    .from('purchases')
    .select('id, company_id, branch_id, po_no, status, cancelled_at, notes')
    .eq('company_id', companyId)
    .in('status', ['received', 'final']);
  if (error) throw new Error(`purchases load: ${error.message}`);

  return (data || []).filter((p) => {
    if (p.cancelled_at) return false;
    return String(p.notes || '').includes('legacy_din_china');
  });
}

async function loadSaleItems(supabase, saleIds) {
  if (!saleIds.length) return [];
  const { data, error } = await supabase
    .from('sales_items')
    .select('id, sale_id, product_id, variation_id, quantity, unit_price, product_name, sku')
    .in('sale_id', saleIds);
  if (error) throw new Error(`sales_items load: ${error.message}`);
  return data || [];
}

async function loadPurchaseItems(supabase, purchaseIds) {
  if (!purchaseIds.length) return [];
  const { data, error } = await supabase
    .from('purchase_items')
    .select('id, purchase_id, product_id, variation_id, quantity, unit_price, product_name, sku')
    .in('purchase_id', purchaseIds);
  if (error) throw new Error(`purchase_items load: ${error.message}`);
  return data || [];
}

async function loadStockMovements(supabase, companyId) {
  const { data, error } = await supabase
    .from('stock_movements')
    .select(
      'id, company_id, branch_id, product_id, variation_id, quantity, unit_cost, total_cost, movement_type, reference_type, reference_id, notes',
    )
    .eq('company_id', companyId)
    .in('reference_type', ['sale', 'purchase']);
  if (error) throw new Error(`stock_movements load: ${error.message}`);
  return data || [];
}

async function loadLegacyProductsForTrackStock(supabase, companyId, productIds = []) {
  const idSet = new Set(productIds.map(String));
  const { data, error } = await supabase
    .from('products')
    .select('id, sku, track_stock')
    .eq('company_id', companyId);
  if (error) throw new Error(`products load: ${error.message}`);
  return (data || []).filter((p) => {
    if (idSet.has(String(p.id))) return true;
    const sku = String(p.sku || '');
    return (
      sku.startsWith('DC-P') ||
      sku.startsWith('DC-V') ||
      sku.startsWith('CUSTOM-')
    );
  });
}

function findCoveringMovement(movements, refType, refId, productId, variationId, expectedQty) {
  const matches = movements.filter(
    (m) =>
      String(m.reference_type) === refType &&
      String(m.reference_id) === String(refId) &&
      String(m.product_id) === String(productId) &&
      variationKey(m.variation_id) === variationKey(variationId) &&
      withinTolerance(m.quantity, expectedQty),
  );
  return matches;
}

export async function buildStockRepairPlan(supabase, companyId) {
  const blockingErrors = [];
  const rowsToInsert = [];
  const rowsAlreadyCovered = [];
  const trackStockUpdates = [];

  const sales = await loadLegacySales(supabase, companyId);
  const purchases = await loadLegacyPurchases(supabase, companyId);
  const saleIds = sales.map((s) => s.id);
  const purchaseIds = purchases.map((p) => p.id);

  const saleItems = await loadSaleItems(supabase, saleIds);
  const purchaseItems = await loadPurchaseItems(supabase, purchaseIds);
  const movements = await loadStockMovements(supabase, companyId);
  const legacyProductIds = [
    ...saleItems.map((i) => i.product_id),
    ...purchaseItems.map((i) => i.product_id),
  ];
  const legacyProducts = await loadLegacyProductsForTrackStock(
    supabase,
    companyId,
    legacyProductIds,
  );

  for (const p of legacyProducts) {
    if (p.track_stock !== true) {
      trackStockUpdates.push({ productId: p.id, sku: p.sku, oldTrackStock: p.track_stock });
    }
  }

  const saleMap = new Map(sales.map((s) => [s.id, s]));
  const purchaseMap = new Map(purchases.map((p) => [p.id, p]));

  for (const sale of sales) {
    const items = saleItems.filter((i) => i.sale_id === sale.id);
    if (!items.length) {
      blockingErrors.push(`Sale ${sale.invoice_no || sale.id} has no sales_items lines`);
      continue;
    }
    for (const item of items) {
      const qty = num(item.quantity);
      if (qty <= 0) continue;
      const expectedQty = -qty;
      const unitPrice = num(item.unit_price);
      const covered = findCoveringMovement(
        movements,
        'sale',
        sale.id,
        item.product_id,
        item.variation_id,
        expectedQty,
      );
      if (covered.length > 1) {
        blockingErrors.push(
          `Ambiguous sale movements for sale ${sale.invoice_no} product ${item.product_id}`,
        );
        continue;
      }
      if (covered.length === 1) {
        rowsAlreadyCovered.push({
          kind: 'sale',
          saleId: sale.id,
          invoiceNo: sale.invoice_no,
          productId: item.product_id,
          variationId: item.variation_id,
          quantity: expectedQty,
          existingMovementId: covered[0].id,
        });
        continue;
      }
      rowsToInsert.push({
        id: randomUUID(),
        company_id: sale.company_id,
        branch_id: sale.branch_id,
        product_id: item.product_id,
        variation_id: item.variation_id ?? null,
        quantity: expectedQty,
        unit_cost: unitPrice,
        total_cost: unitPrice * qty,
        movement_type: 'SALE',
        reference_type: 'sale',
        reference_id: sale.id,
        notes: `Sale ${sale.invoice_no || sale.id} – final`,
        documentRef: sale.invoice_no || sale.id,
        lineItemId: item.id,
        kind: 'sale',
      });
    }
  }

  for (const purchase of purchases) {
    const items = purchaseItems.filter((i) => i.purchase_id === purchase.id);
    if (!items.length) {
      blockingErrors.push(`Purchase ${purchase.po_no || purchase.id} has no purchase_items lines`);
      continue;
    }
    for (const item of items) {
      const qty = num(item.quantity);
      if (qty <= 0) continue;
      const unitPrice = num(item.unit_price);
      const covered = findCoveringMovement(
        movements,
        'purchase',
        purchase.id,
        item.product_id,
        item.variation_id,
        qty,
      );
      if (covered.length > 1) {
        blockingErrors.push(
          `Ambiguous purchase movements for ${purchase.po_no} product ${item.product_id}`,
        );
        continue;
      }
      if (covered.length === 1) {
        rowsAlreadyCovered.push({
          kind: 'purchase',
          purchaseId: purchase.id,
          poNo: purchase.po_no,
          productId: item.product_id,
          variationId: item.variation_id,
          quantity: qty,
          existingMovementId: covered[0].id,
        });
        continue;
      }
      rowsToInsert.push({
        id: randomUUID(),
        company_id: purchase.company_id,
        branch_id: purchase.branch_id,
        product_id: item.product_id,
        variation_id: item.variation_id ?? null,
        quantity: qty,
        unit_cost: unitPrice,
        total_cost: unitPrice * qty,
        movement_type: 'purchase',
        reference_type: 'purchase',
        reference_id: purchase.id,
        notes: `Purchase ${purchase.po_no || purchase.id} – ${purchase.status}`,
        documentRef: purchase.po_no || purchase.id,
        lineItemId: item.id,
        kind: 'purchase',
      });
    }
  }

  const expectedSaleLines = saleItems.filter((i) => num(i.quantity) > 0).length;
  const expectedPurchaseLines = purchaseItems.filter((i) => num(i.quantity) > 0).length;
  const saleInsertCount = rowsToInsert.filter((r) => r.kind === 'sale').length;
  const purchaseInsertCount = rowsToInsert.filter((r) => r.kind === 'purchase').length;
  const saleCovered = rowsAlreadyCovered.filter((r) => r.kind === 'sale').length;
  const purchaseCovered = rowsAlreadyCovered.filter((r) => r.kind === 'purchase').length;

  return {
    companyId,
    generatedAt: new Date().toISOString(),
    blockingErrors,
    pass: blockingErrors.length === 0,
    summary: {
      legacySales: sales.length,
      legacyPurchases: purchases.length,
      expectedSaleLines,
      expectedPurchaseLines,
      saleLinesToInsert: saleInsertCount,
      purchaseLinesToInsert: purchaseInsertCount,
      saleLinesAlreadyCovered: saleCovered,
      purchaseLinesAlreadyCovered: purchaseCovered,
      trackStockProductsToUpdate: trackStockUpdates.length,
    },
    rowsToInsert,
    rowsAlreadyCovered,
    trackStockUpdates,
  };
}

export function writeStockRepairPreview(outputDir, plan) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, 'din_china_stock_repair_preview.json');
  const mdPath = path.join(outputDir, 'din_china_stock_repair_preview.md');

  fs.writeFileSync(jsonPath, JSON.stringify(plan, null, 2));

  const lines = [
    '# DIN CHINA Stock Movement Repair — Preview',
    '',
    `Generated: ${plan.generatedAt}`,
    `Company: ${plan.companyId}`,
    `Pass: **${plan.pass ? 'YES' : 'NO'}**`,
    '',
    '## Summary',
    '',
    `- Legacy final sales: ${plan.summary.legacySales}`,
    `- Legacy purchases (received/final): ${plan.summary.legacyPurchases}`,
    `- Expected sale item lines: ${plan.summary.expectedSaleLines}`,
    `- Expected purchase item lines: ${plan.summary.expectedPurchaseLines}`,
    `- Sale movements to insert: ${plan.summary.saleLinesToInsert}`,
    `- Purchase movements to insert: ${plan.summary.purchaseLinesToInsert}`,
    `- Sale lines already covered: ${plan.summary.saleLinesAlreadyCovered}`,
    `- Purchase lines already covered: ${plan.summary.purchaseLinesAlreadyCovered}`,
    `- Products track_stock → true: ${plan.summary.trackStockProductsToUpdate}`,
    '',
  ];

  if (plan.blockingErrors.length) {
    lines.push('## Blocking errors', '');
    for (const e of plan.blockingErrors) lines.push(`- ${e}`);
    lines.push('');
  }

  if (plan.rowsToInsert.length) {
    lines.push('## Movements to insert (sample)', '');
    lines.push('| Kind | Document | Product | Variation | Qty | movement_type |');
    lines.push('|------|----------|---------|-----------|-----|-----------------|');
    for (const r of plan.rowsToInsert.slice(0, 30)) {
      lines.push(
        `| ${r.kind} | ${r.documentRef} | ${r.product_id} | ${r.variation_id || '—'} | ${r.quantity} | ${r.movement_type} |`,
      );
    }
    if (plan.rowsToInsert.length > 30) {
      lines.push(`| … | +${plan.rowsToInsert.length - 30} more rows | | | | |`);
    }
    lines.push('');
  }

  fs.writeFileSync(mdPath, lines.join('\n'));
  return { jsonPath, mdPath };
}

export async function applyStockRepairPlan(supabase, companyId, plan) {
  if (!plan.pass) {
    return { ok: false, error: 'plan has blocking errors', stats: {} };
  }

  const stats = {
    movementsInserted: 0,
    trackStockUpdated: 0,
    errors: [],
  };

  for (const row of plan.rowsToInsert) {
    const { error } = await supabase.from('stock_movements').insert({
      id: row.id,
      company_id: row.company_id,
      branch_id: row.branch_id,
      product_id: row.product_id,
      variation_id: row.variation_id,
      quantity: row.quantity,
      unit_cost: row.unit_cost,
      total_cost: row.total_cost,
      movement_type: row.movement_type,
      reference_type: row.reference_type,
      reference_id: row.reference_id,
      notes: row.notes,
    });
    if (error) {
      stats.errors.push(`Insert ${row.kind} ${row.documentRef}: ${error.message}`);
    } else {
      stats.movementsInserted++;
    }
  }

  if (stats.errors.length) return { ok: false, stats };

  for (const p of plan.trackStockUpdates) {
    const { error } = await supabase
      .from('products')
      .update({ track_stock: true })
      .eq('id', p.productId)
      .eq('company_id', companyId);
    if (error) {
      stats.errors.push(`track_stock ${p.productId}: ${error.message}`);
    } else {
      stats.trackStockUpdated++;
    }
  }

  return { ok: stats.errors.length === 0, stats };
}

export async function verifyStockRepair(supabase, companyId, planBefore) {
  const checks = [];
  const fail = (name, expected, actual, detail = '') => {
    checks.push({ name, pass: false, expected, actual, detail });
  };
  const pass = (name, expected, actual) => {
    checks.push({ name, pass: true, expected, actual });
  };

  const sales = await loadLegacySales(supabase, companyId);
  const purchases = await loadLegacyPurchases(supabase, companyId);
  const saleItems = await loadSaleItems(supabase, sales.map((s) => s.id));
  const purchaseItems = await loadPurchaseItems(supabase, purchases.map((p) => p.id));
  const movements = await loadStockMovements(supabase, companyId);

  const saleRefsWithMovement = new Set(
    movements
      .filter((m) => m.reference_type === 'sale' && normMovementType(m.movement_type) === 'sale')
      .map((m) => String(m.reference_id)),
  );

  if (saleRefsWithMovement.size === sales.length) {
    pass('sales with stock movements', sales.length, saleRefsWithMovement.size);
  } else {
    fail('sales with stock movements', sales.length, saleRefsWithMovement.size);
  }

  let saleLineCovered = 0;
  for (const sale of sales) {
    for (const item of saleItems.filter((i) => i.sale_id === sale.id)) {
      const qty = num(item.quantity);
      if (qty <= 0) continue;
      const covered = findCoveringMovement(
        movements,
        'sale',
        sale.id,
        item.product_id,
        item.variation_id,
        -qty,
      );
      if (covered.length >= 1) saleLineCovered++;
    }
  }
  const expectedSaleLines = saleItems.filter((i) => num(i.quantity) > 0).length;
  if (saleLineCovered === expectedSaleLines) {
    pass('sale item lines covered', expectedSaleLines, saleLineCovered);
  } else {
    fail('sale item lines covered', expectedSaleLines, saleLineCovered);
  }

  let purchaseLineCovered = 0;
  for (const purchase of purchases) {
    for (const item of purchaseItems.filter((i) => i.purchase_id === purchase.id)) {
      const qty = num(item.quantity);
      if (qty <= 0) continue;
      const covered = findCoveringMovement(
        movements,
        'purchase',
        purchase.id,
        item.product_id,
        item.variation_id,
        qty,
      );
      if (covered.length >= 1) purchaseLineCovered++;
    }
  }
  const expectedPurchaseLines = purchaseItems.filter((i) => num(i.quantity) > 0).length;
  if (purchaseLineCovered === expectedPurchaseLines) {
    pass('purchase item lines covered', expectedPurchaseLines, purchaseLineCovered);
  } else {
    fail('purchase item lines covered', expectedPurchaseLines, purchaseLineCovered);
  }

  const purchaseMovementLines = movements.filter(
    (m) => m.reference_type === 'purchase' && normMovementType(m.movement_type) === 'purchase',
  ).length;
  if (purchaseMovementLines === expectedPurchaseLines) {
    pass('purchase movement row count', expectedPurchaseLines, purchaseMovementLines);
  } else {
    fail('purchase movement row count', expectedPurchaseLines, purchaseMovementLines);
  }

  const saleMovementLines = movements.filter(
    (m) => m.reference_type === 'sale' && normMovementType(m.movement_type) === 'sale',
  ).length;
  if (saleMovementLines === expectedSaleLines) {
    pass('sale movement row count', expectedSaleLines, saleMovementLines);
  } else {
    fail('sale movement row count', expectedSaleLines, saleMovementLines);
  }

  const { data: productsFalse } = await supabase
    .from('products')
    .select('id')
    .eq('company_id', companyId)
    .eq('track_stock', false);
  const legacyStillFalse = (productsFalse || []).filter((p) =>
    planBefore.trackStockUpdates.some((u) => u.productId === p.id),
  ).length;
  if (legacyStillFalse === 0) {
    pass('legacy products track_stock', 0, legacyStillFalse);
  } else {
    fail('legacy products track_stock false remaining', 0, legacyStillFalse);
  }

  const passAll = checks.every((c) => c.pass);
  return { pass: passAll, checks };
}

export function writeStockRepairFinalReport(outputDir, planBefore, applyResult, verification) {
  const mdPath = path.join(outputDir, 'din_china_stock_repair_final_report.md');
  const lines = [
    '# DIN CHINA Stock Movement Repair — Final Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Company: ${planBefore.companyId}`,
    `Apply: ${applyResult?.ok ? 'SUCCESS' : 'FAILED or not run'}`,
    `Verification pass: **${verification?.pass ? 'YES' : 'NO'}**`,
    '',
    '## Apply stats',
    `- Movements inserted: ${applyResult?.stats?.movementsInserted ?? 0}`,
    `- Products track_stock updated: ${applyResult?.stats?.trackStockUpdated ?? 0}`,
    '',
    '## Preview summary',
    `- Sale lines to insert (planned): ${planBefore.summary.saleLinesToInsert}`,
    `- Purchase lines to insert (planned): ${planBefore.summary.purchaseLinesToInsert}`,
    `- Already covered sale lines: ${planBefore.summary.saleLinesAlreadyCovered}`,
    `- Already covered purchase lines: ${planBefore.summary.purchaseLinesAlreadyCovered}`,
    '',
    '## Verification checks',
    '',
  ];

  for (const c of verification?.checks || []) {
    lines.push(`- ${c.pass ? 'PASS' : 'FAIL'} ${c.name}: expected ${c.expected}, got ${c.actual}`);
  }

  if (applyResult?.stats?.errors?.length) {
    lines.push('', '## Apply errors', '');
    for (const e of applyResult.stats.errors) lines.push(`- ${e}`);
  }

  lines.push(
    '',
    '## Confirmations',
    '- Document stock_movements backfilled only (no opening balance stock)',
    '- Existing movement rows not deleted or modified',
    '- Journal entries and payment amounts not modified',
    '- Canonical stock qty = SUM(stock_movements.quantity) per product/branch',
  );

  fs.writeFileSync(mdPath, lines.join('\n'));
  return mdPath;
}
