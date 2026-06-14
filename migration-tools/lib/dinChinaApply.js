import fs from 'node:fs';
import path from 'node:path';
import {
  dinChinaUuid,
  findExistingLegacySale,
  findExistingLegacyPurchase,
  findExistingLegacyExpense,
  findExistingLegacyPayment,
  legacyTxnNote,
  legacyPaymentNote,
  legacyContactNote,
  legacyProductNote,
  legacyInvoiceNo,
  SOURCE_SYSTEM,
} from './dinChinaLegacyMap.js';
import { resolvePaymentAccountId } from './dinChinaMatch.js';
import { mapLegacyPaymentMethod } from './mapLegacyPaymentMethod.js';
import { createImportSaleJournalEntry } from './dinChinaSaleJournal.js';
import { SALE_JOURNAL_STRATEGY } from './dinChinaCoaPreflight.js';

function dateSlice(v) {
  const s = String(v || '').trim();
  if (!s) return new Date().toISOString().slice(0, 10);
  return s.slice(0, 10);
}

function num(v) {
  return Number(v) || 0;
}

function normalizeAccountType(suggestedType) {
  const t = String(suggestedType || '').toLowerCase();
  if (t === 'other') return 'bank';
  return t || 'bank';
}

function accountCodeForCreate(legacyAccountId, suggestedCode) {
  const code = String(suggestedCode || '').trim();
  if (code) return code;
  return `DC${String(legacyAccountId).padStart(4, '0')}`;
}

function contactIdFromPlan(contactPlan, legacyContactId) {
  const hit = contactPlan.find((c) => c.legacyContactId === Number(legacyContactId));
  return hit?.newContactId ?? null;
}

function productFromPlan(productPlan, legacyProductId, legacyVariationId) {
  return productPlan.find(
    (p) =>
      p.legacyProductId === Number(legacyProductId) &&
      p.legacyVariationId === Number(legacyVariationId),
  );
}

function accountIdFromPlan(accountPlan, legacyAccountId) {
  const hit = accountPlan.find((a) => a.legacyAccountId === Number(legacyAccountId));
  return hit?.newAccountId ?? null;
}

async function insertSaleItemRow(supabase, row) {
  let res = await supabase.from('sale_items').insert(row).select('id').single();
  if (res.error?.code === '42P01') {
    res = await supabase.from('sales_items').insert(row).select('id').single();
  }
  return res;
}

async function rpcRecordPayment(supabase, params) {
  const { data, error } = await supabase.rpc('record_payment_with_accounting', {
    p_company_id: params.companyId,
    p_branch_id: params.branchId,
    p_payment_type: params.paymentType,
    p_reference_type: params.referenceType,
    p_reference_id: params.referenceId,
    p_amount: params.amount,
    p_payment_method: params.paymentMethod,
    p_payment_date: params.paymentDate,
    p_payment_account_id: params.paymentAccountId,
    p_reference_number: params.referenceNumber ?? null,
    p_notes: params.notes ?? null,
    p_created_by: null,
  });
  if (error) return { ok: false, error: error.message };
  const res = data;
  if (res?.success && res.payment_id) {
    return {
      ok: true,
      paymentId: res.payment_id,
      journalEntryId: res.journal_entry_id,
      referenceNumber: res.reference_number,
    };
  }
  return { ok: false, error: res?.error || 'record_payment_with_accounting failed' };
}

async function rpcRecordExpense(supabase, expenseId) {
  const { data, error } = await supabase.rpc('record_expense_with_accounting', {
    p_expense_id: expenseId,
  });
  if (error) return { ok: false, error: error.message };
  const res = data;
  if (res?.success) {
    return {
      ok: true,
      skipped: res.skipped === true,
      journalEntryId: res.journal_entry_id,
    };
  }
  return { ok: false, error: res?.error || 'record_expense_with_accounting failed' };
}

