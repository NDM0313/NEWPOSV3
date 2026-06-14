#!/usr/bin/env node
/**
 * DIN CHINA legacy import — dry-run or apply.
 *
 * Usage:
 *   node migration-tools/importDinChinaLegacy.js --company-id <uuid> --dry-run --require-supabase
 *   node migration-tools/importDinChinaLegacy.js --company-id <uuid> --apply --require-supabase
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadMigrationEnv } from './lib/loadMigrationEnv.js';
import {
  loadAllCsvData,
  validateCsvTotals,
  collectUniqueContacts,
  collectUniqueProducts,
  collectLegacyAccountIds,
  EXPECTED_TOTALS,
} from './lib/dinChinaCsv.js';
import {
  buildContactMatchPlan,
  buildProductMatchPlan,
  buildAccountMatchPlan,
  resolvePaymentAccountId,
  summarizePlanActions,
} from './lib/dinChinaMatch.js';
import {
  dinChinaUuid,
  findExistingLegacySale,
  findExistingLegacyPurchase,
  findExistingLegacyExpense,
  SOURCE_SYSTEM,
} from './lib/dinChinaLegacyMap.js';
import { mapLegacyPaymentMethod } from './lib/mapLegacyPaymentMethod.js';
import { runCoaPreflight, SALE_JOURNAL_STRATEGY } from './lib/dinChinaCoaPreflight.js';
import { runApply, writeApplyFinalReport } from './lib/dinChinaApply.js';
import { isGatewayReadError, isTransientReadError, supabaseRead } from './lib/supabaseReadRetry.js';
import {
  loadDinChinaImportStateCache,
  collectLegacyIdsFromCsv,
} from './lib/dinChinaImportStateCache.js';

const GATEWAY_BRANCH_ERROR =
  'Supabase/API gateway temporarily failed during read-only branch check. No import was applied. Re-run dry-run after service recovers.';

const GATEWAY_COMPANY_ERROR =
  'Supabase/API gateway failed during company preflight. No import was applied. Re-run after service recovers.';

const BRANCH_NAME = 'DIN CHINA';
const BRANCH_CODE = 'BL0002';
const LEGACY_BRANCH_ID = 2;

const SCHEMA_TABLES = [
  {
    name: 'companies',
    probe: (sb, companyId) => sb.from('companies').select('id, name').eq('id', companyId).maybeSingle(),
    required: ['id', 'name'],
  },
  {
    name: 'branches',
    probe: (sb, companyId) =>
      sb.from('branches').select('id, company_id, name, code, is_active').eq('company_id', companyId).limit(5),
    required: ['id', 'company_id', 'name'],
  },
  {
    name: 'contacts',
    probe: (sb, companyId) =>
      sb.from('contacts').select('id, company_id, type, name, phone, mobile, code, notes, system_type').eq('company_id', companyId).limit(1),
    required: ['id', 'company_id', 'type', 'name'],
  },
  {
    name: 'products',
    probe: (sb, companyId) =>
      sb.from('products').select('id, company_id, name, sku, cost_price, retail_price, has_variations, track_stock').eq('company_id', companyId).limit(1),
    required: ['id', 'company_id', 'name', 'sku'],
  },
  {
    name: 'product_variations',
    probe: (sb) =>
      sb.from('product_variations').select('id, product_id, sku, attributes, price').limit(1),
    required: ['id', 'product_id', 'sku'],
  },
  {
    name: 'sales',
    probe: (sb, companyId) =>
      sb.from('sales').select('id, company_id, branch_id, invoice_no, invoice_date, customer_id, status, payment_status, subtotal, discount_amount, tax_amount, expenses, total, paid_amount, due_amount, notes, source, customer_bill_ref, created_by').eq('company_id', companyId).limit(1),
    required: ['id', 'company_id', 'branch_id', 'invoice_date', 'status', 'total', 'paid_amount', 'due_amount'],
  },
  {
    name: 'sales_items',
    probe: (sb) =>
      sb.from('sales_items').select('id, sale_id, product_id, variation_id, product_name, sku, quantity, unit_price, discount_amount, tax_amount, total').limit(1),
    required: ['sale_id', 'product_id', 'product_name', 'sku', 'quantity', 'unit_price', 'total'],
    fallback: 'sale_items',
  },
  {
    name: 'purchases',
    probe: (sb, companyId) =>
      sb.from('purchases').select('id, company_id, branch_id, po_no, po_date, supplier_id, status, payment_status, subtotal, discount_amount, tax_amount, shipping_cost, total, paid_amount, due_amount, notes, created_by').eq('company_id', companyId).limit(1),
    required: ['id', 'company_id', 'branch_id', 'po_no', 'supplier_id', 'status', 'total'],
  },
  {
    name: 'purchase_items',
    probe: (sb) =>
      sb.from('purchase_items').select('id, purchase_id, product_id, variation_id, product_name, sku, quantity, unit_price, total').limit(1),
    required: ['purchase_id', 'product_id', 'quantity', 'unit_price', 'total'],
  },
  {
    name: 'payments',
    probe: (sb, companyId) =>
      sb.from('payments').select('id, company_id, branch_id, payment_type, reference_type, reference_id, amount, payment_method, payment_date, payment_account_id, reference_number, notes').eq('company_id', companyId).limit(1),
    required: ['id', 'company_id', 'reference_type', 'reference_id', 'amount', 'payment_method'],
  },
  {
    name: 'expenses',
    probe: (sb, companyId) =>
      sb.from('expenses').select('id, company_id, branch_id, expense_no, expense_date, category, description, amount, payment_method, payment_account_id, status, created_by').eq('company_id', companyId).limit(1),
    required: ['id', 'company_id', 'expense_date', 'amount', 'status'],
  },
  {
    name: 'accounts',
    probe: (sb, companyId) =>
      sb.from('accounts').select('id, company_id, code, name, type, balance, is_active').eq('company_id', companyId).limit(1),
    required: ['id', 'company_id', 'code', 'name', 'type'],
  },
  {
    name: 'stock_movements',
    probe: (sb, companyId) =>
      sb.from('stock_movements').select('id, company_id, branch_id, product_id, variation_id, movement_type, quantity, reference_type, reference_id, notes').eq('company_id', companyId).limit(1),
    required: ['id', 'company_id', 'product_id', 'quantity', 'movement_type'],
  },
];

async function inspectSchema(supabase, companyId) {
  const results = [];
  for (const table of SCHEMA_TABLES) {
    let res = await supabaseRead(`schema_${table.name}`, () => table.probe(supabase, companyId));
    let tableName = table.name;
    if (res.error && table.fallback) {
      const alt = table.fallback;
      if (table.name === 'sales_items') {
        res = await supabaseRead(`schema_${alt}`, () =>
          supabase
            .from(alt)
            .select('id, sale_id, product_id, variation_id, product_name, sku, quantity, unit_price, total')
            .limit(1));
        if (!res.error) tableName = alt;
      }
    }
    const ok = !res.error;
    const sampleKeys =
      res.data && !Array.isArray(res.data)
        ? Object.keys(res.data)
        : Array.isArray(res.data) && res.data[0]
          ? Object.keys(res.data[0])
          : table.required;
    results.push({
      table: tableName,
      ok,
      error: res.error?.message || null,
      sampleColumns: sampleKeys,
      required: table.required,
    });
  }
  return results;
}

async function findWalkingCustomer(supabase, companyId) {
  const { data } = await supabaseRead('walking_customer', () =>
    supabase
      .from('contacts')
      .select('id, name, system_type')
      .eq('company_id', companyId)
      .eq('system_type', 'walking_customer')
      .maybeSingle());
  return data?.id ?? null;
}

async function resolveBranch(supabase, companyId) {
  const { data: branches, error } = await supabaseRead('branches', () =>
    supabase.from('branches').select('id, name, code, is_active').eq('company_id', companyId));

  if (error) {
    if (isGatewayReadError(error)) {
      return { action: 'error', error: GATEWAY_BRANCH_ERROR, gatewayFailure: true };
    }
    return { action: 'error', error: `Branch query failed: ${error.message}` };
  }

  const hit = (branches || []).find(
    (b) => normalizeBranchName(b.name) === normalizeBranchName(BRANCH_NAME),
  );
  if (hit) {
    return { action: 'reuse', branchId: hit.id, name: hit.name, code: hit.code };
  }
  return {
    action: 'create',
    branchId: dinChinaUuid('business_locations', LEGACY_BRANCH_ID),
    name: BRANCH_NAME,
    code: BRANCH_CODE,
  };
}

function normalizeBranchName(n) {
  return String(n || '')
    .trim()
    .toUpperCase();
}

function isGatewayOrTransientErr(err) {
  return isGatewayReadError(err) || isTransientReadError(err);
}

function finalizeDryRunReport(report, blockingErrors, warnings) {
  report.warnings = warnings ?? [];
  report.blockingErrors = blockingErrors ?? [];
  report.pass = report.blockingErrors.length === 0;
  report.liveImportApplied = false;
  if (!report.branch) {
    report.branch = { legacyBranchId: LEGACY_BRANCH_ID, action: 'blocked' };
  }
  if (!report.summary) {
    report.summary = { branch: report.branch?.action ?? 'blocked' };
  }
  return report;
}

/** Abort apply unless dry-run produced a complete passing report. */
function canRunApply(report) {
  if (!report) return { ok: false, reason: 'dry-run report missing' };
  if (report.pass !== true) return { ok: false, reason: 'dry-run pass is false' };
  if (!report.company?.id) return { ok: false, reason: 'company record missing from dry-run' };
  if (!report.branch) return { ok: false, reason: 'branch plan missing from dry-run' };
  if (!Array.isArray(report.blockingErrors) || report.blockingErrors.length > 0) {
    return { ok: false, reason: 'dry-run has blocking errors' };
  }
  if (!report.summary || typeof report.summary !== 'object') {
    return { ok: false, reason: 'dry-run summary missing' };
  }
  return { ok: true };
}

