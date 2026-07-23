import { dinChinaUuid } from './dinChinaLegacyMap.js';
import { findActiveCanonicalSaleDocumentJournalEntryId, createImportSaleJournalEntry } from './dinChinaSaleJournal.js';
import { buildSaleReturnImportPlan, applySaleReturnImport } from './dinChinaSaleReturnImport.js';
import { buildDiscountGlRepairPlan, applyDiscountGlRepairs } from './dinChinaDiscountGlRepair.js';
import {
  buildScreenshotDiscountBackfillPlan,
  applyScreenshotDiscountBackfill,
} from './dinChinaScreenshotDiscountBackfill.js';
import {
  buildArPaymentPartyReclassPlan,
  applyArPaymentPartyReclass,
} from './dinChinaArPaymentPartyReclass.js';
import {
  roundMoney,
  num,
  parseLegacyTxnIdFromNotes,
  DIN_CHINA_BRANCH_ID,
} from './dinChinaFinancialAuditShared.js';

function readArg(argv, name) {
  const flag = `--${name}`;
  const i = argv.indexOf(flag);
  if (i === -1) return null;
  const next = argv[i + 1];
  if (!next || next.startsWith('--')) return null;
  return next;
}

export function parseApplyPhases(argv) {
  const raw =
    readArg(argv, 'apply-phase') || readArg(argv, 'repair-phase') || 'all';
  if (raw === 'all') return new Set([1, 2, 3, 4]);
  return new Set(
    raw
      .split(',')
      .map((p) => Number(p.trim()))
      .filter((n) => (n >= 1 && n <= 4) || n === 6 || n === 7 || n === 7.5),
  );
}

export function phaseBlockingErrors(blockingErrors, phase) {
  if (phase === 1) {
    return blockingErrors.filter(
      (e) => e.includes('4100') || e.includes('duplicate') || e.includes('Branch guard'),
    );
  }
  if (phase === 2) {
    return blockingErrors.filter(
      (e) =>
        e.includes('COGS') ||
        e.includes('cost') ||
        e.includes('stock') ||
        e.includes('5010') ||
        e.includes('Branch guard'),
    );
  }
  if (phase === 3) {
    return blockingErrors.filter((e) => e.includes('Purchase total mismatch') || e.includes('Branch guard'));
  }
  if (phase === 4) {
    return blockingErrors.filter((e) => e.includes('Branch guard'));
  }
  if (phase === 6 || phase === 7 || phase === 7.5) {
    return blockingErrors.filter((e) => e.includes('Branch guard'));
  }
  return blockingErrors;
}

