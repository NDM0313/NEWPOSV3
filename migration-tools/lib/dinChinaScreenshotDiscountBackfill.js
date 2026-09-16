import fs from 'node:fs';
import path from 'node:path';
import { mapsDir } from './dinChinaPaths.js';
import { dinChinaUuid, findExistingLegacySale } from './dinChinaLegacyMap.js';
import { findActiveCanonicalSaleDocumentJournalEntryId } from './dinChinaSaleJournal.js';
import { num, roundMoney, withinTolerance, DIN_CHINA_BRANCH_ID } from './dinChinaFinancialAuditShared.js';

const MAP_FILENAME = 'din_china_screenshot_discount_backfill_map.json';

function resolveDiscountAccount(accounts) {
  const list = accounts?.list || [];
  const by5200 = list.find((a) => String(a.code || '').trim() === '5200' && a.is_group !== true);
  if (by5200) return by5200;
  return list.find(
    (a) =>
      a.is_group !== true &&
      String(a.name || '')
        .toLowerCase()
        .includes('discount allowed'),
  );
}

export function loadScreenshotDiscountMap() {
  const mapPath = path.join(mapsDir(), MAP_FILENAME);
  if (!fs.existsSync(mapPath)) {
    return { version: 1, rows: [], mapPath };
  }
  return { ...JSON.parse(fs.readFileSync(mapPath, 'utf8')), mapPath };
}

function computeSaleTargets(sale, mapRow) {
  const discount = roundMoney(mapRow.discountAmount);
  const currentTotal = roundMoney(sale.total);
  const paid = roundMoney(sale.paid_amount);
  const currentDiscount = roundMoney(sale.discount_amount);
  const newTotal = roundMoney(currentTotal - discount + currentDiscount);
  let newDue = roundMoney(Math.max(0, newTotal - paid));
  if (mapRow.forgiveRemainingDue) {
    newDue = 0;
  }
  const paymentStatus = newDue <= 0.001 ? 'paid' : 'partial';
  return {
    discount,
    currentTotal,
    newTotal,
    paid,
    currentDiscount,
    currentDue: roundMoney(sale.due_amount),
    newDue,
    paymentStatus,
  };
}

function findArLine(lines, excludeIds) {
  const exclude = new Set(excludeIds.filter(Boolean));
  return (lines || []).find(
    (l) => num(l.debit) > 0 && !exclude.has(l.account_id),
  );
}

