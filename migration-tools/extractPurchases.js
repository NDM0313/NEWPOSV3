#!/usr/bin/env node
/**
 * Phase 13 Track B — Extract purchases (type=purchase) with FY cut-off >= 2025-10-01.
 *
 * Usage:
 *   node migration-tools/extractPurchases.js [62547.sql] [--config mapping.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseSqlInsertRows } from './lib/parseSqlInsert.js';
import { legacyToUuid } from './lib/legacyId.js';
import { passesFinancialYearCutoff, toTransactionDate } from './lib/fyCutoff.js';
import { buildPaymentIndex, resolvePaymentTotals } from './lib/mapOperationalPayments.js';
import { buildProductCatalog, mapLineItem } from './lib/mapProductVariant.js';
import { loadConfig, resolveDumpPath, resolveOutputDir, TOOLS_ROOT } from './lib/resolvePaths.js';

function resolvePoNo(txn) {
  const ref = txn.ref_no != null ? String(txn.ref_no).trim() : '';
  const inv = txn.invoice_no != null ? String(txn.invoice_no).trim() : '';
  return ref || inv || `LEG-PO-${txn.id}`;
}

function main() {
  const args = process.argv.slice(2);
  const configFlag = args.indexOf('--config');
  const configPath =
    configFlag >= 0 && args[configFlag + 1]
      ? path.resolve(args[configFlag + 1])
      : path.join(TOOLS_ROOT, 'config', 'mapping.example.json');

  const config = fs.existsSync(configPath) ? loadConfig(configPath) : { legacyBusinessId: 2 };
  const businessId = Number(config.legacyBusinessId ?? 2);
  const companyId = String(config.targetCompanyId || '00000000-0000-4000-8000-000000000001');
  const cutoff = String(config.financialYearCutoff || '2025-10-01');
  const dumpPath = resolveDumpPath(args, config);
  const outDir = resolveOutputDir(config);

  if (!fs.existsSync(dumpPath)) {
    console.error(`Dump not found: ${dumpPath}`);
    process.exit(1);
  }

  console.log(`Reading dump: ${dumpPath}`);
  const sql = fs.readFileSync(dumpPath, 'utf8');

  const transactions = parseSqlInsertRows(sql, 'transactions');
  const purchaseLines = parseSqlInsertRows(sql, 'purchase_lines');
  const products = parseSqlInsertRows(sql, 'products');
  const variations = parseSqlInsertRows(sql, 'variations');
  const contacts = parseSqlInsertRows(sql, 'contacts');
  const payments = parseSqlInsertRows(sql, 'transaction_payments');

  const contactById = new Map(
    contacts.filter((c) => Number(c.business_id) === businessId).map((c) => [Number(c.id), c]),
  );
  const linesByTxn = new Map();
  for (const line of purchaseLines) {
    const tid = Number(line.transaction_id);
    if (!linesByTxn.has(tid)) linesByTxn.set(tid, []);
    linesByTxn.get(tid).push(line);
  }

  const catalog = buildProductCatalog(
    products.filter((p) => Number(p.business_id) === businessId),
    variations,
  );
  const paymentByTxn = buildPaymentIndex(payments, businessId);

  const stats = {
    legacyPurchaseHeaders: 0,
    extracted: 0,
    skippedBeforeCutoff: 0,
    skippedWrongBusiness: 0,
    skippedInvalidDate: 0,
    lineItems: 0,
  };

  const entries = [];

  for (const txn of transactions) {
    if (String(txn.type || '').toLowerCase() !== 'purchase') continue;
    if (Number(txn.business_id) !== businessId) {
      stats.skippedWrongBusiness++;
      continue;
    }
    stats.legacyPurchaseHeaders++;

    const txnDate = toTransactionDate(txn.transaction_date);
    if (!txnDate) {
      stats.skippedInvalidDate++;
      continue;
    }
    if (!passesFinancialYearCutoff(txnDate, cutoff)) {
      stats.skippedBeforeCutoff++;
      continue;
    }

    const legacyId = Number(txn.id);
    const contact = txn.contact_id != null ? contactById.get(Number(txn.contact_id)) : null;
    const paidRaw = paymentByTxn.get(legacyId) || 0;
    const { paidAmount, dueAmount, paymentStatus } = resolvePaymentTotals(
      txn.final_total,
      paidRaw,
      txn.payment_status,
    );

    const rawLines = linesByTxn.get(legacyId) || [];
    const items = rawLines.map((line) => mapLineItem(line, 'purchase', catalog));
    stats.lineItems += items.length;

    const poNo = resolvePoNo(txn);
    const vendorName =
      contact?.supplier_business_name && String(contact.supplier_business_name).trim()
        ? String(contact.supplier_business_name)
        : contact?.name
          ? String(contact.name)
          : 'Unknown';

    entries.push({
      id: legacyToUuid('transactions', legacyId),
      poNo,
      vendor: vendorName,
      vendorPhone: contact?.mobile ? String(contact.mobile) : contact?.landline ? String(contact.landline) : '',
      supplierId: txn.contact_id != null ? legacyToUuid('contacts', Number(txn.contact_id)) : null,
      branchId: txn.location_id != null ? legacyToUuid('business_locations', Number(txn.location_id)) : null,
      subtotal: Number(txn.total_before_tax) || 0,
      discount: Number(txn.discount_amount) || 0,
      taxAmount: Number(txn.tax_amount) || 0,
      shippingCost: Number(txn.shipping_charges) || 0,
      total: Number(txn.final_total) || 0,
      paidAmount,
      dueAmount,
      paymentStatus,
      status: String(txn.status || 'received'),
      date: txnDate,
      orderDate: txnDate,
      notes: txn.additional_notes != null ? String(txn.additional_notes) : null,
      itemCount: items.length,
      items,
      companyId,
      legacyTransactionId: legacyId,
    });
    stats.extracted++;
  }

  entries.sort((a, b) => {
    const d = (a.date || '').localeCompare(b.date || '');
    if (d !== 0) return d;
    return (a.poNo || '').localeCompare(b.poNo || '');
  });

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'purchases.json');
  const payload = {
    meta: {
      track: 'B',
      documentType: 'purchase',
      companyId,
      legacyBusinessId: businessId,
      financialYearCutoff: cutoff,
      dateFilterApplied: true,
      extractedAt: new Date().toISOString(),
      stats,
    },
    entries,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Wrote ${stats.extracted} purchases → ${outPath}`);
  console.log(
    `Track B Purchases: extracted ${stats.extracted} | skipped (before ${cutoff}): ${stats.skippedBeforeCutoff} | line items: ${stats.lineItems}`,
  );
  console.log(`Legacy purchase headers (business ${businessId}): ${stats.legacyPurchaseHeaders}`);
}

main();