export async function applyFinancialRepairs(supabase, ctx, audit, argv) {
  const phases = parseApplyPhases(argv);
  const approvePurchase = argv.includes('--approve-purchase-repair');
  const approveReturns = argv.includes('--approve-return-import');
  const approveDiscountGl = argv.includes('--approve-discount-gl-repair');
  const approveScreenshotDiscount = argv.includes('--approve-screenshot-discount-backfill');
  const approveArPartyReclass = argv.includes('--approve-ar-party-reclass');
  const arPartyReclassFull = argv.includes('--approve-ar-party-reclass-full');
  const results = {
    appliedAt: new Date().toISOString(),
    phases: {},
    errors: [],
    stats: {
      phase1Created: 0,
      phase1Skipped: 0,
      phase2Updated: 0,
      phase2Skipped: 0,
      phase3Skipped: 0,
      phase4Skipped: 0,
      phase6Created: 0,
      phase6Skipped: 0,
      phase7Updated: 0,
      phase7Skipped: 0,
      phase75Updated: 0,
      phase75Skipped: 0,
      phase4Updated: 0,
      phase4Skipped: 0,
    },
  };

  const { companyId, accounts } = ctx;
  const revenueAccountId = accounts.revenue.account?.id;
  const arAccountId = accounts.ar.account?.id;
  const cogsAccountId = accounts.cogs.account?.id;
  const invAccountId = accounts.inventory.account?.id;

  if (phases.has(1)) {
    const blockers = phaseBlockingErrors(audit.blockingErrors, 1);
    if (blockers.length) {
      results.phases[1] = { ok: false, blocked: true, blockers };
    } else {
      const phaseResult = { ok: true, rows: [] };
      for (const repair of audit.taskA.proposedRepairs || []) {
        const sale = await loadSaleRow(supabase, repair.saleId);
        if (!sale) {
          phaseResult.rows.push({ saleId: repair.saleId, ok: false, error: 'sale_not_found' });
          continue;
        }
        const legacyTxnId = parseLegacyTxnIdFromNotes(sale.notes);
        const res = await createImportSaleJournalEntry(supabase, {
          saleId: repair.saleId,
          companyId,
          branchId: DIN_CHINA_BRANCH_ID,
          total: num(sale.total),
          invoiceNo: sale.invoice_no,
          entryDate: sale.invoice_date || sale.created_at,
          arAccountId,
          revenueAccountId,
          legacyTransactionId: legacyTxnId,
        });
        if (res.ok && res.created) results.stats.phase1Created++;
        else if (res.ok && res.skipped) results.stats.phase1Skipped++;
        else {
          results.errors.push(`Phase1 ${repair.invoiceNo}: ${res.error || res.reason}`);
        }
        phaseResult.rows.push({ invoiceNo: repair.invoiceNo, ...res });
      }
      results.phases[1] = phaseResult;
    }
  }

  if (phases.has(2)) {
    const blockers = phaseBlockingErrors(audit.blockingErrors, 2);
    if (blockers.length) {
      results.phases[2] = { ok: false, blocked: true, blockers };
    } else if (!cogsAccountId || !invAccountId) {
      results.phases[2] = { ok: false, blocked: true, blockers: ['5010 or 1200 account missing'] };
    } else {
      const phaseResult = { ok: true, rows: [] };
      for (const repair of audit.taskB.proposedCogsRepairs || []) {
        const res = await appendCogsInventoryToSaleDocumentJe(supabase, {
          saleId: repair.saleId,
          invoiceNo: repair.invoiceNo,
          companyId,
          cogsAccountId,
          invAccountId,
          cogsAmount: repair.expectedCogs,
        });
        if (res.ok && res.updated) results.stats.phase2Updated++;
        else if (res.ok && res.skipped) results.stats.phase2Skipped++;
        else results.errors.push(`Phase2 ${repair.invoiceNo}: ${res.error}`);
        phaseResult.rows.push({ invoiceNo: repair.invoiceNo, ...res });
      }
      results.phases[2] = phaseResult;
    }
  }

  if (phases.has(3)) {
    if (!approvePurchase) {
      results.phases[3] = {
        ok: false,
        blocked: true,
        blockers: ['Pass --approve-purchase-repair to enable Phase 3'],
      };
      results.stats.phase3Skipped = 1;
    } else {
      results.phases[3] = {
        ok: false,
        blocked: true,
        note: 'Phase 3 purchase adjustment not automated — requires separate approved migration',
      };
      results.stats.phase3Skipped = 1;
    }
  }

  if (phases.has(4)) {
    if (!approveArPartyReclass) {
      results.phases[4] = {
        ok: false,
        blocked: true,
        blockers: ['Pass --approve-ar-party-reclass to enable Phase 4 AR payment party reclass'],
      };
      results.stats.phase4Skipped = 1;
    } else {
      const blockers = phaseBlockingErrors(audit.blockingErrors, 4);
      if (blockers.length) {
        results.phases[4] = { ok: false, blocked: true, blockers };
      } else {
        const plan =
          audit.taskD?.phase4Plan || (await buildArPaymentPartyReclassPlan(supabase, ctx));
        if (!plan.eligibleCount) {
          results.phases[4] = { ok: true, skipped: true, note: 'No AR payment lines to reclass' };
          results.stats.phase4Skipped = 1;
        } else {
          const phaseResult = await applyArPaymentPartyReclass(supabase, ctx, plan, {
            positiveGapOnly: !arPartyReclassFull,
          });
          results.stats.phase4Updated = phaseResult.updated;
          results.stats.phase4Skipped = phaseResult.skipped;
          if (phaseResult.errors?.length) results.errors.push(...phaseResult.errors);
          results.phases[4] = phaseResult;
        }
      }
    }
  }

  if (phases.has(6)) {
    if (!approveReturns) {
      results.phases[6] = {
        ok: false,
        blocked: true,
        blockers: ['Pass --approve-return-import to enable Phase 6 sell return import'],
      };
      results.stats.phase6Skipped = 1;
    } else {
      const blockers = phaseBlockingErrors(audit.blockingErrors, 6);
      if (blockers.length) {
        results.phases[6] = { ok: false, blocked: true, blockers };
      } else {
        const plan = audit.phase6Plan || (await buildSaleReturnImportPlan(supabase, ctx));
        const phaseResult = await applySaleReturnImport(supabase, ctx, plan);
        results.stats.phase6Created = phaseResult.created;
        results.stats.phase6Skipped = phaseResult.skipped;
        if (phaseResult.errors?.length) results.errors.push(...phaseResult.errors);
        results.phases[6] = phaseResult;
      }
    }
  }

  if (phases.has(7.5)) {
    if (!approveScreenshotDiscount) {
      results.phases['7.5'] = {
        ok: false,
        blocked: true,
        blockers: ['Pass --approve-screenshot-discount-backfill to enable Phase 7.5 screenshot discount backfill'],
      };
      results.stats.phase75Skipped = 1;
    } else {
      const blockers = phaseBlockingErrors(audit.blockingErrors, 7.5);
      if (blockers.length) {
        results.phases['7.5'] = { ok: false, blocked: true, blockers };
      } else {
        const plan =
          audit.phase75Plan || (await buildScreenshotDiscountBackfillPlan(supabase, ctx));
        const phaseResult = await applyScreenshotDiscountBackfill(supabase, ctx, plan);
        results.stats.phase75Updated = phaseResult.updated;
        results.stats.phase75Skipped = phaseResult.skipped;
        if (phaseResult.errors?.length) results.errors.push(...phaseResult.errors);
        results.phases['7.5'] = phaseResult;
      }
    }
  }

  if (phases.has(7)) {
    if (!approveDiscountGl) {
      results.phases[7] = {
        ok: false,
        blocked: true,
        blockers: ['Pass --approve-discount-gl-repair to enable Phase 7 discount GL amend'],
      };
      results.stats.phase7Skipped = 1;
    } else {
      const blockers = phaseBlockingErrors(audit.blockingErrors, 7);
      if (blockers.length) {
        results.phases[7] = { ok: false, blocked: true, blockers };
      } else {
        const plan = audit.phase7Plan || (await buildDiscountGlRepairPlan(supabase, ctx));
        const phaseResult = await applyDiscountGlRepairs(supabase, ctx, plan);
        results.stats.phase7Updated = phaseResult.updated;
        results.stats.phase7Skipped = phaseResult.skipped;
        if (phaseResult.errors?.length) results.errors.push(...phaseResult.errors);
        results.phases[7] = phaseResult;
      }
    }
  }

  results.ok = results.errors.length === 0;
  return results;
}

