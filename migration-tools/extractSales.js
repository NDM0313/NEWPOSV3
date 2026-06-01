#!/usr/bin/env node
/**
 * Phase 13 Track B — Extract sales (type=sell) with FY cut-off >= 2025-10-01.
 *
 * Usage:
 *   node migration-tools/extractSales.js [62547.sql] [--config mapping.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseSqlInsertRows } from './lib/parseSqlInsert.js';
import { legacyToUuid } from './lib/legacyId.js';
import { passesFinancialYearCutoff, toTransactionDate } from './lib/fyCutoff.js';
import { buildPaymentIndex, resolvePaymentTotals } from './lib/mapOperationalPayments.js';
import { buildProductCatalog, mapLineItem } from './lib/mapProductVariant.js';
import { loadConfig, resolveDumpPath, resolveOutputDir, TOOLS_ROOT } from './lib/resolvePaths.js';

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
  const sellLines = parseSqlInsertRows(sql, 'transaction_sell_lines');
  const products = parseSqlInsertRows(sql, 'products');
  const variations = parseSqlInsertRows(sql, 'variations');
  const contacts = parseSqlInsertRows(sql, 'contacts');
  const payments = parseSqlInsertRows(sql, 'transaction_payments');

  const contactById = new Map(
    contacts.filter((c) => Number(c.business_id) === businessId).map((c) => [Number(c.id), c]),
  );
  const linesByTxn = new Map();
  for (const line of sellLines) {
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
    legacySellHeaders: 0,
    extracted: 0,
    skippedBeforeCutoff: 0,
    skippedQuotation: 0,
    skippedWrongBusiness: 0,
    skippedInvalidDate: 0,
    lineItems: 0,
  };

  const entries = [];

  for (const txn of transactions) {
    if (String(txn.type || '').toLowerCase() !== 'sell') continue;
    if (Number(txn.business_id) !== businessId) {
      stats.skippedWrongBusiness++;
      continue;
    }
    stats.legacySellHeaders++;

    if (Number(txn.is_quotation) === 1) {
      stats.skippedQuotation++;
      continue;
    }

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
    const items = rawLines.map((line) => mapLineItem(line, 'sell', catalog));
    stats.lineItems += items.length;

    entries.push({
      id: legacyToUuid('transactions', legacyId),
      invoiceNo: txn.invoice_no != null ? String(txn.invoice_no) : '',
      invoiceDate: txnDate,
      customerId: txn.contact_id != null ? legacyToUuid('contacts', Number(txn.contact_id)) : null,
      customerName: contact?.name ? String(contact.name) : 'Walk-in',
      contactNumber: contact?.mobile ? String(contact.mobile) : contact?.landline ? String(contact.landline) : '',
      branchId: txn.location_id != null ? legacyToUuid('business_locations', Number(txn.location_id)) : null,
      subtotal: Number(txn.total_before_tax) || 0,
      discountAmount: Number(txn.discount_amount) || 0,
      taxAmount: Number(txn.tax_amount) || 0,
      total: Number(txn.final_total) || 0,
      paidAmount,
      dueAmount,
      paymentStatus,
      status: String(txn.status || 'final'),
      paymentMethod: 'cash',
      notes: txn.additional_notes != null ? String(txn.additional_notes) : null,
      itemCount: items.length,
      items,
      companyId,
      legacyTransactionId: legacyId,
    });
    stats.extracted++;
  }

  entries.sort((a, b) => {
    const d = (a.invoiceDate || '').localeCompare(b.invoiceDate || '');
    if (d !== 0) return d;
    return (a.invoiceNo || '').localeCompare(b.invoiceNo || '');
  });

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'sales.json');
  const payload = {
    meta: {
      track: 'B',
      documentType: 'sale',
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

  console.log(`Wrote ${stats.extracted} sales → ${outPath}`);
  console.log(
    `Track B Sales: extracted ${stats.extracted} | skipped (before ${cutoff}): ${stats.skippedBeforeCutoff} | quotations skipped: ${stats.skippedQuotation} | line items: ${stats.lineItems}`,
  );
  console.log(`Legacy sell headers (business ${businessId}): ${stats.legacySellHeaders}`);
}

main();
