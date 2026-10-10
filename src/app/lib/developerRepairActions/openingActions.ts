/**
 * Opening balance controlled repair actions (Phase F5).
 */

import { classifyOpeningBalanceGap } from '@/app/lib/openingBalanceDiagnostics';
import { computeDryRunHash } from '@/app/lib/developerRepairHash';
import type { ApplyResult, DeveloperRepairAction, DeveloperRepairContext, DryRunResult } from '@/app/lib/developerRepairTypes';
import { openingBalanceJournalService, OPENING_BALANCE_REFERENCE } from '@/app/services/openingBalanceJournalService';
import { supabase } from '@/lib/supabase';

async function loadContactOpeningLeg(
  companyId: string,
  contactId: string,
  entityType: 'contact_ar' | 'contact_ap' | 'contact_worker'
) {
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, company_id, name, type, opening_balance, supplier_opening_balance')
    .eq('id', contactId)
    .maybeSingle();
  if (!contact || String((contact as { company_id?: string }).company_id) !== companyId) return null;

  const refMap = {
    contact_ar: OPENING_BALANCE_REFERENCE.CONTACT_AR,
    contact_ap: OPENING_BALANCE_REFERENCE.CONTACT_AP,
    contact_worker: OPENING_BALANCE_REFERENCE.CONTACT_WORKER,
  } as const;
  const refType = refMap[entityType];

  let operational = 0;
  const type = String((contact as { type?: string }).type || '').toLowerCase();
  if (entityType === 'contact_ar') {
    operational = Number((contact as { opening_balance?: number }).opening_balance) || 0;
  } else if (entityType === 'contact_ap') {
    operational =
      type === 'supplier'
        ? Number((contact as { supplier_opening_balance?: number }).supplier_opening_balance ?? (contact as { opening_balance?: number }).opening_balance) || 0
        : Number((contact as { supplier_opening_balance?: number }).supplier_opening_balance) || 0;
  }

  const { data: je } = await supabase
    .from('journal_entries')
    .select('entry_no, lines:journal_entry_lines(debit, credit)')
    .eq('company_id', companyId)
    .eq('reference_type', refType)
    .eq('reference_id', contactId)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let jeAmount: number | null = null;
  const lines = (je as { lines?: Array<{ debit?: number; credit?: number }> } | null)?.lines || [];
  if (lines.length) {
    let max = 0;
    for (const l of lines) {
      max = Math.max(max, Number(l.debit) || 0, Number(l.credit) || 0);
    }
    jeAmount = max > 0 ? max : null;
  }

  const classified = classifyOpeningBalanceGap({
    operationalOpening: operational,
    jeAmount,
    hasJe: lines.length > 0,
  });

  return {
    contact,
    entityType,
    operational,
    jeEntryNo: (je as { entry_no?: string } | null)?.entry_no ?? null,
    jeAmount,
    classified,
  };
}

async function dryRunCreateMissingJe(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext
): Promise<DryRunResult> {
  const contactId = String(params.contactId || '');
  const entityType = String(params.entityType || 'contact_ar') as 'contact_ar' | 'contact_ap' | 'contact_worker';
  const effectiveDate = String(params.effectiveDate || new Date().toISOString().slice(0, 10));
  if (!contactId) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'contactId required' };
  }

  const leg = await loadContactOpeningLeg(ctx.companyId, contactId, entityType);
  if (!leg) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Contact not found' };
  }
  if (leg.classified.status !== 'missing_je') {
    return {
      ok: false,
      dryRunHash: '',
      before: {},
      afterPreview: {},
      blockedReason: `Status is ${leg.classified.status}, not missing_je`,
    };
  }

  const before = {
    contactId,
    entityType,
    entityName: String((leg.contact as { name?: string }).name || ''),
    operationalOpening: leg.operational,
    jeEntryNo: leg.jeEntryNo,
    jeAmount: leg.jeAmount,
    status: leg.classified.status,
  };
  const afterPreview = {
    ...before,
    effectiveDate,
    previewAction: `Would create opening JE via openingBalanceJournalService.syncFromContactRow`,
    expectedJeAmount: leg.operational,
  };

  return {
    ok: true,
    dryRunHash: computeDryRunHash('opening.create_missing_je', params, before),
    before,
    afterPreview,
    targetTable: 'journal_entries',
    targetId: contactId,
    title: 'Create missing opening balance JE',
    impactSummary: `Posts balanced opening JE dated ${effectiveDate}`,
  };
}

