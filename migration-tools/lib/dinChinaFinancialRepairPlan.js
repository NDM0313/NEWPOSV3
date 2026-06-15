import { roundMoney } from './dinChinaFinancialAuditShared.js';

export function buildRepairPlan(ctx, taskResults, blockingErrors, extras = {}) {
  const { revenue: taskA, cogs: taskB, purchase: taskC, ar: taskD } = taskResults;
  const taskG = extras.taskG;
  const phase6Plan = extras.phase6Plan;
  const phase7Plan = extras.phase7Plan;
  const phase75Plan = extras.phase75Plan;

  const phases = [
    {
      phase: 1,
      name: 'Missing sale revenue JE repair',
      description: 'Post Dr AR / Cr Sales Revenue 4100 for imported final sales with no canonical document JE.',
      eligibleCount: taskA?.proposedRepairs?.length ?? 0,
      action: 'createImportSaleJournalEntry (migration-tools/lib/dinChinaSaleJournal.js)',
      gates: [
        'Sales Revenue 4100 must resolve',
        'No duplicate active document JE for same sale',
        'DIN CHINA branch scope only',
        'Does not change sale totals/items/payments',
      ],
      blocked: blockingErrors.some((e) => e.includes('4100') || e.includes('duplicate')),
    },
    {
      phase: 2,
      name: 'Missing COGS / Inventory relief repair',
      description: 'Append Dr COGS 5010 / Cr Inventory 1200 on sale document JEs when cost source is reliable.',
      eligibleCount: taskB?.proposedCogsRepairs?.length ?? 0,
      expectedCogsTotal: taskB?.expectedCogsTotal ?? 0,
      gates: [
        '5010 and 1200 accounts must exist',
        'Product cost from weighted avg or cost_price — never sale price',
        'Stock movement qty must match sale item qty',
        'Missing cost products block apply',
      ],
      blocked:
        blockingErrors.some((e) => e.includes('COGS') || e.includes('cost') || e.includes('stock')) ||
        (taskB?.missingCostProducts?.length ?? 0) > 0,
    },
    {
      phase: 3,
      name: 'Purchase total / inventory mismatch repair',
      description: 'Adjust stale ERP purchase total (67,978,418.40) vs updated CSV (67,514,347.40).',
      mismatchAmount: taskC?.mismatchAmount ?? 0,
      requiresUserApproval: taskC?.requiresUserApproval ?? false,
      gates: [
        'Explicit user approval required',
        'Never auto-update purchase header without approved migration',
        'Flag --approve-purchase-repair on apply (future)',
      ],
      blocked: true,
      note: taskC?.proposedRepairStrategy?.note,
    },
    {
      phase: 4,
      name: 'AR / payment party tie-out repair',
      description: 'Reclass payment JEs to correct cash/bank or customer AR sub-ledger if mismatches found.',
      paymentIssueCount: taskD?.paymentIssues?.length ?? 0,
      arGap: taskD?.arExpectedVsActualGap ?? 0,
      gates: ['Only if Task D finds wrong account or party', 'No duplicate payment posting'],
      blocked: (taskD?.paymentIssues?.length ?? 0) === 0 && Math.abs(taskD?.arExpectedVsActualGap ?? 0) < 0.02,
    },
    {
      phase: 5,
      name: 'Owner Equity Opening Clearing review',
      description: 'Analysis only — FS2 routing / opening equity clearing; no apply unless separately approved.',
      gates: ['User must explicitly approve separate owner-equity repair'],
      blocked: true,
      applyAllowed: false,
    },
    {
      phase: 6,
      name: 'Legacy sell return import + GL',
      description:
        'Import 4 excluded sell_return documents (CN2025/0001–0002, CN2026/0003–0004) with settlement Dr 4100 / Cr AR and inventory reversal.',
      eligibleCount: phase6Plan?.eligibleCount ?? taskG?.proposedPhase6Count ?? 0,
      expectedReturnTotal: taskG?.expectedSellReturnTotal ?? 0,
      gates: [
        'Dry-run review required',
        'Pass --apply --apply-phase 6 after approval',
        'DIN CHINA branch only',
        'Idempotent fingerprints on return JEs',
      ],
      blocked: true,
      requiresUserApproval: true,
      note: 'Not applied automatically — reduces AR gap by ~Rs 1,059,903 when posted.',
    },
    {
      phase: 7.5,
      name: 'Screenshot discount backfill (sales + GL)',
      description:
        'Backfill old-ERP Customers & Suppliers screenshot discounts on DC-0041, DC-0004, DC-0002 — UPDATE sales.discount_amount/total/due and amend document JE (Dr AR net, Cr 4100 gross, Dr 5200).',
      eligibleCount: phase75Plan?.eligibleCount ?? 0,
      expectedDiscountTotal: phase75Plan?.expectedDiscountTotal ?? 0,
      gates: [
        'Dry-run review required',
        'Pass --apply --apply-phase 7.5 --approve-screenshot-discount-backfill',
        'Approved map: DIN CHINA/07_maps_json/din_china_screenshot_discount_backfill_map.json',
      ],
      blocked: true,
      requiresUserApproval: true,
      note: phase75Plan?.strategyNote,
    },
    {
      phase: 7,
      name: 'Discount GL alignment (Dr 5200 / gross 4100)',
      description:
        'Amend sale document JEs for legacy sales with discount_amount > 0 — increase Cr 4100, add Dr Discount Allowed 5200.',
      eligibleCount: phase7Plan?.eligibleCount ?? taskG?.proposedPhase7Count ?? 0,
      expectedDiscountTotal: taskG?.expectedDiscountTotal ?? 0,
      gates: [
        'Dry-run review required',
        'Pass --apply --apply-phase 7 after approval',
        '5200 and 4100 accounts must exist',
        'Does not change sale.total rows',
      ],
      blocked: true,
      requiresUserApproval: true,
      note: phase7Plan?.strategyNote,
    },
  ];

  const proposedRepairs = [
    ...(taskA?.proposedRepairs || []).map((r) => ({ ...r, phase: 1 })),
    ...(taskB?.proposedCogsRepairs || []).map((r) => ({ ...r, phase: 2 })),
    ...(taskC?.proposedRepairStrategy ? [taskC.proposedRepairStrategy] : []),
  ];

  return {
    dryRunOnly: true,
    applyNotRun: true,
    phases,
    proposedRepairs,
    blockingErrors,
    summary: {
      phase1Eligible: taskA?.proposedRepairs?.length ?? 0,
      phase2Eligible: taskB?.proposedCogsRepairs?.length ?? 0,
      phase3RequiresApproval: taskC?.requiresUserApproval ?? false,
      phase4PaymentIssues: taskD?.paymentIssues?.length ?? 0,
    },
  };
}

