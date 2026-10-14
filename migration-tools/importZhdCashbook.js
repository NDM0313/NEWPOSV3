#!/usr/bin/env node
/**
 * Import zhd_ready cashbook (DIN+CHINA excluded) into target company using
 * account_nature_mapping_compiled.json + zhd_account_transactions.tsv
 *
 * Usage:
 *   node migration-tools/importZhdCashbook.js --dry-run --target-company-id <uuid>
 *   node migration-tools/importZhdCashbook.js --confirm --target-company-id <uuid>
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { batchUpsert } from './lib/batchUpsert.js';
import { legacyToUuid } from './lib/legacyId.js';
import { loadMigrationEnv } from './lib/loadMigrationEnv.js';

const NS_ACC = 'zhd_cashbook_account';
const NS_CONTACT = 'zhd_cashbook_contact';
const NS_JE = 'zhd_cashbook_je';
const NS_LINE = 'zhd_cashbook_line';
const BRANCH_MAIN = '7977966a-a7a3-426d-9122-08f8abda6743';
const OPENING_LEGACY_ID = 'OPENING_EQUITY';
const ADJUST_LEGACY_ID = 'ADJUSTMENT';

function readJson(p) {
  const raw = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function uuid(ns, id) {
  return legacyToUuid(ns, id);
}

function lineId(jeId, idx) {
  const hex = createHash('sha256').update(`${NS_LINE}:${jeId}:${idx}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function toDate(v) {
  const s = String(v || '').trim();
  if (!s || s.startsWith('0000-00-00')) return null;
  return s.slice(0, 10);
}

function toTs(v) {
  const s = String(v || '').trim();
  if (!s || s.startsWith('0000-00-00')) return null;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(s)) {
    return s.replace(' ', 'T').replace(/Z?$/, '') + 'Z';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00Z`;
  return null;
}

function loadTransactions(filePath) {
  if (filePath.endsWith('.json')) {
    const arr = readJson(filePath);
    return arr.map((r) => ({
      id: Number(r.id),
      account_id: Number(r.account_id),
      type: String(r.type || '').toLowerCase(),
      sub_type: r.sub_type == null || r.sub_type === '' ? null : String(r.sub_type).toLowerCase(),
      amount: Math.abs(Number(r.amount) || 0),
      reff_no: r.reff_no ?? null,
      operation_date: r.operation_date,
      transfer_transaction_id: Number(r.transfer_transaction_id) || 0,
      note: r.note == null ? '' : String(r.note),
      created_at: r.created_at,
    }));
  }
  throw new Error(`Unsupported txn file (use .json): ${filePath}`);
}

function natureToErp(nature) {
  switch (nature) {
    case 'cash':
      return { type: 'cash', parentCode: '1050', codePrefix: '18' };
    case 'bank':
      return { type: 'bank', parentCode: '1060', codePrefix: '19' };
    case 'supplier':
      return { type: 'payable', parentCode: '2090', codePrefix: '21', contactType: 'supplier' };
    case 'client':
      return { type: 'receivable', parentCode: '1100', codePrefix: '11', contactType: 'customer' };
    case 'courier':
      return { type: 'payable', parentCode: '2030', codePrefix: '203', contactType: 'supplier' };
    case 'expense':
    case 'home_exp':
    case 'zakat':
      return { type: 'expense', parentCode: '6090', codePrefix: '62' };
    case 'property':
      return { type: 'asset', parentCode: '1050', codePrefix: '13' };
    case 'adjustment':
      return { type: 'expense', parentCode: '6090', codePrefix: '627', special: 'adjustment' };
    case 'other':
      return { type: 'asset', parentCode: '1050', codePrefix: '14' };
    case 'skip':
      return { type: 'skip' };
    default:
      return { type: 'asset', parentCode: '1050', codePrefix: '14' };
  }
}

function accountCode(nature, legacyId) {
  const meta = natureToErp(nature);
  if (meta.special === 'adjustment') return '6270';
  const id = String(legacyId).padStart(4, '0');
  return `${meta.codePrefix}${id}`.slice(0, 12);
}

async function loadParentMap(supabase, companyId) {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, code, name, type')
    .eq('company_id', companyId);
  if (error) throw error;
  const byCode = new Map((data || []).map((a) => [String(a.code), a]));
  return byCode;
}

function buildContactRow(acc, companyId) {
  const meta = natureToErp(acc.nature);
  if (!meta.contactType) return null;
  const id = uuid(NS_CONTACT, acc.legacy_id);
  const prefix = meta.contactType === 'customer' ? 'CUS-ZHD' : 'SUP-ZHD';
  return {
    id,
    company_id: companyId,
    type: meta.contactType,
    name: String(acc.account_name || '').trim().replace(/\n/g, ' '),
    phone: null,
    email: null,
    city: null,
    address: null,
    country: null,
    opening_balance: 0,
    credit_limit: null,
    is_active: acc.is_closed !== 'yes',
    code: `${prefix}-${String(acc.legacy_id).padStart(4, '0')}`,
    is_default: false,
    is_system_generated: false,
    system_type: null,
  };
}

function buildAccountRow(acc, companyId, parentByCode, contactIdByLegacy) {
  const meta = natureToErp(acc.nature);
  if (meta.type === 'skip') return null;
  const parent = parentByCode.get(meta.parentCode) || null;
  const linked = contactIdByLegacy.get(Number(acc.legacy_id)) || null;
  return {
    id: uuid(NS_ACC, acc.legacy_id),
    company_id: companyId,
    code: accountCode(acc.nature, acc.legacy_id),
    name: String(acc.account_name || '').trim().replace(/\n/g, ' '),
    type: meta.type,
    parent_id: parent?.id ?? null,
    balance: 0,
    is_group: false,
    linked_contact_id: linked,
    is_active: acc.is_closed !== 'yes',
    description: `Imported from ZHD cashbook #${acc.legacy_id} (${acc.nature})`,
  };
}

function buildSystemAccounts(companyId, parentByCode) {
  const equityParent = parentByCode.get('3090') || parentByCode.get('3000');
  const expenseParent = parentByCode.get('6090');
  return [
    {
      id: uuid(NS_ACC, OPENING_LEGACY_ID),
      company_id: companyId,
      code: '3095',
      name: 'Opening Balance Equity (Imported)',
      type: 'equity',
      parent_id: equityParent?.id ?? null,
      balance: 0,
      is_group: false,
      linked_contact_id: null,
      is_active: true,
      description: 'Contra for legacy opening_balance cashbook rows',
    },
    {
      id: uuid(NS_ACC, ADJUST_LEGACY_ID),
      company_id: companyId,
      code: '6270',
      name: 'Account Adjustment (Imported)',
      type: 'expense',
      parent_id: expenseParent?.id ?? null,
      balance: 0,
      is_group: false,
      linked_contact_id: null,
      is_active: true,
      description: 'COA standard landing for legacy MISSING / bank-cash adjustments',
    },
  ];
}

function resolveAccountUuid(legacyAccountId, natureByLegacy, accountUuidByLegacy) {
  const nature = natureByLegacy.get(Number(legacyAccountId));
  if (nature === 'skip') return null;
  if (nature === 'adjustment') return uuid(NS_ACC, ADJUST_LEGACY_ID);
  return accountUuidByLegacy.get(Number(legacyAccountId)) || null;
}

function buildJournals(txns, natureByLegacy, accountUuidByLegacy) {
  const byId = new Map(txns.map((t) => [t.id, t]));
  const seenPairs = new Set();
  const journals = [];
  const stats = {
    pairs: 0,
    openings: 0,
    skippedSkipSide: 0,
    skippedUnmapped: 0,
    skippedUnbalanced: 0,
    unpairedLeft: 0,
  };

  const openingEquityId = uuid(NS_ACC, OPENING_LEGACY_ID);

  for (const t of txns) {
    if (t.sub_type === 'opening_balance') {
      const accId = resolveAccountUuid(t.account_id, natureByLegacy, accountUuidByLegacy);
      if (!accId) {
        stats.skippedSkipSide += 1;
        continue;
      }
      const amount = t.amount;
      if (amount <= 0) continue;
      const entryDate = toDate(t.operation_date) || '2023-10-01';
      const jeId = uuid(NS_JE, `ob:${t.id}`);
      const desc = (t.note || `Opening balance #${t.id}`).slice(0, 500);
      let debitLine;
      let creditLine;
      if (t.type === 'debit') {
        debitLine = { account_id: accId, debit: amount, credit: 0 };
        creditLine = { account_id: openingEquityId, debit: 0, credit: amount };
      } else {
        debitLine = { account_id: openingEquityId, debit: amount, credit: 0 };
        creditLine = { account_id: accId, debit: 0, credit: amount };
      }
      journals.push({
        entry: {
          id: jeId,
          company_id: null, // filled later
          branch_id: BRANCH_MAIN,
          entry_no: `ZHD-OB-${t.id}`,
          entry_date: entryDate,
          description: desc,
          reference_type: 'opening_balance',
          reference_id: null,
          payment_id: null,
          total_debit: amount,
          total_credit: amount,
          is_posted: true,
          posted_at: toTs(t.created_at) || `${entryDate}T00:00:00Z`,
          is_void: false,
          created_at: toTs(t.created_at),
        },
        lines: [debitLine, creditLine],
      });
      stats.openings += 1;
      continue;
    }

    const partnerId = t.transfer_transaction_id;
    if (!partnerId || partnerId <= 0) {
      stats.unpairedLeft += 1;
      continue;
    }
    const a = Math.min(t.id, partnerId);
    const b = Math.max(t.id, partnerId);
    const pairKey = `${a}:${b}`;
    if (seenPairs.has(pairKey)) continue;
    seenPairs.add(pairKey);

    const left = byId.get(a);
    const right = byId.get(b);
    if (!left || !right) {
      stats.skippedUnmapped += 1;
      continue;
    }

    const leftAcc = resolveAccountUuid(left.account_id, natureByLegacy, accountUuidByLegacy);
    const rightAcc = resolveAccountUuid(right.account_id, natureByLegacy, accountUuidByLegacy);
    if (!leftAcc || !rightAcc) {
      stats.skippedSkipSide += 1;
      continue;
    }

    const amount = left.amount || right.amount;
    if (amount <= 0) continue;
    if (Math.abs(left.amount - right.amount) > 0.0001) {
      stats.skippedUnbalanced += 1;
      continue;
    }

    const entryDate = toDate(left.operation_date) || toDate(right.operation_date) || '2023-10-01';
    const jeId = uuid(NS_JE, `pair:${a}:${b}`);
    const refType =
      left.sub_type === 'deposit' || right.sub_type === 'deposit' ? 'deposit' : 'transfer';
    const desc = (left.note || right.note || `${refType} ${a}/${b}`).slice(0, 500);

    // Build lines from each side's debit/credit
    const lines = [];
    for (const side of [left, right]) {
      const accId = resolveAccountUuid(side.account_id, natureByLegacy, accountUuidByLegacy);
      if (side.type === 'debit') lines.push({ account_id: accId, debit: side.amount, credit: 0 });
      else lines.push({ account_id: accId, debit: 0, credit: side.amount });
    }
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      stats.skippedUnbalanced += 1;
      continue;
    }

    journals.push({
      entry: {
        id: jeId,
        company_id: null,
        branch_id: BRANCH_MAIN,
        entry_no: `ZHD-${refType === 'deposit' ? 'DP' : 'FT'}-${a}`,
        entry_date: entryDate,
        description: desc,
        reference_type: refType,
        reference_id: null,
        payment_id: null,
        total_debit: totalDebit,
        total_credit: totalCredit,
        is_posted: true,
        posted_at: toTs(left.created_at) || `${entryDate}T00:00:00Z`,
        is_void: false,
        created_at: toTs(left.created_at),
      },
      lines,
    });
    stats.pairs += 1;
  }

  return { journals, stats };
}

async function main() {
  const env = loadMigrationEnv(process.argv.slice(2));
  const companyId = env.targetCompanyId;
  const outDir = env.outputDir;
  const mapPath = path.join(outDir, 'account_nature_mapping_compiled.json');
  const txnJson = path.join(outDir, 'zhd_account_transactions.json');

  if (!fs.existsSync(mapPath)) throw new Error(`Missing ${mapPath}`);
  if (!fs.existsSync(txnJson)) throw new Error(`Missing ${txnJson}`);

  const compiled = readJson(mapPath);
  const accountsMeta = (compiled.accounts || []).filter((a) => a.nature !== 'skip');
  const natureByLegacy = new Map(
    (compiled.accounts || []).map((a) => [Number(a.legacy_id), a.nature])
  );

  console.log(`Loading transactions: ${txnJson}`);
  const txns = loadTransactions(txnJson);
  console.log(`Transactions: ${txns.length}`);
  console.log(`Mapped accounts (non-skip): ${accountsMeta.length}`);

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: company, error: cErr } = await supabase
    .from('companies')
    .select('id, name')
    .eq('id', companyId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!company) throw new Error(`Company not found: ${companyId}`);
  console.log(`Target: ${company.name} (${company.id})`);

  const parentByCode = env.dryRun
    ? new Map([
        ['1050', { id: 'dry-1050' }],
        ['1060', { id: 'dry-1060' }],
        ['1100', { id: 'dry-1100' }],
        ['2030', { id: 'dry-2030' }],
        ['2090', { id: 'dry-2090' }],
        ['3000', { id: 'dry-3000' }],
        ['3090', { id: 'dry-3090' }],
        ['6090', { id: 'dry-6090' }],
      ])
    : await loadParentMap(supabase, companyId);

  const contactRows = [];
  const contactIdByLegacy = new Map();
  for (const acc of accountsMeta) {
    const c = buildContactRow(acc, companyId);
    if (c) {
      contactRows.push(c);
      contactIdByLegacy.set(Number(acc.legacy_id), c.id);
    }
  }

  const accountRows = [];
  const accountUuidByLegacy = new Map();
  for (const acc of accountsMeta) {
    if (acc.nature === 'adjustment') {
      // use system adjustment account
      accountUuidByLegacy.set(Number(acc.legacy_id), uuid(NS_ACC, ADJUST_LEGACY_ID));
      continue;
    }
    const row = buildAccountRow(acc, companyId, parentByCode, contactIdByLegacy);
    if (row) {
      accountRows.push(row);
      accountUuidByLegacy.set(Number(acc.legacy_id), row.id);
    }
  }
  const systemAccounts = buildSystemAccounts(companyId, parentByCode);
  for (const s of systemAccounts) {
    // dedupe by code if adjustment already in rows
    if (!accountRows.some((a) => a.code === s.code)) accountRows.push(s);
  }

  const { journals, stats } = buildJournals(txns, natureByLegacy, accountUuidByLegacy);
  for (const j of journals) j.entry.company_id = companyId;

  const entryRows = journals.map((j) => j.entry);
  const lineRows = journals.flatMap((j) =>
    j.lines.map((line, idx) => ({
      id: lineId(j.entry.id, idx),
      journal_entry_id: j.entry.id,
      account_id: line.account_id,
      debit: line.debit,
      credit: line.credit,
      description: j.entry.description,
    }))
  );

  const report = {
    companyId,
    companyName: company.name,
    dryRun: env.dryRun,
    contacts: contactRows.length,
    accounts: accountRows.length,
    journalEntries: entryRows.length,
    journalLines: lineRows.length,
    txnStats: stats,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'zhd_cashbook_import_report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (env.dryRun) {
    console.log('Dry-run only — no writes.');
    return;
  }

  console.log('Uploading contacts...');
  await batchUpsert(supabase, 'contacts', contactRows, {
    batchSize: env.batchSize,
    label: 'contacts',
  });

  console.log('Uploading accounts...');
  await batchUpsert(supabase, 'accounts', accountRows, {
    batchSize: env.batchSize,
    label: 'accounts',
  });

  console.log('Uploading journal entries...');
  await batchUpsert(supabase, 'journal_entries', entryRows, {
    batchSize: Math.min(env.batchSize, 50),
    label: 'journal_entries',
  });

  console.log('Uploading journal lines...');
  await batchUpsert(supabase, 'journal_entry_lines', lineRows, {
    batchSize: Math.min(env.batchSize, 100),
    label: 'journal_entry_lines',
  });

  console.log('Import complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