async function applyCreateMissingJe(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext,
  dryRunHash: string
): Promise<ApplyResult> {
  const fresh = await dryRunCreateMissingJe(params, ctx);
  if (fresh.dryRunHash !== dryRunHash) return { ok: false, error: 'Dry-run hash mismatch' };
  if (!fresh.ok) return { ok: false, error: fresh.blockedReason };

  await openingBalanceJournalService.syncFromContactRow(String(params.contactId), {
    effectiveDate: String(params.effectiveDate || new Date().toISOString().slice(0, 10)),
  });

  const leg = await loadContactOpeningLeg(
    ctx.companyId,
    String(params.contactId),
    String(params.entityType || 'contact_ar') as 'contact_ar' | 'contact_ap' | 'contact_worker'
  );

  return {
    ok: true,
    message: 'Opening balance JE created',
    after: leg
      ? {
          jeEntryNo: leg.jeEntryNo,
          jeAmount: leg.jeAmount,
          status: leg.classified.status,
        }
      : fresh.afterPreview,
  };
}

async function dryRunAdjustmentJe(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext
): Promise<DryRunResult> {
  const contactId = String(params.contactId || '');
  const entityType = String(params.entityType || 'contact_ar') as 'contact_ar' | 'contact_ap' | 'contact_worker';
  const effectiveDate = String(params.effectiveDate || new Date().toISOString().slice(0, 10));
  if (!contactId) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'contactId required' };
  }

  const leg = await loadContactOpeningLeg(ctx.companyId, contactId, entityType);
  if (!leg) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Contact not found' };
  }
  if (leg.classified.status !== 'amount_mismatch') {
    return {
      ok: false,
      dryRunHash: '',
      before: {},
      afterPreview: {},
      blockedReason: `Status is ${leg.classified.status}, not amount_mismatch`,
    };
  }

  const before = {
    contactId,
    entityType,
    operationalOpening: leg.operational,
    jeAmount: leg.jeAmount,
    gap: leg.classified.gap,
    status: leg.classified.status,
  };
  const afterPreview = {
    ...before,
    effectiveDate,
    previewAction: 'Would post new balanced adjustment JE (does not edit existing JE)',
    adjustmentAmount: Math.abs(leg.classified.gap),
  };

  return {
    ok: true,
    dryRunHash: computeDryRunHash('opening.create_adjustment_je', params, before),
    before,
    afterPreview,
    targetTable: 'journal_entries',
    targetId: contactId,
    title: 'Create opening balance adjustment JE',
    impactSummary: `Adjustment for gap Rs.${leg.classified.gap.toFixed(2)}`,
  };
}

async function applyAdjustmentJe(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext,
  dryRunHash: string
): Promise<ApplyResult> {
  const fresh = await dryRunAdjustmentJe(params, ctx);
  if (fresh.dryRunHash !== dryRunHash) return { ok: false, error: 'Dry-run hash mismatch' };
  if (!fresh.ok) return { ok: false, error: fresh.blockedReason };

  const leg = await loadContactOpeningLeg(
    ctx.companyId,
    String(params.contactId),
    String(params.entityType || 'contact_ar') as 'contact_ar' | 'contact_ap' | 'contact_worker'
  );
  if (!leg) return { ok: false, error: 'Contact not found' };

  const result = await openingBalanceJournalService.createContactOpeningAdjustment({
    companyId: ctx.companyId,
    contactId: String(params.contactId),
    entityType: String(params.entityType || 'contact_ar') as 'contact_ar' | 'contact_ap' | 'contact_worker',
    gap: leg.classified.gap,
    effectiveDate: String(params.effectiveDate || new Date().toISOString().slice(0, 10)),
    contactName: String((leg.contact as { name?: string }).name || ''),
  });

  return { ok: true, message: 'Adjustment JE posted', after: { ...fresh.afterPreview, lines: result.lines } };
}