export function collectBlockingErrors(ctx, taskResults) {
  const errors = [];
  const { accounts, branchGuard } = ctx;
  const { revenue: taskA, cogs: taskB, purchase: taskC, ar: taskD } = taskResults;

  if (!branchGuard.ok) errors.push(...branchGuard.issues.map((i) => `Branch guard: ${i}`));

  if (!accounts.revenue.found) {
    errors.push('Sales Revenue 4100 not resolved — cannot propose revenue JE repairs');
  }

  if (taskA?.duplicateJeCount > 0) {
    errors.push(`${taskA.duplicateJeCount} sales have duplicate active document JEs — resolve before apply`);
  }

  if (taskB?.missingCostProducts?.length > 0) {
    errors.push(
      `${taskB.missingCostProducts.length} products missing cost source — Phase 2 COGS repair blocked`,
    );
  }

  if (!accounts.cogs.found) {
    errors.push('COGS account 5010 not found — Phase 2 apply blocked until account exists or is safely created');
  }

  if (taskB?.stockQtyMismatchCount > 0) {
    errors.push(`${taskB.stockQtyMismatchCount} sale items have stock movement qty mismatch`);
  }

  if (taskC?.requiresUserApproval) {
    errors.push(
      `Purchase total mismatch ${roundMoney(taskC.mismatchAmount)} requires user approval before Phase 3`,
    );
  }

  const wrongBranch = taskA?.wrongBranchSalesCount ?? 0;
  if (wrongBranch > 0) {
    errors.push(`${wrongBranch} legacy sales outside DIN CHINA branch — repair must not touch these`);
  }

  return [...new Set(errors)];
}

/** Split errors so dry-run exit code reflects real failures vs optional approval gates. */
export function classifyAuditErrors(blockingErrors, taskResults) {
  const { revenue: taskA, cogs: taskB, purchase: taskC, ar: taskD } = taskResults;

  const critical = blockingErrors.filter(
    (e) =>
      !e.includes('Purchase total mismatch') &&
      !e.includes('requires user approval before Phase 3'),
  );

  const approvalRequired = blockingErrors.filter((e) =>
    e.includes('Purchase total mismatch'),
  );

  const phase1Complete =
    (taskA?.missingRevenueJeCount ?? 0) === 0 &&
    (taskA?.duplicateJeCount ?? 0) === 0 &&
    (taskA?.wrongAmountCount ?? 0) === 0;

  const phase2Complete =
    Math.abs(num(taskB?.expectedCogsTotal) - num(taskB?.actualCogsPosted)) < 0.02 &&
    (taskB?.missingCostProducts?.length ?? 0) === 0;

  const arGapNote =
    Math.abs(num(taskD?.arExpectedVsActualGap)) > 0.02
      ? `AR tie-out gap Rs ${roundMoney(taskD.arExpectedVsActualGap)} — Phase 4 review; Phase 6 returns (~Rs 1.06M) may explain part`
      : null;

  const coreAuditPass = critical.length === 0 && phase1Complete && phase2Complete;

  return {
    criticalBlockingErrors: critical,
    approvalRequired,
    arGapNote,
    phase1Complete,
    phase2Complete,
    coreAuditPass,
    dryRunExitCode: critical.length === 0 ? 0 : 1,
  };
}

function num(v) {
  return Number(v) || 0;
}
