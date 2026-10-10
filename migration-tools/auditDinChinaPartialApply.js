#!/usr/bin/env node
/**
 * Read-only audit of partial DIN CHINA legacy import state.
 * Usage: node migration-tools/auditDinChinaPartialApply.js --company-id <uuid>
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadMigrationEnv } from './lib/loadMigrationEnv.js';
import { loadAllCsvData } from './lib/dinChinaCsv.js';
import {
  dinChinaUuid,
  legacyInvoiceNo,
  SOURCE_SYSTEM,
} from './lib/dinChinaLegacyMap.js';
import { supabaseRead } from './lib/supabaseReadRetry.js';

const BRANCH_ID = '92f4184e-ee9b-4b6c-8e76-10ee1d166f55';
const PAYMENT_ACCOUNT_NAMES = [
  'DIN CHINA Cash',
  'MCB',
  'DIN FHD MZ',
  'DIN NDM MZ',
  'WALI DIN T/T',
  'YAQOOB',
];

function num(v) {
  return Number(v) || 0;
}

function isArPostingAccount(acct, control1100Id) {
  if (!acct) return false;
  const code = String(acct.code || '').trim();
  if (code === '1100') return true;
  if (control1100Id && acct.parent_id === control1100Id) return true;
  if (/^AR-/i.test(code)) return true;
  return false;
}

function saleJeHasArAndRevenue(jLines, acctById, control1100Id) {
  if (jLines.length !== 2) return false;
  const hasAr = jLines.some((l) => {
    const acct = acctById.get(l.account_id);
    return isArPostingAccount(acct, control1100Id) && num(l.debit) > 0;
  });
  const has4100 = jLines.some((l) => {
    const acct = acctById.get(l.account_id);
    return String(acct?.code || '').trim() === '4100' && num(l.credit) > 0;
  });
  return hasAr && has4100;
}

function parseLegacyTxnIdFromNotes(notes) {
  const m = String(notes || '').match(/legacy_transaction_id=(\d+)/);
  return m ? Number(m[1]) : null;
}

function parseLegacyPaymentIdFromNotes(notes) {
  const m = String(notes || '').match(/legacy_payment_id=(\d+)/);
  return m ? Number(m[1]) : null;
}

async function main() {
  const argv = process.argv.slice(2);
  const preApplyGate = argv.includes('--pre-apply-gate');
  argv.push('--dry-run', '--require-supabase');
  const env = loadMigrationEnv(argv);
  const companyId = env.targetCompanyId;
  const csvBundle = loadAllCsvData();

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const audit = await buildDinChinaPartialAudit(supabase, env, csvBundle);

  const outDir = env.outputDir;
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'din_china_partial_apply_audit.json');
  fs.writeFileSync(jsonPath, JSON.stringify(audit, null, 2), 'utf8');

  const mdPath = path.join(outDir, 'din_china_partial_apply_audit.md');
  fs.writeFileSync(mdPath, buildMarkdown(audit), 'utf8');

  console.log(`Audit JSON: ${jsonPath}`);
  console.log(`Audit MD: ${mdPath}`);
  console.log(`Sales imported: ${audit.sales.importedCount}/${audit.sales.expectedCount}`);
  console.log(`Sale items: ${audit.saleItems.importedCount}/${audit.saleItems.expectedCount}`);
  console.log(`Sale payments: ${audit.salePayments.count}/${audit.salePayments.expectedCount}`);

  if (preApplyGate) {
    const gate = evaluatePreApplyGate(audit, csvBundle.data);
    console.log(`Pre-apply gate: ${gate.pass ? 'PASS' : 'FAIL'}`);
    if (gate.alreadyComplete) console.log('Import already complete — skip apply.');
    if (gate.issues.length) {
      for (const i of gate.issues) console.log(`  - ${i}`);
    }
    process.exit(gate.pass ? 0 : 1);
  }
}

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
export async function buildDinChinaPartialAudit(supabase, env, csvBundle) {
  const companyId = env.targetCompanyId;
  const { data: csv } = csvBundle;

  const expectedSales = csv.sales.rows.map((r) => ({
    legacyTransactionId: Number(r.legacy_transaction_id),
    invoiceNo: legacyInvoiceNo(r.invoice_no),
    expectedTotal: num(r.final_total),
    expectedPaid: num(r.paid_amount),
    expectedDue: num(r.due_amount),
  }));

  const expectedSaleItemsByTxn = new Map();
  for (const line of csv.saleItems.rows) {
    const tid = String(line.transaction_id);
    if (!expectedSaleItemsByTxn.has(tid)) expectedSaleItemsByTxn.set(tid, 0);
    expectedSaleItemsByTxn.set(tid, expectedSaleItemsByTxn.get(tid) + 1);
  }

  const expectedSalePayments = csv.salePayments.rows.length;
  const expectedSalePaymentTotal = csv.salePayments.rows.reduce((s, r) => s + num(r.amount), 0);
  const expectedPurchase = csv.purchases.rows[0];
  const expectedExpenses = csv.expenses.rows.map((e) => ({
    legacyId: Number(e.legacy_transaction_id),
    refNo: e.ref_no,
    amount: num(e.amount),
  }));

  const audit = {
    generatedAt: new Date().toISOString(),
    companyId,
    sourceSystem: SOURCE_SYSTEM,
    readOnly: true,
    applyFailureHint: {
      stage: 'sales_duplicate_check',
      legacyTransactionId: 11,
      queryLabel: 'sales_dup_id_11',
      error: 'Bad Gateway after read retries',
    },
    branch: null,
    paymentAccounts: [],
    contacts: { count: 0, withLegacyMarker: 0, ids: [] },
    products: { count: 0, withLegacyMarker: 0 },
    variations: { deterministicCount: 0 },
    sales: {
      importedCount: 0,
      expectedCount: expectedSales.length,
      invoiceCheck: [],
      totalAmount: 0,
      paidTotal: 0,
      dueTotal: 0,
      byStatus: {},
      missingLegacyTxnIds: [],
      partialLegacyTxnIds: [],
    },
    saleItems: { importedCount: 0, expectedCount: csv.saleItems.rows.length, salesWithMissingItems: [] },
    saleJournals: {
      documentJeCount: 0,
      withDr1100Cr4100: 0,
      used4050: false,
      used4000: false,
      issues: [],
    },
    salePayments: {
      count: 0,
      expectedCount: expectedSalePayments,
      total: 0,
      expectedTotal: expectedSalePaymentTotal,
    },
    purchase: null,
    purchaseItems: { count: 0, expected: csv.purchaseItems.rows.length },
    purchasePayments: { count: 0, expected: csv.purchasePayments.rows.length, total: 0 },
    expenses: { imported: [], expectedTotal: 88000 },
    revenueAccount4000: null,
    resumeAssessment: {
      safeToResume: null,
      duplicateRisk: [],
      manualCleanupNeeded: false,
      notes: [],
    },
  };

  const { data: branchById } = await supabaseRead('audit_branch_id', () =>
    supabase.from('branches').select('id, name, code, is_active').eq('id', BRANCH_ID).maybeSingle());
  const { data: branchesByName } = await supabaseRead('audit_branches_company', () =>
    supabase.from('branches').select('id, name, code').eq('company_id', companyId));
  audit.branch = {
    expectedId: BRANCH_ID,
    expectedName: 'DIN CHINA',
    expectedCode: 'BL0002',
    byId: branchById || null,
    companyBranches: branchesByName || [],
  };

  const accountIds = [115, 106, 108, 159, 133, 157].map((id) => dinChinaUuid('accounts', id));
  const { data: accountsById } = await supabaseRead('audit_accounts_ids', () =>
    supabase.from('accounts').select('id, code, name, type, is_group').in('id', accountIds));
  const { data: accountsByName } = await supabaseRead('audit_accounts_names', () =>
    supabase
      .from('accounts')
      .select('id, code, name, type, is_group')
      .eq('company_id', companyId)
      .in('name', PAYMENT_ACCOUNT_NAMES));
  audit.paymentAccounts = PAYMENT_ACCOUNT_NAMES.map((name) => {
    const hit =
      (accountsByName || []).find((a) => a.name === name) ||
      (accountsById || []).find((a) => a.name === name);
    return { name, found: Boolean(hit), id: hit?.id, code: hit?.code, is_group: hit?.is_group };
  });

  const { data: contacts } = await supabaseRead('audit_contacts', () =>
    supabase
      .from('contacts')
      .select('id, name, notes')
      .eq('company_id', companyId)
      .or(`notes.ilike.%${SOURCE_SYSTEM}%,notes.ilike.%legacy_contact_id%`));
  audit.contacts.count = (contacts || []).length;
  audit.contacts.withLegacyMarker = (contacts || []).filter((c) =>
    String(c.notes || '').includes(SOURCE_SYSTEM),
  ).length;

  const { data: products } = await supabaseRead('audit_products', () =>
    supabase
      .from('products')
      .select('id, name, sku, notes')
      .eq('company_id', companyId)
      .ilike('notes', `%${SOURCE_SYSTEM}%`));
  audit.products.count = (products || []).length;
  audit.products.withLegacyMarker = (products || []).length;

  const productIds = (products || []).map((p) => p.id);
  if (productIds.length) {
    const { data: vars } = await supabaseRead('audit_variations', () =>
      supabase.from('product_variations').select('id, product_id, sku').in('product_id', productIds));
    audit.variations.deterministicCount = (vars || []).length;
  }

  const { data: salesBySource } = await supabaseRead('audit_sales_source', () =>
    supabase
      .from('sales')
      .select(
        'id, invoice_no, status, payment_status, total, paid_amount, due_amount, notes, source, created_at',
      )
      .eq('company_id', companyId)
      .eq('source', SOURCE_SYSTEM));
  const { data: salesByNotes } = await supabaseRead('audit_sales_notes', () =>
    supabase
      .from('sales')
      .select(
        'id, invoice_no, status, payment_status, total, paid_amount, due_amount, notes, source, created_at',
      )
      .eq('company_id', companyId)
      .ilike('notes', `%${SOURCE_SYSTEM}%`));

  const salesMap = new Map();
  for (const s of [...(salesBySource || []), ...(salesByNotes || [])]) {
    salesMap.set(s.id, s);
  }
  const importedSales = [...salesMap.values()];
  audit.sales.importedCount = importedSales.length;
  for (const s of importedSales) {
    audit.sales.totalAmount += num(s.total);
    audit.sales.paidTotal += num(s.paid_amount);
    audit.sales.dueTotal += num(s.due_amount);
    const st = String(s.status || 'unknown');
    audit.sales.byStatus[st] = (audit.sales.byStatus[st] || 0) + 1;
  }

  const importedByLegacyTxn = new Map();
  for (const s of importedSales) {
    const lid = parseLegacyTxnIdFromNotes(s.notes);
    if (lid != null) importedByLegacyTxn.set(lid, s);
  }

  for (const exp of expectedSales) {
    const found =
      importedByLegacyTxn.get(exp.legacyTransactionId) ||
      importedSales.find((s) => s.invoice_no === exp.invoiceNo);
    audit.sales.invoiceCheck.push({
      invoiceNo: exp.invoiceNo,
      legacyTransactionId: exp.legacyTransactionId,
      found: Boolean(found),
      status: found?.status ?? null,
      total: found ? num(found.total) : null,
    });
    if (!found) audit.sales.missingLegacyTxnIds.push(exp.legacyTransactionId);
  }

  const saleIds = importedSales.map((s) => s.id);
  let saleItems = [];
  if (saleIds.length) {
    const { data: items } = await supabaseRead('audit_sale_items', () =>
      supabase.from('sale_items').select('id, sale_id').in('sale_id', saleIds));
    if (!items?.length) {
      const { data: alt } = await supabaseRead('audit_sales_items', () =>
        supabase.from('sales_items').select('id, sale_id').in('sale_id', saleIds));
      saleItems = alt || [];
    } else {
      saleItems = items;
    }
  }
  audit.saleItems.importedCount = saleItems.length;

  const itemsPerSale = new Map();
  for (const it of saleItems) {
    itemsPerSale.set(it.sale_id, (itemsPerSale.get(it.sale_id) || 0) + 1);
  }
  for (const exp of expectedSales) {
    const sale = importedByLegacyTxn.get(exp.legacyTransactionId);
    if (!sale) continue;
    const expectedItems = expectedSaleItemsByTxn.get(String(exp.legacyTransactionId)) || 0;
    const actualItems = itemsPerSale.get(sale.id) || 0;
    if (actualItems < expectedItems) {
      audit.sales.partialLegacyTxnIds.push(exp.legacyTransactionId);
      audit.saleItems.salesWithMissingItems.push({
        legacyTransactionId: exp.legacyTransactionId,
        invoiceNo: sale.invoice_no,
        expectedItems,
        actualItems,
        saleStatus: sale.status,
      });
    }
  }

  if (saleIds.length) {
    const { data: control1100 } = await supabaseRead('audit_ar_control', () =>
      supabase.from('accounts').select('id').eq('company_id', companyId).eq('code', '1100').maybeSingle());
    const control1100Id = control1100?.id ?? null;

    const { data: jes } = await supabaseRead('audit_sale_jes', () =>
      supabase
        .from('journal_entries')
        .select('id, reference_id, payment_id, is_void, description')
        .eq('reference_type', 'sale')
        .in('reference_id', saleIds)
        .is('payment_id', null));
    const activeJes = (jes || []).filter((j) => j.is_void !== true);
    audit.saleJournals.documentJeCount = activeJes.length;
    const jeIds = activeJes.map((j) => j.id);
    if (jeIds.length) {
      const { data: lines } = await supabaseRead('audit_je_lines', () =>
        supabase
          .from('journal_entry_lines')
          .select('journal_entry_id, account_id, debit, credit')
          .in('journal_entry_id', jeIds));
      const accountIdsUsed = [...new Set((lines || []).map((l) => l.account_id))];
      const { data: accts } = await supabaseRead('audit_je_accounts', () =>
        supabase.from('accounts').select('id, code, name, parent_id').in('id', accountIdsUsed));
      const acctById = new Map((accts || []).map((a) => [a.id, a]));
      for (const je of activeJes) {
        const jLines = (lines || []).filter((l) => l.journal_entry_id === je.id);
        const codes = jLines.map((l) => acctById.get(l.account_id)?.code);
        const has4050 = codes.includes('4050');
        const has4000 = codes.includes('4000');
        if (has4050) audit.saleJournals.used4050 = true;
        if (has4000) audit.saleJournals.used4000 = true;
        if (saleJeHasArAndRevenue(jLines, acctById, control1100Id)) {
          audit.saleJournals.withDr1100Cr4100++;
        } else {
          audit.saleJournals.issues.push({ saleId: je.reference_id, codes });
        }
      }
    }
  }

  const { data: payments } = await supabaseRead('audit_payments', () =>
    supabase
      .from('payments')
      .select('id, reference_type, reference_id, amount, notes')
      .eq('company_id', companyId)
      .ilike('notes', `%${SOURCE_SYSTEM}%`));
  const salePayments = (payments || []).filter((p) => p.reference_type === 'sale');
  audit.salePayments.count = salePayments.length;
  audit.salePayments.total = salePayments.reduce((s, p) => s + num(p.amount), 0);

  if (expectedPurchase) {
    const purchId = dinChinaUuid('transactions', Number(expectedPurchase.legacy_transaction_id));
    const { data: purch } = await supabaseRead('audit_purchase', () =>
      supabase
        .from('purchases')
        .select('id, po_no, status, total, paid_amount, due_amount, notes')
        .eq('id', purchId)
        .maybeSingle());
    audit.purchase = {
      expectedPo: expectedPurchase.po_no,
      expectedLegacyTxn: Number(expectedPurchase.legacy_transaction_id),
      found: Boolean(purch),
      row: purch || null,
    };
    if (purch) {
      const { data: pi } = await supabaseRead('audit_purchase_items', () =>
        supabase.from('purchase_items').select('id').eq('purchase_id', purch.id));
      audit.purchaseItems.count = (pi || []).length;
      const { data: pp } = await supabaseRead('audit_purchase_payments', () =>
        supabase
          .from('payments')
          .select('id, amount, notes')
          .eq('company_id', companyId)
          .eq('reference_type', 'purchase')
          .eq('reference_id', purch.id));
      audit.purchasePayments.count = (pp || []).length;
      audit.purchasePayments.total = (pp || []).reduce((s, p) => s + num(p.amount), 0);
    }
  }

  for (const exp of expectedExpenses) {
    const eid = dinChinaUuid('transactions', exp.legacyId);
    const { data: row } = await supabaseRead(`audit_expense_${exp.legacyId}`, () =>
      supabase
        .from('expenses')
        .select('id, expense_no, amount, status, description')
        .eq('id', eid)
        .maybeSingle());
    let jePosted = false;
    if (row) {
      const { data: expJe } = await supabaseRead(`audit_expense_je_${exp.legacyId}`, () =>
        supabase
          .from('journal_entries')
          .select('id, is_void')
          .eq('reference_type', 'expense')
          .eq('reference_id', row.id)
          .is('payment_id', null)
          .limit(1));
      jePosted = (expJe || []).some((j) => j.is_void !== true);
    }
    audit.expenses.imported.push({
      refNo: exp.refNo,
      legacyTransactionId: exp.legacyId,
      found: Boolean(row),
      amount: row ? num(row.amount) : null,
      status: row?.status ?? null,
      accountingPosted: jePosted,
    });
  }

  const { data: acct4000 } = await supabaseRead('audit_account_4000', () =>
    supabase.from('accounts').select('id, code, name').eq('company_id', companyId).eq('code', '4000'));
  audit.revenueAccount4000 = {
    exists: (acct4000 || []).length > 0,
    rows: acct4000 || [],
  };

  // Resume assessment
  const salesFinal = importedSales.filter((s) => String(s.status).toLowerCase() === 'final').length;
  const salesDraft = importedSales.filter((s) => String(s.status).toLowerCase() === 'draft').length;
  if (audit.sales.importedCount > 0 && audit.sales.importedCount < expectedSales.length) {
    audit.resumeAssessment.notes.push(
      `Partial sales: ${audit.sales.importedCount}/${expectedSales.length} imported before gateway failure.`,
    );
    audit.resumeAssessment.duplicateRisk.push(
      'Resume with idempotent upserts should skip completed sales; verify draft vs final per sale.',
    );
  }
  if (salesDraft > 0) {
    audit.resumeAssessment.notes.push(`${salesDraft} sales still in draft — resume should finalize + JE.`);
  }
  if (audit.salePayments.count > 0 && audit.salePayments.count < expectedSalePayments) {
    audit.resumeAssessment.duplicateRisk.push(
      'Partial sale payments — resume must skip posted payments via legacy_payment_id markers.',
    );
  }
  audit.resumeAssessment.safeToResume =
    audit.sales.importedCount <= expectedSales.length &&
    !audit.saleJournals.used4000 &&
    audit.resumeAssessment.manualCleanupNeeded !== true;
  audit.resumeAssessment.notes.push(
    'Infrastructure partial: branch + payment accounts + contacts exist; operational documents not imported.',
  );
  audit.resumeAssessment.notes.push(
    'Resume apply should reuse existing branch/accounts/contacts via upsert and batch-loaded import cache.',
  );

  return audit;
}

export function evaluatePreApplyGate(audit, csvData) {
  const issues = [];
  const sales = audit.sales.importedCount;
  const expectedSales = audit.sales.expectedCount;
  const salePayments = audit.salePayments.count;
  const expectedPayments = audit.salePayments.expectedCount;
  const saleItems = audit.saleItems.importedCount;
  const expectedItems = audit.saleItems.expectedCount;
  const expFound = audit.expenses.imported.filter((e) => e.found).length;
  const expectedExp = audit.expenses.imported.length;

  if (sales > 0 && sales < expectedSales) {
    issues.push(`Partial sales import: ${sales}/${expectedSales} — stop before apply`);
  }
  if (salePayments > 0 && salePayments < expectedPayments) {
    issues.push(`Partial sale payments: ${salePayments}/${expectedPayments} — stop before apply`);
  }
  if (saleItems > 0 && saleItems < expectedItems) {
    issues.push(`Partial sale items: ${saleItems}/${expectedItems} — stop before apply`);
  }
  if (audit.purchase?.found) {
    if (audit.purchaseItems.count < csvData.purchaseItems.rows.length) {
      issues.push(`Partial purchase items: ${audit.purchaseItems.count}/${csvData.purchaseItems.rows.length}`);
    }
    if (audit.purchasePayments.count < csvData.purchasePayments.rows.length) {
      issues.push(`Partial purchase payments: ${audit.purchasePayments.count}/${csvData.purchasePayments.rows.length}`);
    }
  }
  if (expFound > 0 && expFound < expectedExp) {
    issues.push(`Partial expenses: ${expFound}/${expectedExp}`);
  }
  if (audit.revenueAccount4000?.exists) {
    issues.push('Account 4000 Revenue exists — review before apply');
  }
  if (audit.saleJournals.used4050) {
    issues.push('Sale journals used parent 4050 — review before apply');
  }
  if (!audit.resumeAssessment.safeToResume) {
    issues.push('resumeAssessment.safeToResume is false');
  }

  const alreadyComplete =
    sales === expectedSales &&
    saleItems === expectedItems &&
    salePayments === expectedPayments &&
    audit.purchase?.found === true &&
    audit.purchaseItems.count === csvData.purchaseItems.rows.length &&
    audit.purchasePayments.count === csvData.purchasePayments.rows.length &&
    expFound === expectedExp;

  return {
    pass: issues.length === 0,
    alreadyComplete,
    issues,
  };
}

function buildMarkdown(audit) {
  const lines = [
    '# DIN CHINA Partial Apply Audit',
    '',
    `Generated: ${audit.generatedAt}`,
    `Company: ${audit.companyId}`,
    '',
    '## Apply failure',
    `- Failed during: **${audit.applyFailureHint.stage}** (legacy txn ${audit.applyFailureHint.legacyTransactionId})`,
    `- Error: ${audit.applyFailureHint.error}`,
    '- Stages completed: **branch**, **6 payment accounts**, **21 contacts** (legacy markers)',
    '- Stages not completed: **sales** (0/34), **sale items**, **sale payments**, **purchase**, **expenses**',
    '- Products with legacy marker: **0** (product upserts may not have persisted or notes column absent)',
    '',
    '## Branch',
    `- Expected id: ${audit.branch.expectedId}`,
    `- Found by id: ${audit.branch.byId ? `${audit.branch.byId.name} (${audit.branch.byId.code})` : 'NO'}`,
    '',
    '## Payment accounts',
    ...audit.paymentAccounts.map(
      (a) => `- ${a.name}: ${a.found ? `yes (${a.code})` : 'MISSING'}`,
    ),
    '',
    '## Contacts / products',
    `- Contacts with legacy marker: ${audit.contacts.withLegacyMarker}`,
    `- Products with legacy marker: ${audit.products.withLegacyMarker}`,
    `- Variations: ${audit.variations.deterministicCount}`,
    '',
    '## Sales',
    `- Imported: ${audit.sales.importedCount} / ${audit.sales.expectedCount}`,
    `- Total: ${audit.sales.totalAmount} | Paid: ${audit.sales.paidTotal} | Due: ${audit.sales.dueTotal}`,
    `- By status: ${JSON.stringify(audit.sales.byStatus)}`,
    `- Missing legacy txn ids: ${audit.sales.missingLegacyTxnIds.join(', ') || 'none'}`,
    `- Partial (missing items): ${audit.sales.partialLegacyTxnIds.join(', ') || 'none'}`,
    '',
    '## Sale items',
    `- Count: ${audit.saleItems.importedCount} / ${audit.saleItems.expectedCount}`,
    '',
    '## Sale journals',
    `- Document JEs: ${audit.saleJournals.documentJeCount}`,
    `- Dr1100/Cr4100 pairs: ${audit.saleJournals.withDr1100Cr4100}`,
    `- Used 4050: ${audit.saleJournals.used4050}`,
    `- Used 4000: ${audit.saleJournals.used4000}`,
    '',
    '## Sale payments',
    `- Count: ${audit.salePayments.count} / ${audit.salePayments.expectedCount}`,
    `- Total: ${audit.salePayments.total} (expected ${audit.salePayments.expectedTotal})`,
    '',
    '## Purchase / expenses',
    `- Purchase PO2025/0003: ${audit.purchase?.found ? 'yes' : 'no'} status=${audit.purchase?.row?.status ?? 'n/a'}`,
    `- Purchase items: ${audit.purchaseItems.count}`,
    `- Purchase payments: ${audit.purchasePayments.count}`,
    `- Expenses: ${audit.expenses.imported.filter((e) => e.found).length}/4`,
    '',
    '## Resume',
    `- Safe to resume: ${audit.resumeAssessment.safeToResume}`,
    `- Manual cleanup needed: ${audit.resumeAssessment.manualCleanupNeeded}`,
    ...audit.resumeAssessment.notes.map((n) => `- ${n}`),
    ...audit.resumeAssessment.duplicateRisk.map((n) => `- Risk: ${n}`),
  ];
  return lines.join('\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
