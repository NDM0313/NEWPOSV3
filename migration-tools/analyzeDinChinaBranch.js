#!/usr/bin/env node
/**
 * Read-only DIN CHINA branch migration analysis (legacy UltimatePOS / zhd dump).
 *
 * Filters by business_locations.id via transactions.location_id.
 * Exports review CSVs + markdown report. Does NOT import to new ERP.
 *
 * Usage:
 *   node migration-tools/analyzeDinChinaBranch.js [zhd.sql] --branch-id 2 --out-dir .
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSqlInsertRows } from './lib/parseSqlInsert.js';
import { buildProductCatalog, mapLineItem } from './lib/mapProductVariant.js';
import { resolvePaymentTotals } from './lib/mapOperationalPayments.js';

const TOOLS_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TOOLS_ROOT, '..');

const CANDIDATE_TABLES = [
  'business',
  'business_locations',
  'transactions',
  'transaction_sell_lines',
  'purchase_lines',
  'transaction_payments',
  'contacts',
  'products',
  'variations',
  'account_transactions',
  'expense_categories',
  'accounts',
  'users',
  'accounting_accounts',
  'accounting_accounts_transactions',
  'activity_log',
  'brands',
  'categories',
  'cash_registers',
  'cash_register_transactions',
];

const EXCLUDED_TXN_STATUSES = new Set(['draft', 'cancelled', 'void', 'canceled']);
const PURCHASE_OK_STATUSES = new Set(['received', 'final']);

function parseArgs(argv) {
  const args = argv.slice(2);
  let dumpPath = null;
  let branchId = 2;
  let outDir = REPO_ROOT;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--branch-id' && args[i + 1]) {
      branchId = Number(args[++i]);
    } else if (args[i] === '--out-dir' && args[i + 1]) {
      outDir = path.resolve(args[++i]);
    } else if (!args[i].startsWith('--')) {
      dumpPath = path.resolve(args[i]);
    }
  }

  if (!dumpPath) {
    const fallback = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads', 'zhd.sql');
    dumpPath = fs.existsSync(fallback) ? fallback : path.resolve(REPO_ROOT, 'zhd.sql');
  }

  return { dumpPath, branchId, outDir };
}

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

function sumField(rows, field) {
  return rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function contactLabel(c) {
  if (!c) return '';
  const biz = c.supplier_business_name ? String(c.supplier_business_name).trim() : '';
  const name = c.name ? String(c.name).trim() : '';
  return biz || name;
}

function discoverTables(sql) {
  const found = [];
  for (const table of CANDIDATE_TABLES) {
    try {
      const rows = parseSqlInsertRows(sql, table);
      if (rows.length > 0) found.push({ table, rowCount: rows.length });
    } catch {
      /* skip */
    }
  }
  const createRe = /CREATE TABLE `([^`]+)`/gi;
  let m;
  const allCreated = new Set();
  while ((m = createRe.exec(sql)) !== null) allCreated.add(m[1]);
  return { populated: found.sort((a, b) => a.table.localeCompare(b.table)), totalCreated: allCreated.size };
}

function classifyAccountTransaction(row, selectedTxnIds, selectedPayIds) {
  if (row.deleted_at) return 'deleted';
  const sub = String(row.sub_type || '').toLowerCase();
  if (sub === 'fund_transfer') return 'fund_transfer';
  if (sub === 'opening_balance') return 'opening_balance';
  if (sub === 'deposit') return 'deposit';
  const txnId = row.transaction_id != null ? Number(row.transaction_id) : 0;
  const payId = row.transaction_payment_id != null ? Number(row.transaction_payment_id) : 0;
  if (!txnId && !payId) return 'manual_unlinked';
  if (txnId && selectedTxnIds.has(txnId)) return 'linked_selected_txn_excluded_from_import';
  if (payId && selectedPayIds.has(payId)) return 'linked_selected_payment_excluded_from_import';
  if (txnId || payId) return 'linked_other_branch_or_excluded_doc';
  return 'manual_unlinked';
}

function buildSkippedAccountRows(accountRows, selectedTxnIds, selectedPayIds) {
  const summary = {};
  const skipped = [];
  for (const row of accountRows) {
    const reason = classifyAccountTransaction(row, selectedTxnIds, selectedPayIds);
    summary[reason] = (summary[reason] || 0) + 1;
    skipped.push({
      id: row.id,
      account_id: row.account_id,
      type: row.type,
      sub_type: row.sub_type ?? '',
      amount: row.amount,
      operation_date: row.operation_date,
      transaction_id: row.transaction_id ?? '',
      transaction_payment_id: row.transaction_payment_id ?? '',
      transfer_transaction_id: row.transfer_transaction_id ?? '',
      note: row.note ?? '',
      skip_reason: reason,
    });
  }
  return { summary, skipped };
}

function runValidations(ctx) {
  const issues = [];
  const tol = 0.01;

  for (const s of ctx.sales) {
    if (Number(s.location_id) !== ctx.branchId) {
      issues.push(`Sale ${s.legacy_transaction_id} has location_id=${s.location_id}`);
    }
    if (!s.customer_id) issues.push(`Sale ${s.invoice_no} missing customer`);
    const paid = ctx.salePayByTxn.get(Number(s.legacy_transaction_id)) || 0;
    const due = Number(s.final_total) - paid;
    if (Math.abs(Number(s.final_total) - paid - due) > tol) {
      issues.push(`Sale ${s.invoice_no} total/paid/due mismatch`);
    }
  }

  for (const p of ctx.purchases) {
    if (Number(p.location_id) !== ctx.branchId) {
      issues.push(`Purchase ${p.legacy_transaction_id} has location_id=${p.location_id}`);
    }
    if (!p.supplier_id) issues.push(`Purchase ${p.po_no} missing supplier`);
    const paid = ctx.purchPayByTxn.get(Number(p.legacy_transaction_id)) || 0;
    const due = Number(p.final_total) - paid;
    if (Math.abs(Number(p.final_total) - paid - due) > tol) {
      issues.push(`Purchase ${p.po_no} total/paid/due mismatch`);
    }
  }

  for (const e of ctx.expenses) {
    if (Number(e.location_id) !== ctx.branchId) {
      issues.push(`Expense ${e.ref_no} has location_id=${e.location_id}`);
    }
  }

  const branch1InExport =
    ctx.sales.some((s) => Number(s.location_id) === 1) ||
    ctx.purchases.some((p) => Number(p.location_id) === 1) ||
    ctx.expenses.some((e) => Number(e.location_id) === 1);
  if (branch1InExport) issues.push('DIN COLLECTION (location_id=1) data found in export set');

  for (const p of ctx.salePayments) {
    if (!ctx.saleIds.has(Number(p.transaction_id))) {
      issues.push(`Sale payment ${p.payment_id} not linked to selected sale`);
    }
  }
  for (const p of ctx.purchasePayments) {
    if (!ctx.purchaseIds.has(Number(p.transaction_id))) {
      issues.push(`Purchase payment ${p.payment_id} not linked to selected purchase`);
    }
  }

  for (const item of ctx.saleItems) {
    if (!item.sku && !item.product_name) {
      issues.push(`Sale item ${item.line_id} missing SKU and product name`);
    }
  }
  for (const item of ctx.purchaseItems) {
    if (!item.sku && !item.product_name) {
      issues.push(`Purchase item ${item.line_id} missing SKU and product name`);
    }
  }

  return issues;
}

function buildMarkdownReport(ctx) {
  const { branch, stats, skippedSummary, risky, mapping, validationIssues, tables, dumpPath, analyzedAt } =
    ctx;

  const rec =
    validationIssues.length > 0
      ? 'needs manual cleanup'
      : mapping.blockers.length > 0
        ? 'needs mapping'
        : 'safe to import';

  const lines = [
    '# Legacy DIN CHINA Branch Migration Analysis',
    '',
    `**Generated:** ${analyzedAt}  `,
    `**Source dump:** \`${dumpPath}\`  `,
    `**Mode:** Read-only analysis — no import performed`,
    '',
    '---',
    '',
    '## 1. Old DB Tables Found',
    '',
    `Total \`CREATE TABLE\` definitions in dump: **${tables.totalCreated}**`,
    '',
    'Tables with INSERT data (candidate legacy sources):',
    '',
    '| Table | Row count |',
    '|-------|----------:|',
    ...tables.populated.map((t) => `| \`${t.table}\` | ${t.rowCount} |`),
    '',
    '## 2. Branch Confirmation',
    '',
    '| Field | Value |',
    '|-------|-------|',
    `| **id** | ${branch.id} |`,
    `| **location_id** | ${branch.location_id} |`,
    `| **name** | ${branch.name} |`,
    `| **business_id** | ${branch.business_id} |`,
    '',
    'Filter applied: `transactions.location_id = ' + ctx.branchId + '` (maps to `business_locations.id`).',
    '',
    '## 3. Sales Count and Total Amount',
    '',
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Final sales (branch) | **${stats.sales.count}** |`,
    `| Total amount | **${fmtMoney(stats.sales.total)}** |`,
    '',
    '## 4. Sale Item Count and Total Quantity',
    '',
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Line items | **${stats.saleItems.count}** |`,
    `| Total quantity | **${fmtMoney(stats.saleItems.qty)}** |`,
    '',
    '## 5. Sale Payment Count and Total Paid Amount',
    '',
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Linked payments | **${stats.salePayments.count}** |`,
    `| Total paid | **${fmtMoney(stats.salePayments.total)}** |`,
    `| Outstanding (sales total − paid) | **${fmtMoney(stats.sales.total - stats.salePayments.total)}** |`,
    '',
    '## 6. Purchase Count and Total Amount',
    '',
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Purchases (branch) | **${stats.purchases.count}** |`,
    `| Total amount | **${fmtMoney(stats.purchases.total)}** |`,
    '',
    '## 7. Purchase Item Count and Total Quantity',
    '',
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Line items | **${stats.purchaseItems.count}** |`,
    `| Total quantity | **${fmtMoney(stats.purchaseItems.qty)}** |`,
    '',
    '## 8. Purchase Payment Count and Total Paid Amount',
    '',
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Linked payments | **${stats.purchasePayments.count}** |`,
    `| Total paid | **${fmtMoney(stats.purchasePayments.total)}** |`,
    `| Outstanding (purchase total − paid) | **${fmtMoney(stats.purchases.total - stats.purchasePayments.total)}** |`,
    '',
    '## 9. Expense Count and Total Amount',
    '',
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Final expenses (branch) | **${stats.expenses.count}** |`,
    `| Total amount | **${fmtMoney(stats.expenses.total)}** |`,
    '',
    '## 10. Customers Involved',
    '',
    `Distinct customers on selected sales: **${stats.customers.count}**`,
    '',
    '| Legacy contact id | Name | Mobile |',
    '|------------------:|------|--------|',
    ...stats.customers.list.map((c) => `| ${c.id} | ${c.name} | ${c.mobile || ''} |`),
    '',
    '## 11. Suppliers Involved',
    '',
    `Distinct suppliers on selected purchases: **${stats.suppliers.count}**`,
    '',
    '| Legacy contact id | Name | Mobile |',
    '|------------------:|------|--------|',
    ...stats.suppliers.list.map((c) => `| ${c.id} | ${c.name} | ${c.mobile || ''} |`),
    '',
    '## 12. Products Involved',
    '',
    `Distinct products on sale/purchase lines: **${stats.products.count}**`,
    '',
    '| Legacy product id | SKU | Name |',
    '|------------------:|-----|------|',
    ...stats.products.list.map((p) => `| ${p.id} | ${p.sku || ''} | ${p.name} |`),
    '',
    '## 13. Payment Methods / Accounts Involved',
    '',
    '### Sale & purchase payment methods',
    '',
    '| Method | Count | Total amount |',
    '|--------|------:|-------------:|',
    ...stats.paymentMethods.map((m) => `| ${m.method} | ${m.count} | ${fmtMoney(m.total)} |`),
    '',
    '### Legacy account ids (payment register)',
    '',
    '| Account id | Account name | Used in payments |',
    '|-----------:|--------------|-----------------:|',
    ...stats.paymentAccounts.map((a) => `| ${a.id} | ${a.name} | ${a.count} |`),
    '',
    '## 14. Skipped Account Transactions Summary',
    '',
    'Raw `account_transactions` are **not** imported. Audit-only breakdown:',
    '',
    '| Skip reason | Count |',
    '|-------------|------:|',
    ...Object.entries(skippedSummary)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `| ${k} | ${v} |`),
    '',
    `**Total account_transactions rows:** ${stats.accountTransactionsTotal}`,
    '',
    'Also excluded from operational CSVs (not in account_transactions):',
    '',
    ...risky.skippedOperational.map((r) => `- ${r}`),
    '',
    '## 15. Missing or Risky Records',
    '',
    ...(validationIssues.length
      ? ['### Validation issues', '', ...validationIssues.map((i) => `- ${i}`), '']
      : ['### Validation', '', 'All automated validation checks **passed**.', '']),
    '### Skipped documents (audit only)',
    '',
    ...risky.skippedDocs.map((r) => `- ${r}`),
    '',
    '### Data quality notes',
    '',
    ...risky.notes.map((r) => `- ${r}`),
    '',
    '## 16. Suggested Mapping Needed Before Import',
    '',
    ...mapping.items.map((m) => `- ${m}`),
    '',
    '## 17. Final Recommendation',
    '',
    `**${rec}**`,
    '',
    rec === 'safe to import'
      ? 'Operational documents for DIN CHINA are structurally consistent. Define target branch UUID and run import in a staging company first.'
      : rec === 'needs mapping'
        ? 'Documents are branch-clean and reconcilable, but legacy payment methods, account ids, contacts, and products must be mapped to the new DIN ERP before import.'
        : 'Resolve validation issues and review skipped/risky records before any import attempt.',
    '',
    '---',
    '',
    '## Review CSV Files',
    '',
    '| File | Rows |',
    '|------|-----:|',
    `| \`legacy_din_china_sales.csv\` | ${ctx.sales.length} |`,
    `| \`legacy_din_china_sale_items.csv\` | ${ctx.saleItems.length} |`,
    `| \`legacy_din_china_sale_payments.csv\` | ${ctx.salePayments.length} |`,
    `| \`legacy_din_china_purchases.csv\` | ${ctx.purchases.length} |`,
    `| \`legacy_din_china_purchase_items.csv\` | ${ctx.purchaseItems.length} |`,
    `| \`legacy_din_china_purchase_payments.csv\` | ${ctx.purchasePayments.length} |`,
    `| \`legacy_din_china_expenses.csv\` | ${ctx.expenses.length} |`,
    `| \`legacy_din_china_skipped_account_transactions.csv\` | ${ctx.skippedAccountRows.length} |`,
    '',
  ];

  return lines.join('\n');
}

