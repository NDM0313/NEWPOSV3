#!/usr/bin/env node
/**
 * Generate idempotent SQL to post cash-book CSV into DIN COLLECTION SHOP CASH 180002.
 * Skips rows whose counterparty code is not in ACCOUNT_MAP.
 */
import fs from 'node:fs';

const COMPANY_ID = 'e08a04af-22a8-4869-9b4d-da31fce13158';
const BRANCH_ID = '7977966a-a7a3-426d-9122-08f8abda6743';
const CASH_ID = '34a421db-1d8b-4ab1-8612-d773e0832247';

const ACCOUNT_MAP = {
  '110076': 'd20b7dc5-032e-475e-84f0-2fffeeecb051',
  '180005': '5ceb6d64-52e6-43c4-81b8-1f825ea1e9df',
  '190001': 'ee1f3d9b-d5c7-43ed-80f7-394aa949e42b',
  '210053': '6c59fc71-9350-4185-82f4-f1a82bf16dea',
  '210054': '84384641-9bd9-4c64-8caa-42783721e65b',
  '210057': 'e2c7c64a-d38e-41e9-8e2a-e59317556bea',
  '210060': 'f85a6e56-f828-4e1b-8256-c9f7f18a0239',
  '210154': '36b925b9-a512-4131-8ae7-cb6507ff55e2',
  '210179': '9e8292cf-a387-4f55-8ad2-febb4cb6b7d8',
};

function parseMoney(s) {
  if (s == null) return 0;
  const t = String(s).replace(/[",\s]/g, '').trim();
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function parseDateDMY(s) {
  const m = String(s || '')
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const header = lines[0].split(',').map((h) => h.trim());
  const idx = (name) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const iNo = idx('No');
  const iDate = idx('DATE');
  const iAcct = idx('ACCOUNT NUMBER');
  const iName = idx('Name');
  const iIn = idx('IN');
  const iOut = idx('OUT');
  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line.trim()) continue;
    const cols = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') {
        inQ = !inQ;
        continue;
      }
      if (ch === ',' && !inQ) {
        cols.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    cols.push(cur);
    const no = String(cols[iNo] ?? '').trim();
    const entryDate = parseDateDMY(cols[iDate]);
    const acct = String(cols[iAcct] ?? '').trim();
    const name = String(cols[iName] ?? '').trim().replace(/'/g, "''");
    const inn = parseMoney(cols[iIn]);
    const outAmt = parseMoney(cols[iOut]);
    if (!entryDate || !acct || (inn <= 0 && outAmt <= 0) || (inn > 0 && outAmt > 0)) continue;
    const side = inn > 0 ? 'IN' : 'OUT';
    const amount = inn > 0 ? inn : outAmt;
    const key = `shop-cash-csv:${no}|${entryDate}|${acct}|${side}|${amount.toFixed(2)}`;
    rows.push({ no, entryDate, acct, name, side, amount, key });
  }
  return rows;
}

function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

const csvPath = process.argv[2];
const outPath = process.argv[3] || 'tmp/shop_cash_csv_post.sql';
const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const skipped = [];
const postable = [];
for (const r of rows) {
  if (!ACCOUNT_MAP[r.acct]) {
    skipped.push(r);
    continue;
  }
  postable.push(r);
}

let sql = `-- SHOP CASH CSV post — DIN COLLECTION
-- postable=${postable.length} skipped=${skipped.length}
BEGIN;
`;

for (const r of postable) {
  const cpId = ACCOUNT_MAP[r.acct];
  const debitId = r.side === 'IN' ? CASH_ID : cpId;
  const creditId = r.side === 'IN' ? cpId : CASH_ID;
  const desc = `Cash book #${r.no} — ${r.name} (${r.side}) [csv:${r.key}]`;
  const payType = r.side === 'IN' ? 'received' : 'paid';
  const refType = r.side === 'IN' ? 'manual_receipt' : 'manual_payment';
  sql += `
-- row ${r.no}
DO $$
DECLARE
  v_je_id uuid;
  v_pay_id uuid;
  v_entry_no text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE company_id = '${COMPANY_ID}'::uuid
      AND description ILIKE '%' || ${sqlStr(`[csv:${r.key}]`)} || '%'
  ) THEN
    RAISE NOTICE 'skip existing %', ${sqlStr(r.key)};
    RETURN;
  END IF;

  v_entry_no := 'JE-CSV-' || ${sqlStr(r.no)} || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  INSERT INTO journal_entries (
    id, company_id, branch_id, entry_no, document_no, entry_date, description,
    reference_type, total_debit, total_credit, is_void, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), '${COMPANY_ID}'::uuid, '${BRANCH_ID}'::uuid, v_entry_no, v_entry_no,
    ${sqlStr(r.entryDate)}::date, ${sqlStr(desc)},
    'journal', ${r.amount}, ${r.amount}, false, now(), now()
  ) RETURNING id INTO v_je_id;

  INSERT INTO journal_entry_lines (id, journal_entry_id, account_id, debit, credit, description)
  VALUES
    (gen_random_uuid(), v_je_id, '${debitId}'::uuid, ${r.amount}, 0, ${sqlStr(desc)}),
    (gen_random_uuid(), v_je_id, '${creditId}'::uuid, 0, ${r.amount}, ${sqlStr(desc)});

  INSERT INTO payments (
    id, company_id, branch_id, payment_type, reference_type, reference_id,
    amount, payment_method, payment_account_id, payment_date, reference_number, notes,
    created_at, updated_at
  ) VALUES (
    gen_random_uuid(), '${COMPANY_ID}'::uuid, '${BRANCH_ID}'::uuid,
    ${sqlStr(payType)}, ${sqlStr(refType)}, v_je_id,
    ${r.amount}, 'cash', '${CASH_ID}'::uuid, ${sqlStr(r.entryDate)}::date, v_entry_no, ${sqlStr(desc)},
    now(), now()
  ) RETURNING id INTO v_pay_id;

  UPDATE journal_entries SET payment_id = v_pay_id WHERE id = v_je_id;
  RAISE NOTICE 'posted % -> %', ${sqlStr(r.no)}, v_entry_no;
END $$;
`;
}

sql += `
COMMIT;
-- skipped missing codes: ${skipped.map((s) => s.acct + '#' + s.no).join(', ')}
`;

fs.writeFileSync(outPath, sql);
console.log(`Wrote ${outPath}: postable=${postable.length} skipped=${skipped.length}`);
fs.writeFileSync(
  outPath.replace(/\.sql$/, '-skipped.json'),
  JSON.stringify(
    skipped.map((s) => ({ no: s.no, code: s.acct, name: s.name, date: s.entryDate, amount: s.amount, side: s.side })),
    null,
    2,
  ),
);