async function ensureBranch(supabase, companyId, branchPlan, stats, errors) {
  if (branchPlan.action === 'reuse') {
    stats.branchReused = 1;
    return branchPlan.branchId;
  }
  const { error } = await supabase.from('branches').upsert(
    {
      id: branchPlan.branchId,
      company_id: companyId,
      name: branchPlan.name,
      code: branchPlan.code,
      is_active: true,
    },
    { onConflict: 'id' },
  );
  if (error) {
    errors.push(`Branch create: ${error.message}`);
    return null;
  }
  stats.branchCreated = 1;
  return branchPlan.branchId;
}

async function ensureAccounts(supabase, companyId, accountPlan, stats, errors) {
  for (const a of accountPlan) {
    if (a.action !== 'create') continue;
    const { error } = await supabase.from('accounts').upsert(
      {
        id: a.newAccountId,
        company_id: companyId,
        code: accountCodeForCreate(a.legacyAccountId, a.code),
        name: a.name,
        type: normalizeAccountType(a.type),
        balance: 0,
        is_active: true,
        is_group: false,
      },
      { onConflict: 'id' },
    );
    if (error) {
      errors.push(`Account ${a.legacyAccountId} create: ${error.message}`);
    } else {
      stats.accountsCreated++;
    }
  }
}

async function ensureContacts(supabase, companyId, contactPlan, stats, errors) {
  for (const c of contactPlan) {
    if (c.action !== 'create') continue;
    const phone = String(c.phone || '').trim();
    const row = {
      id: c.newContactId,
      company_id: companyId,
      type: c.type || 'customer',
      name: c.name,
      notes: c.notes || legacyContactNote(c.legacyContactId),
    };
    if (phone) {
      row.mobile = phone;
      row.phone = phone;
    }
    const { error } = await supabase.from('contacts').upsert(row, { onConflict: 'id' });
    if (error) {
      errors.push(`Contact ${c.legacyContactId} create: ${error.message}`);
    } else {
      stats.contactsCreated++;
    }
  }
}

async function ensureProducts(supabase, companyId, productPlan, stats, errors) {
  for (const p of productPlan) {
    if (p.action === 'create') {
      const { error } = await supabase.from('products').upsert(
        {
          id: p.productId,
          company_id: companyId,
          name: p.name,
          sku: p.sku || `DC-P${p.legacyProductId}`,
          cost_price: 0,
          retail_price: 0,
          has_variations: true,
          track_stock: false,
          notes: legacyProductNote(p.legacyProductId),
        },
        { onConflict: 'id' },
      );
      if (error) {
        errors.push(`Product ${p.legacyProductId} create: ${error.message}`);
        continue;
      }
      stats.productsCreated++;
    }
    if (p.action === 'create' || p.action === 'create_variation') {
      const { error: varErr } = await supabase.from('product_variations').upsert(
        {
          id: p.variationId,
          product_id: p.productId,
          sku: p.sku || `DC-V${p.legacyVariationId}`,
          attributes: {},
          price: 0,
        },
        { onConflict: 'id' },
      );
      if (varErr) {
        errors.push(`Variation ${p.legacyVariationId} create: ${varErr.message}`);
      } else if (p.action === 'create_variation') {
        stats.variationsCreated++;
      }
    }
  }
}

/**
 * Live apply — reuses dry-run plan embedded in dryReport (contacts/products/accounts/branch/coa).
 */