async function dryRunOrphanReview(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext
): Promise<DryRunResult> {
  const contactId = String(params.contactId || '');
  const entityType = String(params.entityType || 'contact_ar') as 'contact_ar' | 'contact_ap' | 'contact_worker';
  const reviewNote = String(params.reviewNote || '').trim();
  if (!contactId) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'contactId required' };
  }
  if (!reviewNote) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'reviewNote required' };
  }

  const leg = await loadContactOpeningLeg(ctx.companyId, contactId, entityType);
  if (!leg) {
    return { ok: false, dryRunHash: '', before: {}, afterPreview: {}, blockedReason: 'Contact not found' };
  }
  if (leg.classified.status !== 'orphan_je') {
    return {
      ok: false,
      dryRunHash: '',
      before: {},
      afterPreview: {},
      blockedReason: `Status is ${leg.classified.status}, not orphan_je`,
    };
  }

  const before = {
    contactId,
    entityType,
    jeEntryNo: leg.jeEntryNo,
    jeAmount: leg.jeAmount,
    operationalOpening: leg.operational,
    status: leg.classified.status,
  };
  const afterPreview = { ...before, reviewNote, previewAction: 'Audit review note only — no delete/void' };

  return {
    ok: true,
    dryRunHash: computeDryRunHash('opening.orphan_je_review', params, before),
    before,
    afterPreview,
    targetTable: 'journal_entries',
    targetId: contactId,
    title: 'Orphan opening JE — review note',
    impactSummary: 'Writes audit record only',
  };
}

async function applyOrphanReview(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext,
  dryRunHash: string
): Promise<ApplyResult> {
  const fresh = await dryRunOrphanReview(params, ctx);
  if (fresh.dryRunHash !== dryRunHash) return { ok: false, error: 'Dry-run hash mismatch' };
  if (!fresh.ok) return { ok: false, error: fresh.blockedReason };
  return {
    ok: true,
    message: 'Review note recorded in audit log',
    after: fresh.afterPreview,
  };
}

export const openingCreateMissingJeAction: DeveloperRepairAction = {
  id: 'opening.create_missing_je',
  title: 'Create missing opening balance JE',
  description: 'Posts opening JE when operational opening exists but no active opening JE.',
  riskLevel: 'medium',
  requiredRole: 'super-admin',
  confirmPhrase: (p) => `CREATE-OPENING-JE-${String(p.contactId || '').slice(0, 8)}`,
  whatItChanges: ['Creates new balanced opening_balance_contact_* journal entry'],
  whatItNeverChanges: ['Operational opening amount on contact', 'Existing unrelated JEs'],
  dryRun: dryRunCreateMissingJe,
  apply: applyCreateMissingJe,
  auditPayload: (b, a) => ({ before: b, after: a }),
  rollbackNote: 'Void incorrectly created opening JE via Integrity Lab — do not delete.',
};

export const openingAdjustmentJeAction: DeveloperRepairAction = {
  id: 'opening.create_adjustment_je',
  title: 'Create opening balance adjustment JE',
  description: 'Posts adjustment JE for amount mismatch without editing old opening JE.',
  riskLevel: 'high',
  requiredRole: 'super-admin',
  confirmPhrase: (p) => `ADJUST-OPENING-${String(p.contactId || '').slice(0, 8)}`,
  whatItChanges: ['Creates new opening_balance_adjustment_* journal entry'],
  whatItNeverChanges: ['Existing opening JE lines or amounts', 'Contact operational opening field'],
  dryRun: dryRunAdjustmentJe,
  apply: applyAdjustmentJe,
  auditPayload: (b, a) => ({ before: b, after: a }),
  rollbackNote: 'Void adjustment JE if posted in error.',
};

export const openingOrphanReviewAction: DeveloperRepairAction = {
  id: 'opening.orphan_je_review',
  title: 'Orphan opening JE — review note',
  description: 'Records admin review note for orphan opening JE. No auto delete.',
  riskLevel: 'low',
  requiredRole: 'super-admin',
  confirmPhrase: (p) => `REVIEW-ORPHAN-JE-${String(p.contactId || '').slice(0, 8)}`,
  whatItChanges: ['developer_repair_audit metadata only'],
  whatItNeverChanges: ['Journal entries', 'Contact opening balances'],
  dryRun: dryRunOrphanReview,
  apply: applyOrphanReview,
  auditPayload: (b, a) => ({ before: b, after: a, reviewOnly: true }),
  rollbackNote: 'N/A — audit note only.',
};

export const OPENING_REPAIR_ACTIONS = [
  openingCreateMissingJeAction,
  openingAdjustmentJeAction,
  openingOrphanReviewAction,
];