async function runDryRun(supabase, env, csvBundle) {
  const { data } = csvBundle;
  const blockingErrors = [];
  const warnings = [];
  const report = {
    mode: 'dry-run',
    generatedAt: new Date().toISOString(),
    targetCompanyId: env.targetCompanyId,
    sourceSystem: SOURCE_SYSTEM,
    csvPaths: csvBundle.paths,
    expectedTotals: EXPECTED_TOTALS,
    liveImportApplied: false,
  };

  const csvValidation = validateCsvTotals(data);
  report.csvValidation = csvValidation;
  if (csvValidation.errors.length) {
    blockingErrors.push(...csvValidation.errors.map((e) => `CSV: ${e}`));
  }

  const { data: company, error: companyErr } = await (async () => {
    try {
      return await supabaseRead('companies', () =>
        supabase.from('companies').select('id, name').eq('id', env.targetCompanyId).maybeSingle());
    } catch (err) {
      return { data: null, error: err };
    }
  })();

  if (companyErr) {
    if (isGatewayOrTransientErr(companyErr)) {
      report.companyLookupStatus = 'gateway_failure';
      blockingErrors.push(GATEWAY_COMPANY_ERROR);
    } else {
      report.companyLookupStatus = 'error';
      blockingErrors.push(`Company lookup: ${companyErr.message || String(companyErr)}`);
    }
  } else if (!company) {
    report.companyLookupStatus = 'not_found';
    blockingErrors.push(`Company not found: ${env.targetCompanyId}`);
  } else {
    report.companyLookupStatus = 'ok';
  }
  report.company = company || null;

  if (report.companyLookupStatus === 'gateway_failure') {
    return finalizeDryRunReport(report, blockingErrors, warnings);
  }

  report.schema = await inspectSchema(supabase, env.targetCompanyId);
  for (const s of report.schema) {
    if (!s.ok) blockingErrors.push(`Schema probe failed for ${s.table}: ${s.error}`);
  }

  const branchPlan = company ? await resolveBranch(supabase, env.targetCompanyId) : { action: 'blocked' };
  if (branchPlan.action === 'error') {
    blockingErrors.push(branchPlan.error);
  }
  report.branch = { legacyBranchId: LEGACY_BRANCH_ID, ...branchPlan };

  const walkingCustomerId = await findWalkingCustomer(supabase, env.targetCompanyId);
  report.walkingCustomerId = walkingCustomerId;

  const { data: dbContacts } = await supabaseRead('contacts', () =>
    supabase
      .from('contacts')
      .select('id, type, name, phone, mobile, code, notes, system_type')
      .eq('company_id', env.targetCompanyId));
  const { customers, suppliers } = collectUniqueContacts(data);
  const allLegacyContacts = [
    ...customers,
    ...suppliers.filter((s) => !customers.some((c) => c.legacyContactId === s.legacyContactId)),
  ];
  const contactPlan = buildContactMatchPlan(
    allLegacyContacts,
    allLegacyContacts,
    dbContacts || [],
    walkingCustomerId,
  );
  report.contacts = {
    customers: customers.length,
    suppliers: suppliers.length,
    plan: summarizePlanActions(contactPlan),
    details: contactPlan,
  };

  const { data: dbProducts } = await supabaseRead('products', () =>
    supabase.from('products').select('id, name, sku').eq('company_id', env.targetCompanyId));
  const { data: dbVariations } = await supabaseRead('product_variations', () =>
    supabase.from('product_variations').select('id, product_id, sku'));
  const legacyProducts = collectUniqueProducts(data);
  const productPlan = buildProductMatchPlan(legacyProducts, dbProducts || [], dbVariations || []);
  report.products = {
    uniqueLines: legacyProducts.length,
    plan: summarizePlanActions(productPlan),
    details: productPlan,
  };

  const legacyAccountIds = collectLegacyAccountIds(data);
  const { data: dbAccounts } = await supabaseRead('accounts', () =>
    supabase
      .from('accounts')
      .select('id, code, name, type, subtype, is_group, parent_id, is_active')
      .eq('company_id', env.targetCompanyId));
  const accountPlan = buildAccountMatchPlan(legacyAccountIds, dbAccounts || []);
  report.accounts = {
    legacyIds: legacyAccountIds,
    plan: summarizePlanActions(accountPlan),
    details: accountPlan,
  };
  for (const a of accountPlan) {
    if (a.action === 'missing_config') {
      blockingErrors.push(`Payment account legacy id ${a.legacyAccountId} has no config mapping`);
    }
    if (a.action === 'blocked_parent') {
      blockingErrors.push(
        `Payment account legacy id ${a.legacyAccountId} matched parent/group ${a.code} ${a.name}`,
      );
    }
  }

  const coa = await runCoaPreflight(supabase, env.targetCompanyId, accountPlan, {
    saleJournalStrategy: SALE_JOURNAL_STRATEGY,
  });
  report.coaPreflight = coa;
  if (coa.warnings?.length) warnings.push(...coa.warnings);
  if (coa.blockingIssues?.length) blockingErrors.push(...coa.blockingIssues);

  const legacyIds = collectLegacyIdsFromCsv(data);
  const importCache = await loadDinChinaImportStateCache(supabase, env.targetCompanyId, legacyIds);

  const saleDuplicates = [];
  const salesReady = [];
  for (const s of data.sales.rows) {
    const legacyId = Number(s.legacy_transaction_id);
    const existing = await findExistingLegacySale(
      supabase,
      env.targetCompanyId,
      legacyId,
      importCache,
    );
    if (existing) {
      saleDuplicates.push({ legacyTransactionId: legacyId, match: existing.match, id: existing.row.id });
      continue;
    }
    salesReady.push({
      legacyTransactionId: legacyId,
      newSaleId: dinChinaUuid('transactions', legacyId),
      invoiceNo: `DC-${String(s.invoice_no).padStart(4, '0')}`,
      customerLegacyId: Number(s.customer_id),
      total: Number(s.final_total),
      paid: Number(s.paid_amount),
      due: Number(s.due_amount),
    });
  }
  report.sales = {
    csvCount: data.sales.rows.length,
    ready: salesReady.length,
    duplicates: saleDuplicates.length,
    duplicateDetails: saleDuplicates,
    readyDetails: salesReady,
  };

  const saleItemIssues = [];
  const saleTxnReady = new Set(salesReady.map((s) => String(s.legacyTransactionId)));
  for (const line of data.saleItems.rows) {
    if (!saleTxnReady.has(String(line.transaction_id)) && !saleDuplicates.some((d) => String(d.legacyTransactionId) === String(line.transaction_id))) {
      saleItemIssues.push(`Orphan sale item line ${line.line_id} txn ${line.transaction_id}`);
    }
  }
  report.saleItems = { csvCount: data.saleItems.rows.length, ready: data.saleItems.rows.length - saleItemIssues.length, issues: saleItemIssues };

  const salePaymentIssues = [];
  const salePaymentsReady = [];
  for (const p of data.salePayments.rows) {
    const txnId = String(p.transaction_id);
    if (!saleTxnReady.has(txnId)) {
      salePaymentIssues.push(`Payment ${p.payment_id} txn ${txnId} not in ready sales set`);
      continue;
    }
    const acct = resolvePaymentAccountId(p, accountPlan);
    if (!acct.ok) {
      salePaymentIssues.push(`Payment ${p.payment_id} unmapped account (legacy ${p.account_id || 'null'})`);
    }
    const method = mapLegacyPaymentMethod(p.method);
    salePaymentsReady.push({
      legacyPaymentId: Number(p.payment_id),
      legacyTransactionId: Number(p.transaction_id),
      amount: Number(p.amount),
      method: method.rpcMethod,
      legacyMethod: p.method,
      accountMapped: acct.ok,
    });
  }
  report.salePayments = {
    csvCount: data.salePayments.rows.length,
    ready: salePaymentsReady.filter((x) => x.accountMapped).length,
    rpcMethod: 'record_payment_with_accounting',
    paymentType: 'received',
    referenceType: 'sale',
    issues: salePaymentIssues,
  };

  const purchDuplicates = [];
  const purchasesReady = [];
  for (const p of data.purchases.rows) {
    const legacyId = Number(p.legacy_transaction_id);
    const existing = await findExistingLegacyPurchase(
      supabase,
      env.targetCompanyId,
      legacyId,
      importCache,
    );
    if (existing) {
      purchDuplicates.push({ legacyTransactionId: legacyId, match: existing.match, id: existing.row.id });
      continue;
    }
    purchasesReady.push({
      legacyTransactionId: legacyId,
      newPurchaseId: dinChinaUuid('transactions', legacyId),
      poNo: p.po_no,
      total: Number(p.final_total),
    });
  }
  report.purchases = {
    csvCount: data.purchases.rows.length,
    ready: purchasesReady.length,
    duplicates: purchDuplicates.length,
    duplicateDetails: purchDuplicates,
    readyDetails: purchasesReady,
    importStatus: 'received',
    note: 'Historical PO imported as received (no stock IN until finalized)',
  };

  const purchPaymentIssues = [];
  const purchPaymentsReady = [];
  for (const p of data.purchasePayments.rows) {
    const acct = resolvePaymentAccountId(p, accountPlan);
    if (!acct.ok) {
      purchPaymentIssues.push(`Purchase payment ${p.payment_id} unmapped account`);
    }
    purchPaymentsReady.push({
      legacyPaymentId: Number(p.payment_id),
      amount: Number(p.amount),
      accountMapped: acct.ok,
    });
  }
  report.purchasePayments = {
    csvCount: data.purchasePayments.rows.length,
    ready: purchPaymentsReady.filter((x) => x.accountMapped).length,
    rpcMethod: 'record_payment_with_accounting',
    paymentType: 'paid',
    referenceType: 'purchase',
    issues: purchPaymentIssues,
  };

  const expDuplicates = [];
  const expensesReady = [];
  for (const e of data.expenses.rows) {
    const legacyId = Number(e.legacy_transaction_id);
    const existing = await findExistingLegacyExpense(
      supabase,
      env.targetCompanyId,
      legacyId,
      importCache,
    );
    if (existing) {
      expDuplicates.push({ legacyTransactionId: legacyId, id: existing.row.id });
      continue;
    }
    expensesReady.push({
      legacyTransactionId: legacyId,
      refNo: e.ref_no,
      amount: Number(e.amount),
      category: e.sub_category_name || e.category_name,
    });
  }
  report.expenses = {
    csvCount: data.expenses.rows.length,
    ready: expensesReady.length,
    duplicates: expDuplicates.length,
    duplicateDetails: expDuplicates,
    readyDetails: expensesReady,
    rpcAfterInsert: 'record_expense_with_accounting',
  };

  if (saleItemIssues.length) blockingErrors.push(...saleItemIssues);
  if (salePaymentIssues.some((i) => i.includes('unmapped'))) {
    blockingErrors.push(...salePaymentIssues.filter((i) => i.includes('unmapped')));
  }
  if (purchPaymentIssues.length) blockingErrors.push(...purchPaymentIssues);

  report.excludedByDesign = [
    'account_transactions (raw GL/cashbook)',
    'fund transfers',
    'opening balances',
    'manual GL rows',
    'legacy_din_china_skipped_account_transactions.csv',
    'branch id 1 / DIN COLLECTION',
    'sell_return CN2025/0001',
    'unlinked advance payments (transaction_id null)',
  ];

  report.warnings = warnings;
  report.blockingErrors = blockingErrors;
  report.pass = blockingErrors.length === 0;

  report.summary = {
    branch: branchPlan?.action ?? 'blocked',
    saleJournalStrategy: SALE_JOURNAL_STRATEGY,
    revenuePostingCode: coa.revenuePostingAccount?.code ?? null,
    revenueResolvedBy: coa.revenueResolvedBy ?? null,
    paymentAccountsValid: coa.paymentAccountsValid ?? null,
    accountsCreate: accountPlan.filter((a) => a.action === 'create').length,
    accountsReuse: accountPlan.filter((a) => a.action === 'reuse').length,
    accountsBlockedParent: accountPlan.filter((a) => a.action === 'blocked_parent').length,
    contactsCreate: contactPlan.filter((a) => a.action === 'create').length,
    contactsReuse: contactPlan.filter((a) => a.action === 'reuse').length,
    productsCreate: productPlan.filter((a) => a.action === 'create').length,
    productsCreateVariation: productPlan.filter((a) => a.action === 'create_variation').length,
    productsReuse: productPlan.filter((a) => a.action === 'reuse').length,
    salesReady: salesReady.length,
    saleItemsReady: report.saleItems.ready,
    salePaymentsReady: report.salePayments.ready,
    purchasesReady: purchasesReady.length,
    purchaseItemsReady: data.purchaseItems.rows.length,
    purchasePaymentsReady: report.purchasePayments.ready,
    expensesReady: expensesReady.length,
    saleDuplicates: saleDuplicates.length,
    purchaseDuplicates: purchDuplicates.length,
    expenseDuplicates: expDuplicates.length,
  };

  return report;
}