export async function runApply(supabase, env, csvBundle, dryReport) {
  const { data } = csvBundle;
  const companyId = env.targetCompanyId;
  const errors = [];
  const stats = {
    branchCreated: 0,
    branchReused: 0,
    accountsCreated: 0,
    contactsCreated: 0,
    productsCreated: 0,
    variationsCreated: 0,
    salesCreated: 0,
    salesSkipped: 0,
    salesFinalized: 0,
    saleJournalsCreated: 0,
    saleJournalsSkipped: 0,
    saleItemsCreated: 0,
    saleItemsSkipped: 0,
    salePaymentsPosted: 0,
    salePaymentsSkipped: 0,
    purchasesCreated: 0,
    purchasesSkipped: 0,
    purchaseItemsCreated: 0,
    purchaseItemsSkipped: 0,
    purchasePaymentsPosted: 0,
    purchasePaymentsSkipped: 0,
    expensesCreated: 0,
    expensesSkipped: 0,
    expensesPosted: 0,
    expensesPostSkipped: 0,
  };

  const contactPlan = dryReport.contacts?.details || [];
  const productPlan = dryReport.products?.details || [];
  const accountPlan = dryReport.accounts?.details || [];
  const branchPlan = dryReport.branch || {};
  const coa = dryReport.coaPreflight || {};

  const arAccountId = coa.arAccount?.id;
  const revenueAccountId = coa.revenuePostingAccount?.id;
  if (!arAccountId || !revenueAccountId) {
    errors.push('COA preflight missing AR or revenue account ids');
    return { pass: false, errors, stats };
  }

  const branchId = await ensureBranch(supabase, companyId, branchPlan, stats, errors);
  if (!branchId) {
    return { pass: false, errors, stats };
  }

  await ensureAccounts(supabase, companyId, accountPlan, stats, errors);
  await ensureContacts(supabase, companyId, contactPlan, stats, errors);
  await ensureProducts(supabase, companyId, productPlan, stats, errors);

  const readySaleTxnIds = new Set(
    (dryReport.sales?.readyDetails || []).map((s) => String(s.legacyTransactionId)),
  );

  for (const s of data.sales.rows) {
    const legacyId = Number(s.legacy_transaction_id);
    if (!readySaleTxnIds.has(String(legacyId))) continue;

    const saleId = dinChinaUuid('transactions', legacyId);
    const existing = await findExistingLegacySale(supabase, companyId, legacyId);
    if (!existing) {
      const customerId = contactIdFromPlan(contactPlan, s.customer_id);
      if (!customerId) {
        errors.push(`Sale ${legacyId}: customer ${s.customer_id} not mapped`);
        continue;
      }
      const total = num(s.final_total);
      const { error } = await supabase.from('sales').upsert(
        {
          id: saleId,
          company_id: companyId,
          branch_id: branchId,
          invoice_no: legacyInvoiceNo(s.invoice_no),
          invoice_date: dateSlice(s.transaction_date),
          customer_id: customerId,
          status: 'draft',
          payment_status: String(s.payment_status || 'unpaid').toLowerCase(),
          subtotal: num(s.subtotal),
          discount_amount: num(s.discount_amount),
          tax_amount: num(s.tax_amount),
          expenses: num(s.shipping_charges),
          total,
          paid_amount: 0,
          due_amount: total,
          notes: `${String(s.notes || '').trim()} ${legacyTxnNote(legacyId)}`.trim(),
          source: SOURCE_SYSTEM,
        },
        { onConflict: 'id' },
      );
      if (error) {
        errors.push(`Sale ${legacyId} insert: ${error.message}`);
        continue;
      }
      stats.salesCreated++;
    } else {
      stats.salesSkipped++;
    }

    for (const line of data.saleItems.rows) {
      if (String(line.transaction_id) !== String(legacyId)) continue;
      const itemId = dinChinaUuid('sale_items', line.line_id);
      const { data: existingItem } = await supabase
        .from('sale_items')
        .select('id')
        .eq('id', itemId)
        .maybeSingle();
      if (existingItem) {
        stats.saleItemsSkipped++;
        continue;
      }
      const prod = productFromPlan(productPlan, line.product_id, line.variation_id);
      if (!prod) {
        errors.push(`Sale item ${line.line_id}: product ${line.product_id}/${line.variation_id} not in plan`);
        continue;
      }
      const itemRow = {
        id: itemId,
        sale_id: saleId,
        product_id: prod.productId,
        variation_id: prod.variationId,
        product_name: line.product_name,
        sku: line.sku,
        quantity: num(line.quantity),
        unit_price: num(line.unit_price),
        discount_amount: num(line.discount_amount),
        tax_amount: num(line.tax_amount),
        total: num(line.line_total),
      };
      const res = await insertSaleItemRow(supabase, itemRow);
      if (res.error) {
        errors.push(`Sale item ${line.line_id}: ${res.error.message}`);
      } else {
        stats.saleItemsCreated++;
      }
    }

    const { data: saleRow, error: saleFetchErr } = await supabase
      .from('sales')
      .select('status, total, invoice_no, invoice_date')
      .eq('id', saleId)
      .single();
    if (saleFetchErr) {
      errors.push(`Sale ${legacyId} fetch: ${saleFetchErr.message}`);
      continue;
    }

    const total = num(saleRow.total);
    if (String(saleRow.status).toLowerCase() !== 'final') {
      const { error: finErr } = await supabase
        .from('sales')
        .update({
          status: 'final',
          paid_amount: 0,
          due_amount: total,
          payment_status: 'unpaid',
        })
        .eq('id', saleId);
      if (finErr) {
        errors.push(`Sale ${legacyId} finalize: ${finErr.message}`);
        continue;
      }
      stats.salesFinalized++;
    }

    const jeResult = await createImportSaleJournalEntry(supabase, {
      saleId,
      companyId,
      branchId,
      total,
      invoiceNo: saleRow.invoice_no || legacyInvoiceNo(s.invoice_no),
      entryDate: saleRow.invoice_date || dateSlice(s.transaction_date),
      arAccountId,
      revenueAccountId,
      legacyTransactionId: legacyId,
    });
    if (!jeResult.ok) {
      errors.push(`Sale ${legacyId} journal: ${jeResult.error}`);
    } else if (jeResult.skipped) {
      stats.saleJournalsSkipped++;
    } else if (jeResult.created) {
      stats.saleJournalsCreated++;
    }
  }

  for (const p of data.salePayments.rows) {
    if (!readySaleTxnIds.has(String(p.transaction_id))) continue;
    const legacyPaymentId = Number(p.payment_id);
    const existingPay = await findExistingLegacyPayment(supabase, companyId, legacyPaymentId);
    if (existingPay) {
      stats.salePaymentsSkipped++;
      continue;
    }
    const saleId = dinChinaUuid('transactions', Number(p.transaction_id));
    const acct = resolvePaymentAccountId(p, accountPlan);
    if (!acct.ok) {
      errors.push(`Sale payment ${legacyPaymentId}: unmapped account`);
      continue;
    }
    const method = mapLegacyPaymentMethod(p.method);
    const rpcRes = await rpcRecordPayment(supabase, {
      companyId,
      branchId,
      paymentType: 'received',
      referenceType: 'sale',
      referenceId: saleId,
      amount: num(p.amount),
      paymentMethod: method.rpcMethod,
      paymentDate: dateSlice(p.paid_on),
      paymentAccountId: acct.newAccountId,
      notes: legacyPaymentNote(legacyPaymentId, p.note || p.payment_ref_no || ''),
    });
    if (!rpcRes.ok) {
      errors.push(`Sale payment ${legacyPaymentId}: ${rpcRes.error}`);
    } else {
      stats.salePaymentsPosted++;
    }
  }

  const readyPurchLegacyIds = new Set(
    (dryReport.purchases?.readyDetails || []).map((p) => String(p.legacyTransactionId)),
  );

  for (const p of data.purchases.rows) {
    const legacyId = Number(p.legacy_transaction_id);
    if (!readyPurchLegacyIds.has(String(legacyId))) continue;

    const purchaseId = dinChinaUuid('transactions', legacyId);
    const existing = await findExistingLegacyPurchase(supabase, companyId, legacyId);
    if (!existing) {
      const supplierId = contactIdFromPlan(contactPlan, p.supplier_id);
      if (!supplierId) {
        errors.push(`Purchase ${legacyId}: supplier ${p.supplier_id} not mapped`);
        continue;
      }
      const total = num(p.final_total);
      const { error } = await supabase.from('purchases').upsert(
        {
          id: purchaseId,
          company_id: companyId,
          branch_id: branchId,
          po_no: p.po_no,
          po_date: dateSlice(p.transaction_date),
          supplier_id: supplierId,
          status: 'received',
          payment_status: String(p.payment_status || 'unpaid').toLowerCase(),
          subtotal: num(p.subtotal),
          discount_amount: num(p.discount_amount),
          tax_amount: num(p.tax_amount),
          shipping_cost: num(p.shipping_charges),
          total,
          paid_amount: 0,
          due_amount: total,
          notes: `${String(p.notes || '').trim()} ${legacyTxnNote(legacyId)}`.trim(),
        },
        { onConflict: 'id' },
      );
      if (error) {
        errors.push(`Purchase ${legacyId} insert: ${error.message}`);
        continue;
      }
      stats.purchasesCreated++;
    } else {
      stats.purchasesSkipped++;
    }

    for (const line of data.purchaseItems.rows) {
      if (String(line.transaction_id) !== String(legacyId)) continue;
      const itemId = dinChinaUuid('purchase_items', line.line_id);
      const { data: existingItem } = await supabase
        .from('purchase_items')
        .select('id')
        .eq('id', itemId)
        .maybeSingle();
      if (existingItem) {
        stats.purchaseItemsSkipped++;
        continue;
      }
      const prod = productFromPlan(productPlan, line.product_id, line.variation_id);
      if (!prod) {
        errors.push(`Purchase item ${line.line_id}: product not in plan`);
        continue;
      }
      const { error: itemErr } = await supabase.from('purchase_items').upsert(
        {
          id: itemId,
          purchase_id: purchaseId,
          product_id: prod.productId,
          variation_id: prod.variationId,
          product_name: line.product_name,
          sku: line.sku,
          quantity: num(line.quantity),
          unit_price: num(line.unit_price),
          total: num(line.line_total),
        },
        { onConflict: 'id' },
      );
      if (itemErr) {
        errors.push(`Purchase item ${line.line_id}: ${itemErr.message}`);
      } else {
        stats.purchaseItemsCreated++;
      }
    }
  }

  for (const p of data.purchasePayments.rows) {
    const legacyPaymentId = Number(p.payment_id);
    const existingPay = await findExistingLegacyPayment(supabase, companyId, legacyPaymentId);
    if (existingPay) {
      stats.purchasePaymentsSkipped++;
      continue;
    }
    const purchaseId = dinChinaUuid('transactions', Number(p.transaction_id));
    const acct = resolvePaymentAccountId(p, accountPlan);
    if (!acct.ok) {
      errors.push(`Purchase payment ${legacyPaymentId}: unmapped account`);
      continue;
    }
    const method = mapLegacyPaymentMethod(p.method);
    const rpcRes = await rpcRecordPayment(supabase, {
      companyId,
      branchId,
      paymentType: 'paid',
      referenceType: 'purchase',
      referenceId: purchaseId,
      amount: num(p.amount),
      paymentMethod: method.rpcMethod,
      paymentDate: dateSlice(p.paid_on),
      paymentAccountId: acct.newAccountId,
      notes: legacyPaymentNote(legacyPaymentId, p.note || p.payment_ref_no || ''),
    });
    if (!rpcRes.ok) {
      errors.push(`Purchase payment ${legacyPaymentId}: ${rpcRes.error}`);
    } else {
      stats.purchasePaymentsPosted++;
    }
  }

  const readyExpLegacyIds = new Set(
    (dryReport.expenses?.readyDetails || []).map((e) => String(e.legacyTransactionId)),
  );

  for (const e of data.expenses.rows) {
    const legacyId = Number(e.legacy_transaction_id);
    if (!readyExpLegacyIds.has(String(legacyId))) continue;

    const expenseId = dinChinaUuid('transactions', legacyId);
    const existing = await findExistingLegacyExpense(supabase, companyId, legacyId);
    if (!existing) {
      const legacyAcctId = Number(e.payment_account_id);
      const paymentAccountId = accountIdFromPlan(accountPlan, legacyAcctId);
      if (!paymentAccountId) {
        errors.push(`Expense ${legacyId}: payment account ${legacyAcctId} not mapped`);
        continue;
      }
      const method = mapLegacyPaymentMethod(e.payment_method);
      const category = e.sub_category_name || e.category_name || 'expense';
      const { error } = await supabase.from('expenses').upsert(
        {
          id: expenseId,
          company_id: companyId,
          branch_id: branchId,
          expense_no: e.ref_no,
          expense_date: dateSlice(e.expense_date),
          category,
          description: `${String(e.description || '').trim()} ${legacyTxnNote(legacyId)}`.trim(),
          amount: num(e.amount),
          payment_method: method.rpcMethod,
          payment_account_id: paymentAccountId,
          status: 'pending',
        },
        { onConflict: 'id' },
      );
      if (error) {
        errors.push(`Expense ${legacyId} insert: ${error.message}`);
        continue;
      }
      stats.expensesCreated++;
    } else {
      stats.expensesSkipped++;
    }

    const expRpc = await rpcRecordExpense(supabase, expenseId);
    if (!expRpc.ok) {
      errors.push(`Expense ${legacyId} GL: ${expRpc.error}`);
    } else if (expRpc.skipped) {
      stats.expensesPostSkipped++;
    } else {
      stats.expensesPosted++;
    }
  }

  return {
    pass: errors.length === 0,
    errors,
    stats,
    saleJournalStrategy: SALE_JOURNAL_STRATEGY,
    revenuePostingCode: coa.revenuePostingAccount?.code,
    arAccountCode: coa.arAccount?.code,
    branchId,
  };
}

