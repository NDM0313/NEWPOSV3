import { dinChinaUuid } from './dinChinaLegacyMap.js';
import { num, roundMoney } from './dinChinaFinancialAuditShared.js';

const RETURN_SPECS = [
  { returnNo: 'CN2025/0002', legacyTxnId: null, estimatedTotal: 0 },
  { returnNo: 'CN2026/0003', legacyTxnId: null, estimatedTotal: 0 },
  { returnNo: 'CN2026/0004', legacyTxnId: null, estimatedTotal: 0 },
];

export async function buildSaleReturnImportPlan(supabase, ctx) {
  const { companyId } = ctx;
  const proposedRepairs = [];

  for (const spec of RETURN_SPECS) {
    const { data: existing } = await supabase
      .from('sale_returns')
      .select('id, return_no, total')
      .eq('company_id', companyId)
      .eq('return_no', spec.returnNo)
      .maybeSingle();

    proposedRepairs.push({
      returnNo: spec.returnNo,
      existingId: existing?.id ?? null,
      estimatedTotal: spec.estimatedTotal,
      status: existing ? 'already_imported' : 'pending_import',
      returnId: existing?.id ?? dinChinaUuid('sale_return', spec.returnNo),
    });
  }

  const pending = proposedRepairs.filter((r) => r.status === 'pending_import');
  return {
    dryRunOnly: true,
    proposedRepairs,
    eligibleCount: pending.length,
    expectedReturnTotal: roundMoney(
      pending.reduce((s, r) => s + num(r.estimatedTotal), 0),
    ),
    strategyNote: 'Phase 6 not auto-applied — requires --approve-return-import after dry-run review.',
  };
}

export async function applySaleReturnImport(supabase, ctx, plan) {
  return {
    ok: true,
    created: 0,
    skipped: plan.proposedRepairs?.length ?? 0,
    errors: [],
    note: 'Sale return import apply stub — implement when return CSV amounts are locked',
  };
}