async function loadSaleRow(supabase, saleId) {
  const { data } = await supabase
    .from('sales')
    .select('id, invoice_no, total, notes, invoice_date, created_at, branch_id')
    .eq('id', saleId)
    .maybeSingle();
  return data;
}

async function appendCogsInventoryToSaleDocumentJe(supabase, params) {
  const { saleId, invoiceNo, companyId, cogsAccountId, invAccountId, cogsAmount } = params;
  const amount = roundMoney(cogsAmount);
  if (amount <= 0) return { ok: true, skipped: true, reason: 'zero_cogs' };

  const jeId = await findActiveCanonicalSaleDocumentJournalEntryId(supabase, saleId);
  if (!jeId) return { ok: false, error: 'no_document_je' };

  const { data: existingLines } = await supabase
    .from('journal_entry_lines')
    .select('id, account_id, debit, credit')
    .eq('journal_entry_id', jeId);

  const hasCogs = (existingLines || []).some(
    (l) => l.account_id === cogsAccountId && num(l.debit) > 0,
  );
  const hasInv = (existingLines || []).some(
    (l) => l.account_id === invAccountId && num(l.credit) > 0,
  );
  if (hasCogs && hasInv) {
    return { ok: true, skipped: true, reason: 'cogs_already_posted', journalEntryId: jeId };
  }

  const cogsLineId = dinChinaUuid('journal_line', `${jeId}:dr_cogs`);
  const invLineId = dinChinaUuid('journal_line', `${jeId}:cr_inv`);
  const desc = invoiceNo || saleId.slice(0, 8);

  const newLines = [];
  if (!hasCogs) {
    newLines.push({
      id: cogsLineId,
      journal_entry_id: jeId,
      account_id: cogsAccountId,
      debit: amount,
      credit: 0,
      description: `COGS – ${desc}`,
    });
  }
  if (!hasInv) {
    newLines.push({
      id: invLineId,
      journal_entry_id: jeId,
      account_id: invAccountId,
      debit: 0,
      credit: amount,
      description: `Inventory – sale ${desc}`,
    });
  }

  if (newLines.length) {
    const { error: lineErr } = await supabase.from('journal_entry_lines').upsert(newLines, {
      onConflict: 'id',
    });
    if (lineErr) return { ok: false, error: lineErr.message };
  }

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

  return {
    ok: true,
    updated: true,
    journalEntryId: jeId,
    cogsAmount: amount,
    totalDebit,
    totalCredit,
  };
}