export async function buildScreenshotDiscountBackfillPlan(supabase, ctx) {
  const { companyId, accounts } = ctx;
  const map = loadScreenshotDiscountMap();
  const revenueAccountId = accounts.revenue.account?.id;
  const discountAccount = resolveDiscountAccount(accounts);
  const cogsAccountId = accounts.cogs.account?.id;
  const invAccountId = accounts.inventory.account?.id;

  const repairs = [];
  for (const mapRow of map.rows || []) {
    const existing = await findExistingLegacySale(supabase, companyId, mapRow.legacyTransactionId);
    if (!existing?.row) {
      repairs.push({
        phase: 7.5,
        invoiceNo: mapRow.invoiceNo,
        legacyTransactionId: mapRow.legacyTransactionId,
        ok: false,
        error: 'sale_not_found',
      });
      continue;
    }

    const sale = await loadSaleFull(supabase, existing.row.id);
    if (!sale) {
      repairs.push({
        phase: 7.5,
        invoiceNo: mapRow.invoiceNo,
        ok: false,
        error: 'sale_load_failed',
      });
      continue;
    }

    const targets = computeSaleTargets(sale, mapRow);
    const jeId = await findActiveCanonicalSaleDocumentJournalEntryId(supabase, sale.id);
    if (!jeId) {
      repairs.push({
        phase: 7.5,
        saleId: sale.id,
        invoiceNo: mapRow.invoiceNo,
        ok: false,
        error: 'no_document_je',
      });
      continue;
    }

    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('id, account_id, debit, credit, description')
      .eq('journal_entry_id', jeId);

    const revLine = (lines || []).find((l) => l.account_id === revenueAccountId && num(l.credit) > 0);
    const arLine = findArLine(lines, [
      revenueAccountId,
      discountAccount?.id,
      cogsAccountId,
      invAccountId,
    ]);
    const discountLine = discountAccount
      ? (lines || []).find((l) => l.account_id === discountAccount.id && num(l.debit) > 0)
      : null;

    const saleAlreadySet =
      withinTolerance(num(sale.discount_amount), targets.discount) &&
      withinTolerance(num(sale.total), targets.newTotal) &&
      withinTolerance(num(sale.due_amount), targets.newDue);

    const jeAlreadySet =
      discountLine &&
      withinTolerance(num(discountLine.debit), targets.discount) &&
      revLine &&
      withinTolerance(num(revLine.credit), roundMoney(targets.newTotal + targets.discount)) &&
      arLine &&
      withinTolerance(num(arLine.debit), targets.newTotal);

    const alreadyComplete = saleAlreadySet && jeAlreadySet;

    repairs.push({
      phase: 7.5,
      saleId: sale.id,
      invoiceNo: mapRow.invoiceNo,
      customerName: mapRow.customerName,
      legacyTransactionId: mapRow.legacyTransactionId,
      journalEntryId: jeId,
      discountAmount: targets.discount,
      forgiveRemainingDue: mapRow.forgiveRemainingDue,
      saleBefore: {
        total: num(sale.total),
        discount_amount: num(sale.discount_amount),
        paid_amount: num(sale.paid_amount),
        due_amount: num(sale.due_amount),
        payment_status: sale.payment_status,
      },
      saleAfter: {
        total: targets.newTotal,
        discount_amount: targets.discount,
        paid_amount: targets.paid,
        due_amount: targets.newDue,
        payment_status: targets.paymentStatus,
      },
      jeBefore: {
        arDebit: num(arLine?.debit),
        revenueCredit: num(revLine?.credit),
        discountDebit: num(discountLine?.debit),
      },
      jeAfter: {
        arDebit: targets.newTotal,
        revenueCredit: roundMoney(targets.newTotal + targets.discount),
        discountDebit: targets.discount,
      },
      alreadyComplete,
      ok: true,
    });
  }

  const pending = repairs.filter((r) => r.ok && !r.alreadyComplete);
  return {
    dryRunOnly: true,
    mapPath: map.mapPath,
    mapSource: map.source,
    discountAccount: discountAccount
      ? { id: discountAccount.id, code: discountAccount.code, name: discountAccount.name }
      : null,
    proposedRepairs: repairs,
    eligibleCount: pending.length,
    skipCount: repairs.filter((r) => r.alreadyComplete).length,
    expectedDiscountTotal: roundMoney(
      pending.reduce((s, r) => s + num(r.discountAmount), 0),
    ),
    strategyNote:
      'Screenshot backfill: UPDATE sales.discount_amount/total/due, then amend document JE — reduce Dr AR, increase Cr 4100, add Dr 5200.',
  };
}

export async function applyScreenshotDiscountBackfill(supabase, ctx, plan) {
  const { companyId, accounts } = ctx;
  const revenueAccountId = accounts.revenue.account?.id;
  const discountAccount = resolveDiscountAccount(accounts);
  const cogsAccountId = accounts.cogs.account?.id;
  const invAccountId = accounts.inventory.account?.id;

  const results = { rows: [], updated: 0, skipped: 0, errors: [] };

  if (!revenueAccountId || !discountAccount?.id) {
    return { ok: false, errors: ['5200 or 4100 account missing'], rows: [] };
  }

  for (const repair of plan.proposedRepairs || []) {
    if (repair.error || repair.alreadyComplete) {
      results.skipped++;
      results.rows.push({ invoiceNo: repair.invoiceNo, skipped: true, reason: repair.error || 'already_complete' });
      continue;
    }

    const { error: saleErr } = await supabase
      .from('sales')
      .update({
        discount_amount: repair.saleAfter.discount_amount,
        total: repair.saleAfter.total,
        due_amount: repair.saleAfter.due_amount,
        payment_status: repair.saleAfter.payment_status,
      })
      .eq('id', repair.saleId)
      .eq('company_id', companyId)
      .eq('branch_id', DIN_CHINA_BRANCH_ID);

    if (saleErr) {
      results.errors.push(`${repair.invoiceNo}: sale_update ${saleErr.message}`);
      results.rows.push({ invoiceNo: repair.invoiceNo, ok: false, error: saleErr.message });
      continue;
    }

    const jeRes = await amendSaleDocumentJeForScreenshotDiscount(supabase, {
      companyId,
      jeId: repair.journalEntryId,
      invoiceNo: repair.invoiceNo,
      revenueAccountId,
      discountAccountId: discountAccount.id,
      cogsAccountId,
      invAccountId,
      targetArDebit: repair.jeAfter.arDebit,
      targetRevenueCredit: repair.jeAfter.revenueCredit,
      discountAmount: repair.discountAmount,
    });

    if (!jeRes.ok) {
      results.errors.push(`${repair.invoiceNo}: ${jeRes.error}`);
      results.rows.push({ invoiceNo: repair.invoiceNo, ok: false, error: jeRes.error });
    } else if (jeRes.skipped) {
      results.skipped++;
      results.rows.push({ invoiceNo: repair.invoiceNo, skipped: true });
    } else {
      results.updated++;
      results.rows.push({
        invoiceNo: repair.invoiceNo,
        ok: true,
        updated: true,
        saleAfter: repair.saleAfter,
        jeAfter: repair.jeAfter,
      });
    }
  }

  return { ...results, ok: results.errors.length === 0 };
}