export function writeApplyFinalReport(outputDir, dryReport, applyResult) {
  const lines = [
    '# DIN CHINA Legacy Import — Final Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Company: ${dryReport.company?.name || 'n/a'} (${dryReport.targetCompanyId})`,
    '',
    '## Apply path',
    `- Implemented: yes`,
    `- Live import applied: ${applyResult ? 'yes' : 'no (dry-run only)'}`,
    `- Sale journal strategy: ${SALE_JOURNAL_STRATEGY}`,
    `- Revenue posting code: ${dryReport.coaPreflight?.revenuePostingAccount?.code ?? 'n/a'}`,
    `- AR account: ${dryReport.coaPreflight?.arAccount?.code ?? 'n/a'}`,
    '',
    '## Duplicate protection',
    '- Deterministic UUIDs (`dinChinaUuid`) for branch, accounts, contacts, products, variations, sales, purchases, expenses, sale/purchase line items',
    '- `findExistingLegacySale/Purchase/Expense/Payment` — match by deterministic id or notes/description marker',
    '- Sale document JE fingerprint `sale_document:{companyId}:{saleId}` + skip if active canonical JE exists',
    '- Payment/expense RPCs skipped when legacy payment/expense markers already present',
    '',
    '## Dry-run',
    `- Pass: ${dryReport.pass ? 'YES' : 'NO'}`,
    `- Blocking errors: ${dryReport.blockingErrors?.length ?? 0}`,
    '',
  ];

  if (dryReport.blockingErrors?.length) {
    lines.push('### Dry-run blocking errors');
    for (const e of dryReport.blockingErrors) lines.push(`- ${e}`);
    lines.push('');
  }

  if (applyResult) {
    lines.push('## Apply results');
    lines.push(`- Pass: ${applyResult.pass ? 'YES' : 'NO'}`);
    lines.push(`- Errors: ${applyResult.errors.length}`);
    if (applyResult.errors.length) {
      for (const e of applyResult.errors) lines.push(`  - ${e}`);
    }
    lines.push('');
    lines.push('### Apply stats');
    for (const [k, v] of Object.entries(applyResult.stats)) {
      lines.push(`- ${k}: ${v}`);
    }
  }

  if (dryReport.warnings?.length) {
    lines.push('');
    lines.push('## Warnings');
    for (const w of dryReport.warnings) lines.push(`- ${w}`);
  }

  const outPath = path.join(outputDir, 'legacy_din_china_import_final_report.md');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  return outPath;
}