function printConsoleSummary(report) {
  console.log('\n========== DIN CHINA Legacy Import DRY-RUN ==========');
  const companyLabel =
    report.company?.name ??
    (report.companyLookupStatus === 'gateway_failure'
      ? 'API GATEWAY FAILURE (company not loaded)'
      : 'NOT FOUND');
  console.log(`Company: ${companyLabel} (${report.targetCompanyId})`);

  const branch = report.branch;
  if (branch) {
    console.log(
      `Branch: ${branch.action ?? 'unknown'} → ${branch.name ?? 'n/a'} (${branch.branchId || 'pending'})`,
    );
  } else {
    console.log('Branch: not resolved (preflight incomplete)');
  }
  console.log(`Pass: ${report.pass ? 'YES' : 'NO'}`);

  const coa = report.coaPreflight || {};
  console.log('\nCOA preflight:');
  if (!report.coaPreflight) {
    console.log('  Skipped or incomplete (preflight did not finish)');
  } else {
    console.log(
      `  Revenue account: ${coa.revenueAccountFound ? `${coa.revenuePostingAccount?.code} ${coa.revenuePostingAccount?.name}` : 'NOT FOUND'} (${coa.revenueResolvedBy || 'n/a'})`,
    );
    console.log(`  AR account: ${coa.arAccount ? `${coa.arAccount.code} ${coa.arAccount.name}` : 'NOT FOUND'}`);
    console.log(`  Sale JE strategy: ${coa.saleJournalStrategy || 'n/a'}`);
    if (coa.rpc4000AutoCreateRisk?.mitigated) {
      console.log(`  RPC 4000 auto-create risk: mitigated (${coa.rpc4000AutoCreateRisk.mitigation})`);
    } else if (coa.rpc4000AutoCreateRisk?.blocker) {
      console.log(`  RPC 4000 auto-create risk: BLOCKER — ${coa.rpc4000AutoCreateRisk.reason}`);
    } else {
      console.log('  RPC 4000 auto-create risk: none');
    }
    const payValid = (coa.paymentAccounts || []).filter((p) => p.valid);
    console.log(
      `  Payment accounts: ${payValid.length} detail targets (${coa.paymentAccountsValid ? 'valid' : 'INVALID'})`,
    );
  }

  const s = report.summary;
  console.log('\nCounts:');
  if (!s) {
    console.log('  unavailable (preflight incomplete)');
  } else {
    console.log(`  Branch: ${s.branch ?? 'n/a'}`);
    console.log(`  Accounts: ${s.accountsReuse ?? 0} reuse / ${s.accountsCreate ?? 0} create`);
    console.log(`  Contacts: ${s.contactsReuse ?? 0} reuse / ${s.contactsCreate ?? 0} create`);
    console.log(
      `  Products: ${s.productsReuse ?? 0} reuse / ${s.productsCreate ?? 0} create / ${s.productsCreateVariation ?? 0} new variants`,
    );
    console.log(`  Sales ready: ${s.salesReady ?? 0} (dup skip: ${s.saleDuplicates ?? 0})`);
    console.log(`  Sale items ready: ${s.saleItemsReady ?? 0}`);
    console.log(`  Sale payments ready: ${s.salePaymentsReady ?? 0}`);
    console.log(`  Purchases ready: ${s.purchasesReady ?? 0}`);
    console.log(`  Purchase items ready: ${s.purchaseItemsReady ?? 0}`);
    console.log(`  Purchase payments ready: ${s.purchasePaymentsReady ?? 0}`);
    console.log(`  Expenses ready: ${s.expensesReady ?? 0}`);
  }

  const blockingErrors = report.blockingErrors ?? [];
  if (blockingErrors.length) {
    console.log('\nBlocking errors:');
    for (const e of blockingErrors) console.log(`  - ${e}`);
  }
  const warnings = report.warnings ?? [];
  if (warnings.length) {
    console.log('\nWarnings:');
    for (const w of warnings) console.log(`  - ${w}`);
  }
  console.log('\nLive import applied: NO');
  console.log('====================================================\n');
}

