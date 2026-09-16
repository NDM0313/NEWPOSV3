import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(path.dirname(fileURLToPath(import.meta.url))), '..');

export const EXPECTED_TOTALS = {
  sales: { count: 34, amount: 28343979 },
  saleItems: { count: 63 },
  salePayments: { count: 70, amount: 8416540 },
  purchases: { count: 1, amount: 67978418.4 },
  purchaseItems: { count: 17 },
  purchasePayments: { count: 4, amount: 65916440 },
  expenses: { count: 4, amount: 88000 },
};

export const CSV_FILES = {
  sales: 'legacy_din_china_sales.csv',
  saleItems: 'legacy_din_china_sale_items.csv',
  salePayments: 'legacy_din_china_sale_payments.csv',
  purchases: 'legacy_din_china_purchases.csv',
  purchaseItems: 'legacy_din_china_purchase_items.csv',
  purchasePayments: 'legacy_din_china_purchase_payments.csv',
  expenses: 'legacy_din_china_expenses.csv',
};

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Simple CSV parser for review files (no multiline fields expected). */
export function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] ?? '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

export function loadAllCsvData(csvDir = REPO_ROOT) {
  const data = {};
  const paths = {};
  for (const [key, filename] of Object.entries(CSV_FILES)) {
    const fp = path.join(csvDir, filename);
    if (!fs.existsSync(fp)) {
      throw new Error(`Missing CSV: ${fp}`);
    }
    paths[key] = fp;
    data[key] = readCsv(fp);
  }
  return { data, paths, csvDir };
}

function num(v) {
  return Number(v) || 0;
}

export function validateCsvTotals(data) {
  const errors = [];
  const sales = data.sales.rows;
  const saleItems = data.saleItems.rows;
  const salePayments = data.salePayments.rows;
  const purchases = data.purchases.rows;
  const purchaseItems = data.purchaseItems.rows;
  const purchasePayments = data.purchasePayments.rows;
  const expenses = data.expenses.rows;

  const checks = [
    { label: 'sales count', actual: sales.length, expected: EXPECTED_TOTALS.sales.count },
    {
      label: 'sales total',
      actual: sales.reduce((s, r) => s + num(r.final_total), 0),
      expected: EXPECTED_TOTALS.sales.amount,
      tolerance: 0.01,
    },
    { label: 'sale items count', actual: saleItems.length, expected: EXPECTED_TOTALS.saleItems.count },
    { label: 'sale payments count', actual: salePayments.length, expected: EXPECTED_TOTALS.salePayments.count },
    {
      label: 'sale payments total',
      actual: salePayments.reduce((s, r) => s + num(r.amount), 0),
      expected: EXPECTED_TOTALS.salePayments.amount,
      tolerance: 0.01,
    },
    { label: 'purchases count', actual: purchases.length, expected: EXPECTED_TOTALS.purchases.count },
    {
      label: 'purchases total',
      actual: purchases.reduce((s, r) => s + num(r.final_total), 0),
      expected: EXPECTED_TOTALS.purchases.amount,
      tolerance: 0.01,
    },
    { label: 'purchase items count', actual: purchaseItems.length, expected: EXPECTED_TOTALS.purchaseItems.count },
    {
      label: 'purchase payments count',
      actual: purchasePayments.length,
      expected: EXPECTED_TOTALS.purchasePayments.count,
    },
    {
      label: 'purchase payments total',
      actual: purchasePayments.reduce((s, r) => s + num(r.amount), 0),
      expected: EXPECTED_TOTALS.purchasePayments.amount,
      tolerance: 0.01,
    },
    { label: 'expenses count', actual: expenses.length, expected: EXPECTED_TOTALS.expenses.count },
    {
      label: 'expenses total',
      actual: expenses.reduce((s, r) => s + num(r.amount), 0),
      expected: EXPECTED_TOTALS.expenses.amount,
      tolerance: 0.01,
    },
  ];

  for (const c of checks) {
    const tol = c.tolerance ?? 0;
    if (Math.abs(c.actual - c.expected) > tol) {
      errors.push(`${c.label}: expected ${c.expected}, got ${c.actual}`);
    }
  }

  for (const s of sales) {
    if (Number(s.location_id) !== 2) {
      errors.push(`Sale ${s.legacy_transaction_id} has location_id=${s.location_id} (expected 2)`);
    }
  }
  for (const p of purchases) {
    if (Number(p.location_id) !== 2) {
      errors.push(`Purchase ${p.legacy_transaction_id} has location_id=${p.location_id} (expected 2)`);
    }
  }
  for (const e of expenses) {
    if (Number(e.location_id) !== 2) {
      errors.push(`Expense ${e.legacy_transaction_id} has location_id=${e.location_id} (expected 2)`);
    }
  }

  const saleTxnIds = new Set(sales.map((r) => String(r.legacy_transaction_id)));
  for (const p of salePayments) {
    if (!saleTxnIds.has(String(p.transaction_id))) {
      errors.push(`Sale payment ${p.payment_id} not linked to a sale in CSV (txn ${p.transaction_id})`);
    }
  }

  const purchTxnIds = new Set(purchases.map((r) => String(r.legacy_transaction_id)));
  for (const p of purchasePayments) {
    if (!purchTxnIds.has(String(p.transaction_id))) {
      errors.push(`Purchase payment ${p.payment_id} not linked to purchase CSV (txn ${p.transaction_id})`);
    }
  }

  return { errors, computed: Object.fromEntries(checks.map((c) => [c.label, c.actual])) };
}

export function collectUniqueContacts(data) {
  const customers = new Map();
  for (const s of data.sales.rows) {
    const id = String(s.customer_id);
    if (!customers.has(id)) {
      customers.set(id, {
        legacyContactId: Number(s.customer_id),
        name: s.customer_name,
        phone: s.customer_mobile,
        type: 'customer',
      });
    }
  }
  const suppliers = new Map();
  for (const p of data.purchases.rows) {
    const id = String(p.supplier_id);
    if (!suppliers.has(id)) {
      suppliers.set(id, {
        legacyContactId: Number(p.supplier_id),
        name: p.supplier_name,
        phone: p.supplier_mobile,
        type: 'supplier',
      });
    }
  }
  return { customers: [...customers.values()], suppliers: [...suppliers.values()] };
}

export function collectUniqueProducts(data) {
  const byKey = new Map();
  for (const line of [...data.saleItems.rows, ...data.purchaseItems.rows]) {
    const key = `${line.product_id}:${line.variation_id}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        legacyProductId: Number(line.product_id),
        legacyVariationId: Number(line.variation_id),
        sku: line.sku,
        productName: line.product_name,
      });
    }
  }
  return [...byKey.values()];
}

export function collectLegacyAccountIds(data) {
  const ids = new Set();
  for (const p of [...data.salePayments.rows, ...data.purchasePayments.rows]) {
    if (p.account_id != null && String(p.account_id).trim() !== '') {
      ids.add(Number(p.account_id));
    }
  }
  for (const e of data.expenses.rows) {
    if (e.payment_account_id != null && String(e.payment_account_id).trim() !== '') {
      ids.add(Number(e.payment_account_id));
    }
  }
  return [...ids].sort((a, b) => a - b);
}
