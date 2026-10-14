#!/usr/bin/env node
/**
 * Clean product import CSV for ERP ImportProductsModal.
 *
 * Usage (from repo root):
 *   node scripts/admin/clean-products-import-csv.mjs [input.csv] [output.csv]
 *
 * Defaults:
 *   input  → OneDrive products_import_sample.csv (if exists) else data/products_import_sample.csv
 *   output → data/products_import_clean.csv
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEFAULT_INPUT = resolve(
  process.env.HOME || process.env.USERPROFILE || '',
  'Library/CloudStorage/OneDrive-Personal/Documents/products_import_sample.csv'
);
const FALLBACK_INPUT = resolve(process.cwd(), 'data/products_import_sample.csv');
const DEFAULT_OUTPUT = resolve(process.cwd(), 'data/products_import_clean.csv');

const FINGERPRINT_FIELDS = [
  'category',
  'subcategory',
  'unit',
  'brand',
  'cost_price',
  'selling_price',
  'opening_stock',
];

function stripBom(input) {
  return input.replace(/^\uFEFF/, '');
}

function parseCsvToMatrix(input) {
  const s = stripBom(input);
  if (!s.trim()) return [];
  const rows = [];
  let row = [];
  let cur = '';
  let inQuotes = false;

  const addField = () => {
    row.push(cur);
    cur = '';
  };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < s.length && s[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      addField();
    } else if (ch === '\r') {
      continue;
    } else if (ch === '\n') {
      addField();
      rows.push(row);
      row = [];
    } else {
      cur += ch;
    }
  }
  addField();
  rows.push(row);
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === '')) rows.pop();
  return rows;
}

function escapeCsvField(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function matrixToCsv(matrix) {
  return matrix.map((row) => row.map(escapeCsvField).join(',')).join('\n') + '\n';
}

function matrixToObjects(matrix) {
  if (matrix.length < 2) return { headers: [], rows: [] };
  const headers = matrix[0].map((h) => h.trim());
  const rows = matrix.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? '';
    });
    return obj;
  });
  return { headers, rows };
}

function objectsToMatrix(headers, rows) {
  return [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
}

function fingerprint(row) {
  return FINGERPRINT_FIELDS.map((f) => String(row[f] ?? '').trim()).join('|');
}

function sellingPrice(row) {
  const n = parseFloat(String(row.selling_price ?? '').trim());
  return Number.isFinite(n) ? n : 0;
}

function isGrandTotal(row) {
  return String(row.name ?? '').trim().toLowerCase().includes('grand total');
}

function cleanRows(rows) {
  const removed = {
    grandTotal: [],
    zeroPrice: [],
    exactDuplicate: [],
  };

  let kept = rows.filter((row) => {
    const sku = String(row.sku ?? '').trim();
    if (isGrandTotal(row)) {
      removed.grandTotal.push(sku || row.name);
      return false;
    }
    if (sellingPrice(row) <= 0) {
      removed.zeroPrice.push(sku || row.name);
      return false;
    }
    return true;
  });

  const byName = new Map();
  for (const row of kept) {
    const key = String(row.name ?? '').trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(row);
  }

  const dropSkus = new Set();
  for (const [, group] of byName) {
    if (group.length < 2) continue;
    const fps = new Set(group.map(fingerprint));
    if (fps.size !== 1) continue;
    const sorted = [...group].sort((a, b) =>
      String(a.sku ?? '').localeCompare(String(b.sku ?? ''), undefined, { numeric: true })
    );
    for (let i = 1; i < sorted.length; i++) {
      dropSkus.add(String(sorted[i].sku ?? '').trim());
      removed.exactDuplicate.push(String(sorted[i].sku ?? '').trim());
    }
  }

  kept = kept.filter((row) => !dropSkus.has(String(row.sku ?? '').trim()));

  const dupNameGroups = [...byName.values()].filter((g) => g.length > 1).length;
  let remainingDupNames = 0;
  for (const [, group] of byName) {
    const surviving = group.filter((r) => !dropSkus.has(String(r.sku ?? '').trim()));
    if (surviving.length > 1) remainingDupNames++;
  }

  return { kept, removed, dupNameGroups, remainingDupNames };
}

function main() {
  const inputArg = process.argv[2];
  const outputArg = process.argv[3];
  let inputPath = inputArg ? resolve(inputArg) : DEFAULT_INPUT;
  if (!inputArg && !existsSync(inputPath)) {
    inputPath = FALLBACK_INPUT;
  }
  const outputPath = outputArg ? resolve(outputArg) : DEFAULT_OUTPUT;

  if (!existsSync(inputPath)) {
    console.error('Input CSV not found:', inputPath);
    process.exit(1);
  }

  const raw = readFileSync(inputPath, 'utf8');
  const matrix = parseCsvToMatrix(raw);
  const { headers, rows } = matrixToObjects(matrix);
  if (!rows.length) {
    console.error('No data rows in input CSV');
    process.exit(1);
  }

  const { kept, removed, dupNameGroups, remainingDupNames } = cleanRows(rows);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, matrixToCsv(objectsToMatrix(headers, kept)), 'utf8');

  const zeroPriceRemaining = kept.filter((r) => sellingPrice(r) <= 0).length;
  const skus = new Set(kept.map((r) => String(r.sku ?? '').trim().toLowerCase()).filter(Boolean));

  console.log('Product CSV cleanup report');
  console.log('  Input: ', inputPath);
  console.log('  Output:', outputPath);
  console.log('  Input rows:              ', rows.length);
  console.log('  Removed GRAND TOTAL:     ', removed.grandTotal.length, removed.grandTotal.join(', '));
  console.log('  Removed zero price:      ', removed.zeroPrice.length, removed.zeroPrice.join(', '));
  console.log('  Removed exact dup SKU:   ', removed.exactDuplicate.length);
  console.log('  Output rows:             ', kept.length);
  console.log('  Unique SKUs:             ', skus.size);
  console.log('  Name groups with 2+ rows:', dupNameGroups, '(same-name-different-data kept:', remainingDupNames, ')');
  console.log('  Zero price remaining:    ', zeroPriceRemaining);

  if (zeroPriceRemaining > 0) {
    console.error('ERROR: cleaned CSV still has invalid selling_price rows');
    process.exit(1);
  }
}

main();