function printApplySummary(applyResult) {
  console.log('\n========== DIN CHINA Legacy Import APPLY ==========');
  console.log(`Pass: ${applyResult.pass ? 'YES' : 'NO'}`);
  console.log(`Sale JE strategy: ${applyResult.saleJournalStrategy}`);
  console.log(`Revenue code: ${applyResult.revenuePostingCode} | AR: ${applyResult.arAccountCode}`);
  console.log('\nApply stats:');
  for (const [k, v] of Object.entries(applyResult.stats)) {
    console.log(`  ${k}: ${v}`);
  }
  if (applyResult.errors.length) {
    console.log('\nApply errors:');
    for (const e of applyResult.errors) console.log(`  - ${e}`);
  }
  console.log('===================================================\n');
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.includes('--dry-run') && !argv.includes('--apply')) {
    console.error('Pass --dry-run or --apply');
    process.exit(1);
  }

  argv.push('--require-supabase');
  const env = loadMigrationEnv(argv);

  const csvBundle = loadAllCsvData();
  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let report;
  try {
    report = await runDryRun(supabase, env, csvBundle);
  } catch (err) {
    const msg = err?.message || String(err);
    const gateway = isGatewayOrTransientErr(err) || /bad gateway|502|503|504/i.test(msg);
    report = {
      mode: 'dry-run',
      generatedAt: new Date().toISOString(),
      targetCompanyId: env.targetCompanyId,
      sourceSystem: SOURCE_SYSTEM,
      csvPaths: csvBundle.paths,
      liveImportApplied: false,
      company: null,
      companyLookupStatus: gateway ? 'gateway_failure' : 'error',
      pass: false,
      blockingErrors: [
        gateway ? GATEWAY_COMPANY_ERROR : `Dry-run aborted: ${msg}`,
      ],
      warnings: [],
      branch: { legacyBranchId: LEGACY_BRANCH_ID, action: 'blocked' },
      summary: { branch: 'blocked' },
    };
  }
  fs.mkdirSync(env.outputDir, { recursive: true });
  const outPath = path.join(env.outputDir, 'din_china_dry_run_report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  printConsoleSummary(report);
  console.log(`Report: ${outPath}`);

  if (!report.pass) {
    writeApplyFinalReport(env.outputDir, report, null);
    process.exit(1);
  }

  if (env.apply) {
    const gate = canRunApply(report);
    if (!gate.ok) {
      console.error(`\nApply blocked: ${gate.reason}. No import was applied.`);
      if (report.companyLookupStatus === 'gateway_failure') {
        console.error(GATEWAY_COMPANY_ERROR);
      }
      writeApplyFinalReport(env.outputDir, report, null);
      process.exit(1);
    }
    console.log('\nRunning live apply...');
    const applyResult = await runApply(supabase, env, csvBundle, report);
    printApplySummary(applyResult);
    const finalReportPath = writeApplyFinalReport(env.outputDir, report, applyResult);
    console.log(`Final report: ${finalReportPath}`);
    process.exit(applyResult.pass ? 0 : 1);
  }

  writeApplyFinalReport(env.outputDir, report, null);
  process.exit(report.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