async function amendSaleDocumentJeForScreenshotDiscount(supabase, params) {
  const {
    companyId,
    jeId,
    invoiceNo,
    revenueAccountId,
    discountAccountId,
    cogsAccountId,
    invAccountId,
    targetArDebit,
    targetRevenueCredit,
    discountAmount,
  } = params;

  const disc = roundMoney(discountAmount);
  const arTarget = roundMoney(targetArDebit);
  const revTarget = roundMoney(targetRevenueCredit);
  if (disc <= 0) return { ok: true, skipped: true };

  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('id, account_id, debit, credit')
    .eq('journal_entry_id', jeId);

  const revLine = (lines || []).find((l) => l.account_id === revenueAccountId && num(l.credit) > 0);
  const arLine = findArLine(lines, [revenueAccountId, discountAccountId, cogsAccountId, invAccountId]);
  const discLine = (lines || []).find((l) => l.account_id === discountAccountId);

  if (
    discLine &&
    withinTolerance(num(discLine.debit), disc) &&
    revLine &&
    withinTolerance(num(revLine.credit), revTarget) &&
    arLine &&
    withinTolerance(num(arLine.debit), arTarget)
  ) {
    return { ok: true, skipped: true, reason: 'je_already_amended' };
  }

  if (arLine) {
    const { error: arErr } = await supabase
      .from('journal_entry_lines')
      .update({ debit: arTarget })
      .eq('id', arLine.id);
    if (arErr) return { ok: false, error: arErr.message };
  } else {
    return { ok: false, error: 'ar_line_not_found' };
  }

  if (revLine) {
    const { error: revErr } = await supabase
      .from('journal_entry_lines')
      .update({ credit: revTarget })
      .eq('id', revLine.id);
    if (revErr) return { ok: false, error: revErr.message };
  } else {
    return { ok: false, error: 'revenue_line_not_found' };
  }

  const discountLineId = discLine?.id ?? dinChinaUuid('journal_line', `${jeId}:dr_disc`);
  const { error: discErr } = await supabase.from('journal_entry_lines').upsert(
    {
      id: discountLineId,
      journal_entry_id: jeId,
      account_id: discountAccountId,
      debit: disc,
      credit: 0,
      description: `Discount Allowed – ${invoiceNo}`,
    },
    { onConflict: 'id' },
  );
  if (discErr) return { ok: false, error: discErr.message };

  const { data: allLines } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit')
    .eq('journal_entry_id', jeId);
  const totalDebit = roundMoney((allLines || []).reduce((s, l) => s + num(l.debit), 0));
  const totalCredit = roundMoney((allLines || []).reduce((s, l) => s + num(l.credit), 0));

  const { error: jeErr } = await supabase
    .from('journal_entries')
    .update({ total_debit: totalDebit, total_credit: totalCredit })
    .eq('id', jeId)
    .eq('company_id', companyId);
  if (jeErr) return { ok: false, error: jeErr.message };

  return { ok: true, updated: true, totalDebit, totalCredit };
}

async function loadSaleFull(supabase, saleId) {
  const { data } = await supabase
    .from('sales')
    .select(
      'id, invoice_no, total, discount_amount, paid_amount, due_amount, payment_status, branch_id, company_id',
    )
    .eq('id', saleId)
    .maybeSingle();
  return data;
}