function main() {
  const { dumpPath, branchId, outDir } = parseArgs(process.argv);

  if (!fs.existsSync(dumpPath)) {
    console.error(`Dump not found: ${dumpPath}`);
    process.exit(1);
  }

  console.log(`Reading dump: ${dumpPath}`);
  console.log(`Branch filter: business_locations.id = ${branchId} (transactions.location_id)`);
  console.log(`Output dir: ${outDir}`);

  const sql = fs.readFileSync(dumpPath, 'utf8');
  const tables = discoverTables(sql);

  const locations = parseSqlInsertRows(sql, 'business_locations');
  const branch = locations.find((l) => Number(l.id) === branchId);
  if (!branch) {
    console.error(`Branch id ${branchId} not found in business_locations`);
    process.exit(1);
  }
  if (String(branch.location_id) !== 'BL0002' || !String(branch.name).includes('CHINA')) {
    console.warn(
      `Warning: branch id ${branchId} is ${branch.location_id} / ${branch.name} — confirm this is DIN CHINA`,
    );
  }

  const transactions = parseSqlInsertRows(sql, 'transactions');
  const sellLinesRaw = parseSqlInsertRows(sql, 'transaction_sell_lines');
  const purchaseLinesRaw = parseSqlInsertRows(sql, 'purchase_lines');
  const paymentsRaw = parseSqlInsertRows(sql, 'transaction_payments');
  const contacts = parseSqlInsertRows(sql, 'contacts');
  const products = parseSqlInsertRows(sql, 'products');
  const variations = parseSqlInsertRows(sql, 'variations');
  const expenseCategories = parseSqlInsertRows(sql, 'expense_categories');
  const accounts = parseSqlInsertRows(sql, 'accounts');
  const accountTransactions = parseSqlInsertRows(sql, 'account_transactions');

  const contactById = new Map(contacts.map((c) => [Number(c.id), c]));
  const accountById = new Map(accounts.map((a) => [Number(a.id), a]));
  const expCatById = new Map(expenseCategories.map((c) => [Number(c.id), c]));
  const catalog = buildProductCatalog(products, variations);

  const branchTxns = transactions.filter((t) => Number(t.location_id) === branchId);
  const skippedDocs = [];

  const salesRaw = branchTxns.filter((t) => {
    if (String(t.type).toLowerCase() !== 'sell') return false;
    if (Number(t.is_quotation) === 1) {
      skippedDocs.push(`Quotation sell txn ${t.id} (${t.invoice_no})`);
      return false;
    }
    if (EXCLUDED_TXN_STATUSES.has(String(t.status).toLowerCase())) {
      skippedDocs.push(`Excluded sell txn ${t.id} status=${t.status}`);
      return false;
    }
    if (String(t.status).toLowerCase() !== 'final') {
      skippedDocs.push(`Non-final sell txn ${t.id} status=${t.status}`);
      return false;
    }
    return true;
  });

  const sellReturns = branchTxns.filter((t) => String(t.type).toLowerCase() === 'sell_return');
  for (const r of sellReturns) {
    skippedDocs.push(
      `sell_return txn ${r.id} invoice=${r.invoice_no || r.ref_no} total=${r.final_total} status=${r.status}`,
    );
  }

  const purchasesRaw = branchTxns.filter((t) => {
    if (String(t.type).toLowerCase() !== 'purchase') return false;
    if (EXCLUDED_TXN_STATUSES.has(String(t.status).toLowerCase())) {
      skippedDocs.push(`Excluded purchase txn ${t.id} status=${t.status}`);
      return false;
    }
    if (!PURCHASE_OK_STATUSES.has(String(t.status).toLowerCase())) {
      skippedDocs.push(`Non-received purchase txn ${t.id} status=${t.status}`);
      return false;
    }
    return true;
  });

  const expensesRaw = branchTxns.filter((t) => {
    if (String(t.type).toLowerCase() !== 'expense') return false;
    if (EXCLUDED_TXN_STATUSES.has(String(t.status).toLowerCase())) {
      skippedDocs.push(`Excluded expense txn ${t.id} status=${t.status}`);
      return false;
    }
    if (String(t.status).toLowerCase() !== 'final') {
      skippedDocs.push(`Non-final expense txn ${t.id} status=${t.status}`);
      return false;
    }
    return true;
  });

  const saleIds = new Set(salesRaw.map((t) => Number(t.id)));
  const purchaseIds = new Set(purchasesRaw.map((t) => Number(t.id)));
  const expenseIds = new Set(expensesRaw.map((t) => Number(t.id)));
  const selectedTxnIds = new Set([...saleIds, ...purchaseIds, ...expenseIds]);

  const unlinkedPayments = paymentsRaw.filter((p) => p.transaction_id == null);
  const advanceHeaders = unlinkedPayments.filter((p) => Number(p.is_advance) === 1);
  skippedDocs.push(
    `${unlinkedPayments.length} transaction_payments with null transaction_id (${advanceHeaders.length} advance headers) — excluded from payment CSVs`,
  );

  const salePaymentsRaw = paymentsRaw.filter(
    (p) =>
      p.transaction_id != null &&
      saleIds.has(Number(p.transaction_id)) &&
      Number(p.is_return) !== 1,
  );
  const purchasePaymentsRaw = paymentsRaw.filter(
    (p) => p.transaction_id != null && purchaseIds.has(Number(p.transaction_id)),
  );

  const salePayByTxn = new Map();
  for (const p of salePaymentsRaw) {
    const tid = Number(p.transaction_id);
    salePayByTxn.set(tid, (salePayByTxn.get(tid) || 0) + Math.abs(Number(p.amount) || 0));
  }
  const purchPayByTxn = new Map();
  for (const p of purchasePaymentsRaw) {
    const tid = Number(p.transaction_id);
    purchPayByTxn.set(tid, (purchPayByTxn.get(tid) || 0) + Math.abs(Number(p.amount) || 0));
  }

  const expensePaymentsByTxn = new Map();
  for (const p of paymentsRaw) {
    if (p.transaction_id != null && expenseIds.has(Number(p.transaction_id))) {
      expensePaymentsByTxn.set(Number(p.transaction_id), p);
    }
  }

  const sales = salesRaw.map((txn) => {
    const legacyId = Number(txn.id);
    const contact = txn.contact_id != null ? contactById.get(Number(txn.contact_id)) : null;
    const paidRaw = salePayByTxn.get(legacyId) || 0;
    const { paidAmount, dueAmount, paymentStatus } = resolvePaymentTotals(
      txn.final_total,
      paidRaw,
      txn.payment_status,
    );
    return {
      legacy_transaction_id: legacyId,
      location_id: Number(txn.location_id),
      invoice_no: txn.invoice_no ?? '',
      transaction_date: txn.transaction_date,
      status: txn.status,
      payment_status: paymentStatus,
      customer_id: txn.contact_id != null ? Number(txn.contact_id) : null,
      customer_name: contactLabel(contact) || 'Walk-in',
      customer_mobile: contact?.mobile ? String(contact.mobile) : '',
      subtotal: Number(txn.total_before_tax) || 0,
      discount_amount: Number(txn.discount_amount) || 0,
      tax_amount: Number(txn.tax_amount) || 0,
      shipping_charges: Number(txn.shipping_charges) || 0,
      final_total: Number(txn.final_total) || 0,
      paid_amount: paidAmount,
      due_amount: dueAmount,
      notes: txn.additional_notes ?? '',
    };
  });

  const saleItems = sellLinesRaw
    .filter((l) => saleIds.has(Number(l.transaction_id)))
    .map((line) => {
      const mapped = mapLineItem(line, 'sell', catalog);
      const txn = salesRaw.find((t) => Number(t.id) === Number(line.transaction_id));
      return {
        line_id: Number(line.id),
        transaction_id: Number(line.transaction_id),
        invoice_no: txn?.invoice_no ?? '',
        product_id: mapped.legacyProductId,
        variation_id: mapped.legacyVariationId,
        sku: mapped.sku ?? '',
        product_name: mapped.productName,
        quantity: mapped.quantity,
        unit_price: mapped.unitPrice,
        discount_amount: mapped.discountAmount,
        tax_amount: mapped.taxAmount,
        line_total: mapped.total,
      };
    });

  const salePayments = salePaymentsRaw.map((p) => {
    const acct = p.account_id != null ? accountById.get(Number(p.account_id)) : null;
    const txn = salesRaw.find((t) => Number(t.id) === Number(p.transaction_id));
    return {
      payment_id: Number(p.id),
      transaction_id: Number(p.transaction_id),
      invoice_no: txn?.invoice_no ?? '',
      paid_on: p.paid_on ?? '',
      amount: Number(p.amount) || 0,
      method: p.method ?? '',
      payment_type: p.payment_type ?? '',
      account_id: p.account_id ?? '',
      account_name: acct?.name ? String(acct.name) : '',
      payment_ref_no: p.payment_ref_no ?? '',
      note: p.note ?? '',
    };
  });

  const purchases = purchasesRaw.map((txn) => {
    const legacyId = Number(txn.id);
    const contact = txn.contact_id != null ? contactById.get(Number(txn.contact_id)) : null;
    const paidRaw = purchPayByTxn.get(legacyId) || 0;
    const { paidAmount, dueAmount, paymentStatus } = resolvePaymentTotals(
      txn.final_total,
      paidRaw,
      txn.payment_status,
    );
    const poNo =
      (txn.ref_no != null && String(txn.ref_no).trim()) ||
      (txn.invoice_no != null && String(txn.invoice_no).trim()) ||
      `LEG-PO-${legacyId}`;
    return {
      legacy_transaction_id: legacyId,
      location_id: Number(txn.location_id),
      po_no: poNo,
      transaction_date: txn.transaction_date,
      status: txn.status,
      payment_status: paymentStatus,
      supplier_id: txn.contact_id != null ? Number(txn.contact_id) : null,
      supplier_name: contactLabel(contact) || '',
      supplier_mobile: contact?.mobile ? String(contact.mobile) : '',
      subtotal: Number(txn.total_before_tax) || 0,
      discount_amount: Number(txn.discount_amount) || 0,
      tax_amount: Number(txn.tax_amount) || 0,
      shipping_charges: Number(txn.shipping_charges) || 0,
      final_total: Number(txn.final_total) || 0,
      paid_amount: paidAmount,
      due_amount: dueAmount,
      notes: txn.additional_notes ?? '',
    };
  });

  const purchaseItems = purchaseLinesRaw
    .filter((l) => purchaseIds.has(Number(l.transaction_id)))
    .map((line) => {
      const mapped = mapLineItem(line, 'purchase', catalog);
      const txn = purchasesRaw.find((t) => Number(t.id) === Number(line.transaction_id));
      return {
        line_id: Number(line.id),
        transaction_id: Number(line.transaction_id),
        po_no: txn?.ref_no || txn?.invoice_no || '',
        product_id: mapped.legacyProductId,
        variation_id: mapped.legacyVariationId,
        sku: mapped.sku ?? '',
        product_name: mapped.productName,
        quantity: mapped.quantity,
        unit_price: mapped.unitPrice,
        tax_amount: mapped.taxAmount,
        line_total: mapped.total,
      };
    });

  const purchasePayments = purchasePaymentsRaw.map((p) => {
    const acct = p.account_id != null ? accountById.get(Number(p.account_id)) : null;
    const txn = purchasesRaw.find((t) => Number(t.id) === Number(p.transaction_id));
    const poNo = txn?.ref_no || txn?.invoice_no || '';
    return {
      payment_id: Number(p.id),
      transaction_id: Number(p.transaction_id),
      po_no: poNo,
      paid_on: p.paid_on ?? '',
      amount: Number(p.amount) || 0,
      method: p.method ?? '',
      payment_type: p.payment_type ?? '',
      account_id: p.account_id ?? '',
      account_name: acct?.name ? String(acct.name) : '',
      payment_ref_no: p.payment_ref_no ?? '',
      note: p.note ?? '',
    };
  });

  const expenses = expensesRaw.map((txn) => {
    const pay = expensePaymentsByTxn.get(Number(txn.id));
    const acct = pay?.account_id != null ? accountById.get(Number(pay.account_id)) : null;
    const cat = txn.expense_category_id != null ? expCatById.get(Number(txn.expense_category_id)) : null;
    const subCat =
      txn.expense_sub_category_id != null ? expCatById.get(Number(txn.expense_sub_category_id)) : null;
    return {
      legacy_transaction_id: Number(txn.id),
      location_id: Number(txn.location_id),
      ref_no: txn.ref_no ?? txn.invoice_no ?? '',
      expense_date: txn.transaction_date,
      status: txn.status,
      category_id: txn.expense_category_id ?? '',
      category_name: cat?.name ? String(cat.name) : '',
      sub_category_id: txn.expense_sub_category_id ?? '',
      sub_category_name: subCat?.name ? String(subCat.name) : '',
      amount: Number(txn.final_total) || 0,
      payment_status: txn.payment_status ?? '',
      payment_method: pay?.method ?? txn.prefer_payment_method ?? '',
      payment_account_id: pay?.account_id ?? txn.prefer_payment_account ?? '',
      payment_account_name: acct?.name ? String(acct.name) : '',
      description: txn.additional_notes ?? '',
    };
  });

  const selectedPayIds = new Set([
    ...salePaymentsRaw.map((p) => Number(p.id)),
    ...purchasePaymentsRaw.map((p) => Number(p.id)),
    ...[...expensePaymentsByTxn.values()].map((p) => Number(p.id)),
  ]);

  const { summary: skippedSummary, skipped: skippedAccountRows } = buildSkippedAccountRows(
    accountTransactions,
    selectedTxnIds,
    selectedPayIds,
  );

  const validationCtx = {
    branchId,
    sales,
    purchases,
    expenses,
    saleItems,
    purchaseItems,
    salePayments,
    purchasePayments,
    saleIds,
    purchaseIds,
    salePayByTxn,
    purchPayByTxn,
  };
  const validationIssues = runValidations(validationCtx);

  const customerIds = new Set(sales.map((s) => s.customer_id).filter(Boolean));
  const supplierIds = new Set(purchases.map((p) => p.supplier_id).filter(Boolean));
  const productIds = new Set([
    ...saleItems.map((i) => i.product_id),
    ...purchaseItems.map((i) => i.product_id),
  ]);

  const paymentMethodMap = new Map();
  for (const p of [...salePayments, ...purchasePayments]) {
    const m = String(p.method || 'unknown');
    const cur = paymentMethodMap.get(m) || { method: m, count: 0, total: 0 };
    cur.count++;
    cur.total += Number(p.amount) || 0;
    paymentMethodMap.set(m, cur);
  }

  const paymentAccountMap = new Map();
  for (const p of [...salePayments, ...purchasePayments, ...expenses.filter((e) => e.payment_account_id)]) {
    const aid = p.account_id ?? p.payment_account_id;
    if (aid == null || aid === '') continue;
    const id = Number(aid);
    const acct = accountById.get(id);
    const cur = paymentAccountMap.get(id) || { id, name: acct?.name ? String(acct.name) : '', count: 0 };
    cur.count++;
    paymentAccountMap.set(id, cur);
  }

  const stats = {
    sales: { count: sales.length, total: sumField(sales, 'final_total') },
    saleItems: { count: saleItems.length, qty: sumField(saleItems, 'quantity') },
    salePayments: { count: salePayments.length, total: sumField(salePayments, 'amount') },
    purchases: { count: purchases.length, total: sumField(purchases, 'final_total') },
    purchaseItems: { count: purchaseItems.length, qty: sumField(purchaseItems, 'quantity') },
    purchasePayments: { count: purchasePayments.length, total: sumField(purchasePayments, 'amount') },
    expenses: { count: expenses.length, total: sumField(expenses, 'amount') },
    accountTransactionsTotal: accountTransactions.length,
    customers: {
      count: customerIds.size,
      list: [...customerIds].map((id) => {
        const c = contactById.get(id);
        return { id, name: contactLabel(c), mobile: c?.mobile ? String(c.mobile) : '' };
      }),
    },
    suppliers: {
      count: supplierIds.size,
      list: [...supplierIds].map((id) => {
        const c = contactById.get(id);
        return { id, name: contactLabel(c), mobile: c?.mobile ? String(c.mobile) : '' };
      }),
    },
    products: {
      count: productIds.size,
      list: [...productIds].map((id) => {
        const p = catalog.productById.get(id);
        const v = [...catalog.variationById.values()].find((x) => Number(x.product_id) === id);
        const sku = p?.sku ? String(p.sku) : v?.sub_sku ? String(v.sub_sku) : '';
        return { id, sku, name: p?.name ? String(p.name) : '' };
      }),
    },
    paymentMethods: [...paymentMethodMap.values()].sort((a, b) => b.total - a.total),
    paymentAccounts: [...paymentAccountMap.values()].sort((a, b) => a.id - b.id),
  };

  const mapping = {
    blockers: [
      'Target new ERP branch UUID for DIN CHINA (legacy business_locations.id=2)',
      'Map legacy payment methods custom_pay_1/2/3 to new payment_method enum',
      'Map legacy accounts.id payment accounts to new COA accounts',
      'Map legacy contacts.id → new contacts (or match by phone/name)',
      'Map legacy products/variations → new product catalog',
    ],
    items: [
      '**Branch:** legacy `business_locations.id = 2` (`BL0002`, DIN CHINA) → new `branches` row for DIN CHINA',
      '**Company:** legacy `business_id = 1` → target `company_id` in new ERP (not branch id 2)',
      '**Payment methods:** `cash`, `custom_pay_1`, `custom_pay_2`, `custom_pay_3` → cash / bank / wallet in new ERP',
      `**Payment accounts:** legacy ids ${[...paymentAccountMap.keys()].join(', ') || 'none'} → new payment account UUIDs`,
      `**Contacts:** import or match ${stats.customers.count} customers + ${stats.suppliers.count} suppliers before document load`,
      `**Products:** import or match ${stats.products.count} products (parent + variation SKUs) before line items`,
      '**Do not import:** account_transactions, fund transfers, opening balances, manual GL rows',
      '**Outstanding balances:** preserve as partial payment_status on sales/purchases; do not backfill from raw ledger',
    ],
  };

  const risky = {
    skippedDocs,
    skippedOperational: [
      `${accountTransactions.length} account_transactions rows → audit CSV only`,
      `${unlinkedPayments.length} unlinked transaction_payments (advance/contact credits)`,
      'Fund transfers and opening_balance account_transactions excluded',
    ],
    notes: [
      `Sales outstanding AR ≈ ${fmtMoney(stats.sales.total - stats.salePayments.total)} (partial payments expected)`,
      purchases.length
        ? `Purchase outstanding AP ≈ ${fmtMoney(stats.purchases.total - stats.purchasePayments.total)}`
        : 'No purchase outstanding',
      sellReturns.length ? `${sellReturns.length} sell_return document(s) excluded from import set` : 'No sell returns',
    ],
  };

  fs.mkdirSync(outDir, { recursive: true });

  writeCsv(
    path.join(outDir, 'legacy_din_china_sales.csv'),
    Object.keys(sales[0] || {}),
    sales,
  );
  writeCsv(path.join(outDir, 'legacy_din_china_sale_items.csv'), Object.keys(saleItems[0] || {}), saleItems);
  writeCsv(
    path.join(outDir, 'legacy_din_china_sale_payments.csv'),
    Object.keys(salePayments[0] || {}),
    salePayments,
  );
  writeCsv(
    path.join(outDir, 'legacy_din_china_purchases.csv'),
    Object.keys(purchases[0] || {}),
    purchases,
  );
  writeCsv(
    path.join(outDir, 'legacy_din_china_purchase_items.csv'),
    Object.keys(purchaseItems[0] || {}),
    purchaseItems,
  );
  writeCsv(
    path.join(outDir, 'legacy_din_china_purchase_payments.csv'),
    Object.keys(purchasePayments[0] || {}),
    purchasePayments,
  );
  writeCsv(path.join(outDir, 'legacy_din_china_expenses.csv'), Object.keys(expenses[0] || {}), expenses);
  writeCsv(
    path.join(outDir, 'legacy_din_china_skipped_account_transactions.csv'),
    Object.keys(skippedAccountRows[0] || { id: '' }),
    skippedAccountRows,
  );

  const report = buildMarkdownReport({
    branch,
    branchId,
    stats,
    skippedSummary,
    risky,
    mapping,
    validationIssues,
    tables,
    dumpPath,
    analyzedAt: new Date().toISOString(),
    sales,
    saleItems,
    salePayments,
    purchases,
    purchaseItems,
    purchasePayments,
    expenses,
    skippedAccountRows,
  });

  const reportPath = path.join(outDir, 'legacy_din_china_branch_migration_analysis.md');
  fs.writeFileSync(reportPath, report, 'utf8');

  console.log('\n--- DIN CHINA Branch Analysis ---');
  console.log(`Branch: ${branch.location_id} / ${branch.name} (id=${branch.id}, business_id=${branch.business_id})`);
  console.log(`Sales: ${stats.sales.count} (${fmtMoney(stats.sales.total)})`);
  console.log(`Purchases: ${stats.purchases.count} (${fmtMoney(stats.purchases.total)})`);
  console.log(`Expenses: ${stats.expenses.count} (${fmtMoney(stats.expenses.total)})`);
  console.log(`Validation issues: ${validationIssues.length}`);
  console.log(`Report: ${reportPath}`);

  if (validationIssues.length > 0) {
    console.error('\nValidation FAILED:');
    for (const issue of validationIssues) console.error(`  - ${issue}`);
    process.exit(1);
  }

  console.log('\nAll validation checks passed.');
}

main();
