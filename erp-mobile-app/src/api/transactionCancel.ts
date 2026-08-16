/**
 * Mobile cancel / void for posted transactions — web parity with
 * accountingService.createReversalEntry + voidPaymentAfterJournalReversal.
 * Posts correction_reversal (or voids multi-member payment chain); no hard delete.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SOURCE_CONTROLLED_REFERENCE_TYPES } from '../lib/journalEntryEditPolicy';
import { getCurrentLocalTimestamp, localNowDateString } from '../utils/localDate';
import type { TransactionRow } from './transactions';

const VOIDABLE_PAYMENT_REFERENCE_TYPES = new Set([
  'manual_receipt',
  'on_account',
  'manual_payment',
  'sale',
  'purchase',
]);

export type CancelActionLabel = 'Cancel Payment' | 'Cancel Entry';

export interface CancelEligibility {
  allowed: boolean;
  reason: string | null;
  label: CancelActionLabel;
  journalEntryId: string;
  paymentId: string | null;
  isMultiMemberChain: boolean;
  confirmTitle: string;
  confirmDescription: string;
  confirmLabel: string;
}

export interface CancelTransactionResult {
  ok: boolean;
  alreadyExisted?: boolean;
  reversalId?: string | null;
  error?: string | null;
}

function extractPaymentChainId(je: {
  payment_id?: string | null;
  reference_type?: string | null;
  reference_id?: string | null;
}): string | null {
  const pid = String(je.payment_id || '').trim();
  if (pid) return pid;
  if (String(je.reference_type || '').toLowerCase() === 'payment_adjustment' && je.reference_id) {
    return String(je.reference_id).trim();
  }
  return null;
}

async function findActiveCorrectionReversalId(
  companyId: string,
  originalJournalEntryId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_type', 'correction_reversal')
    .eq('reference_id', originalJournalEntryId)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

async function fetchPaymentChainActiveEntries(
  companyId: string,
  paymentId: string,
): Promise<Array<{ id: string; created_at?: string | null }>> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, created_at, payment_id, reference_type, reference_id, is_void')
    .eq('company_id', companyId)
    .or(
      `payment_id.eq.${paymentId},and(reference_type.eq.payment_adjustment,reference_id.eq.${paymentId})`,
    );
  if (error || !data?.length) return [];
  const active = (data as Array<{
    id: string;
    created_at?: string | null;
    is_void?: boolean | null;
    reference_type?: string | null;
  }>).filter(
    (e) =>
      e.is_void !== true &&
      String(e.reference_type || '').toLowerCase() !== 'correction_reversal',
  );
  active.sort(
    (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
  );
  return active;
}

async function voidPaymentAndChainJournals(companyId: string, paymentId: string): Promise<void> {
  const nowIso = getCurrentLocalTimestamp();
  const reason = 'Linked payment voided — full chain cleanup (primary + PF-14 adjustments)';

  await supabase.from('payment_allocations').delete().eq('payment_id', paymentId);

  const { error: updErr } = await supabase
    .from('payments')
    .update({ voided_at: nowIso })
    .eq('id', paymentId)
    .eq('company_id', companyId);
  if (updErr) throw new Error(updErr.message);

  await supabase
    .from('journal_entries')
    .update({ is_void: true, void_reason: reason, voided_at: nowIso })
    .eq('company_id', companyId)
    .eq('payment_id', paymentId)
    .eq('is_void', false)
    .neq('reference_type', 'correction_reversal');

  await supabase
    .from('journal_entries')
    .update({ is_void: true, void_reason: reason, voided_at: nowIso })
    .eq('company_id', companyId)
    .eq('reference_type', 'payment_adjustment')
    .eq('reference_id', paymentId)
    .eq('is_void', false);
}

async function recordMutationBestEffort(params: {
  companyId: string;
  branchId?: string | null;
  entityType: 'payment' | 'journal';
  entityId: string;
  mutationType: 'reversal' | 'void';
  sourceJournalEntryId?: string | null;
  adjustmentJournalEntryId?: string | null;
  actorUserId?: string | null;
  reason?: string | null;
}): Promise<void> {
  try {
    let uid = params.actorUserId ?? null;
    if (!uid) {
      const { data } = await supabase.auth.getUser();
      uid = data?.user?.id ?? null;
    }
    await supabase.from('transaction_mutations').insert({
      company_id: params.companyId,
      branch_id: params.branchId && params.branchId !== 'all' ? params.branchId : null,
      entity_type: params.entityType,
      entity_id: params.entityId,
      mutation_type: params.mutationType,
      source_journal_entry_id: params.sourceJournalEntryId ?? null,
      adjustment_journal_entry_id: params.adjustmentJournalEntryId ?? null,
      actor_user_id: uid,
      reason: params.reason ?? null,
      metadata: {},
    });
  } catch {
    /* audit table may be missing — non-blocking */
  }
}

function buildConfirmCopy(opts: {
  hasPayment: boolean;
  isMultiMemberChain: boolean;
}): Pick<CancelEligibility, 'confirmTitle' | 'confirmDescription' | 'confirmLabel' | 'label'> {
  if (opts.hasPayment) {
    return {
      label: 'Cancel Payment',
      confirmTitle: 'Cancel this payment?',
      confirmDescription: opts.isMultiMemberChain
        ? 'Cancel this payment entirely? This voids the original posting plus every edit in the chain. Cannot be undone.'
        : 'Cancel this payment? This posts offsetting entries and removes it from live reports.',
      confirmLabel: 'Yes, Cancel Payment',
    };
  }
  return {
    label: 'Cancel Entry',
    confirmTitle: 'Cancel this journal?',
    confirmDescription:
      'Cancel this journal entry? This posts an offsetting reversal and removes it from live reports.',
    confirmLabel: 'Yes, Cancel',
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Client-side heuristic for showing Cancel on timeline rows (server re-checks on confirm). */
export function canCancelTransactionRow(tx: TransactionRow): {
  show: boolean;
  label: CancelActionLabel;
  journalEntryId: string | null;
} {
  const rt = String(tx.referenceType || '').toLowerCase().trim();
  if (rt === 'correction_reversal') {
    return { show: false, label: 'Cancel Entry', journalEntryId: null };
  }

  const jeId = resolveJournalEntryIdForCancel({
    id: tx.id,
    journalEntryId: tx.journalEntryId,
    paymentId: tx.paymentId,
  });

  const isJournalOnly = tx.id.startsWith('journal-') || tx.id.startsWith('expense-');
  const paymentIdRaw = String(tx.paymentId || tx.id || '').trim();
  const effectiveHasPayment =
    !isJournalOnly && UUID_RE.test(paymentIdRaw) && (!jeId || paymentIdRaw !== jeId);

  if (!effectiveHasPayment && SOURCE_CONTROLLED_REFERENCE_TYPES.has(rt)) {
    return { show: false, label: 'Cancel Entry', journalEntryId: jeId };
  }

  // Payment row without journalEntryId: still show Cancel; confirm path resolves JE by payment_id.
  if (!jeId && effectiveHasPayment) {
    return { show: true, label: 'Cancel Payment', journalEntryId: null };
  }
  if (!jeId) return { show: false, label: 'Cancel Entry', journalEntryId: null };

  return {
    show: true,
    label: effectiveHasPayment ? 'Cancel Payment' : 'Cancel Entry',
    journalEntryId: jeId,
  };
}

/** Resolve journal entry id from timeline/detail identity strings. */
export function resolveJournalEntryIdForCancel(opts: {
  id?: string | null;
  journalEntryId?: string | null;
  paymentId?: string | null;
}): string | null {
  const je = String(opts.journalEntryId || '').trim();
  if (je && UUID_RE.test(je)) return je;
  const id = String(opts.id || '').trim();
  if (id.startsWith('journal-')) {
    const stripped = id.replace(/^journal-/, '');
    if (UUID_RE.test(stripped)) return stripped;
  }
  if (id.startsWith('expense-')) {
    const stripped = id.replace(/^expense-/, '');
    if (UUID_RE.test(stripped)) return stripped;
  }
  if (je) return je;
  return null;
}

/** Look up primary (non-void, non-reversal) JE for a payment when row lacks journalEntryId. */
export async function resolveJournalEntryIdFromPayment(
  companyId: string,
  paymentId: string,
): Promise<string | null> {
  if (!companyId || !paymentId || !isSupabaseConfigured) return null;
  const chain = await fetchPaymentChainActiveEntries(companyId, paymentId);
  if (!chain.length) return null;
  return chain[chain.length - 1]?.id ?? null;
}

export async function getCancelEligibility(
  companyId: string,
  journalEntryId: string,
): Promise<CancelEligibility> {
  const emptyCopy = buildConfirmCopy({ hasPayment: false, isMultiMemberChain: false });
  if (!isSupabaseConfigured) {
    return {
      allowed: false,
      reason: 'App not configured.',
      journalEntryId,
      paymentId: null,
      isMultiMemberChain: false,
      ...emptyCopy,
    };
  }

  const { data: je, error } = await supabase
    .from('journal_entries')
    .select('id, company_id, payment_id, reference_type, reference_id, is_void, description, entry_no')
    .eq('company_id', companyId)
    .eq('id', journalEntryId)
    .maybeSingle();

  if (error || !je) {
    return {
      allowed: false,
      reason: error?.message || 'Journal entry not found.',
      journalEntryId,
      paymentId: null,
      isMultiMemberChain: false,
      ...emptyCopy,
    };
  }

  if (je.is_void === true) {
    return {
      allowed: false,
      reason: 'Voided entry — cancel is disabled.',
      journalEntryId,
      paymentId: extractPaymentChainId(je),
      isMultiMemberChain: false,
      ...emptyCopy,
    };
  }

  const rt = String(je.reference_type || '').toLowerCase().trim();
  if (rt === 'correction_reversal') {
    return {
      allowed: false,
      reason: 'This row is already a correction reversal.',
      journalEntryId,
      paymentId: null,
      isMultiMemberChain: false,
      ...emptyCopy,
    };
  }

  const existingRev = await findActiveCorrectionReversalId(companyId, journalEntryId);
  if (existingRev) {
    return {
      allowed: false,
      reason: 'Already cancelled (offsetting correction is posted).',
      journalEntryId,
      paymentId: extractPaymentChainId(je),
      isMultiMemberChain: false,
      ...emptyCopy,
    };
  }

  const paymentId = extractPaymentChainId(je);
  if (!paymentId && SOURCE_CONTROLLED_REFERENCE_TYPES.has(rt)) {
    return {
      allowed: false,
      reason:
        'Document-driven posting — manage from Sales, Purchases, or Rentals. Cancel from Transactions is not allowed.',
      journalEntryId,
      paymentId: null,
      isMultiMemberChain: false,
      ...emptyCopy,
    };
  }

  let isMultiMemberChain = false;
  if (paymentId) {
    const chain = await fetchPaymentChainActiveEntries(companyId, paymentId);
    if (chain.length > 1) {
      isMultiMemberChain = true;
      const tail = chain[chain.length - 1];
      if (tail?.id && tail.id !== journalEntryId) {
        return {
          allowed: false,
          reason:
            'This payment line is historical (a later edit exists). Open the latest journal row to cancel.',
          journalEntryId,
          paymentId,
          isMultiMemberChain: true,
          ...buildConfirmCopy({ hasPayment: true, isMultiMemberChain: true }),
        };
      }
    }
  }

  const copy = buildConfirmCopy({
    hasPayment: !!paymentId,
    isMultiMemberChain,
  });

  return {
    allowed: true,
    reason: null,
    journalEntryId,
    paymentId,
    isMultiMemberChain,
    ...copy,
  };
}

export async function cancelTransactionWithReversal(params: {
  companyId: string;
  branchId?: string | null;
  journalEntryId: string;
  createdBy?: string | null;
  reason?: string;
}): Promise<CancelTransactionResult> {
  const { companyId, branchId, journalEntryId, reason } = params;
  if (!isSupabaseConfigured) return { ok: false, error: 'App not configured.' };
  if (!companyId || !journalEntryId) return { ok: false, error: 'Missing company or journal entry.' };

  let createdBy = params.createdBy ?? null;
  if (!createdBy) {
    const { data } = await supabase.auth.getUser();
    createdBy = data?.user?.id ?? null;
  }

  try {
    const existingId = await findActiveCorrectionReversalId(companyId, journalEntryId);
    if (existingId) {
      return { ok: true, alreadyExisted: true, reversalId: existingId };
    }

    const { data: original, error: origErr } = await supabase
      .from('journal_entries')
      .select(
        `
        id, company_id, branch_id, payment_id, reference_type, reference_id,
        is_void, description, entry_no, entry_date,
        lines:journal_entry_lines(id, account_id, debit, credit, description)
      `,
      )
      .eq('id', journalEntryId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (origErr || !original) {
      return { ok: false, error: origErr?.message || 'Journal entry not found.' };
    }
    if (original.is_void === true) {
      return { ok: false, error: 'Voided entry — cancel is disabled.' };
    }

    const rt = String(original.reference_type || '').toLowerCase().trim();
    if (rt === 'correction_reversal') {
      return { ok: false, error: 'This row is already a correction reversal.' };
    }

    const paymentId = extractPaymentChainId(original);
    if (!paymentId && SOURCE_CONTROLLED_REFERENCE_TYPES.has(rt)) {
      return {
        ok: false,
        error:
          'Document-driven posting — manage from Sales, Purchases, or Rentals. Cancel from Transactions is not allowed.',
      };
    }

    let chainMemberCount = 0;
    if (paymentId) {
      const chain = await fetchPaymentChainActiveEntries(companyId, paymentId);
      chainMemberCount = chain.length;
      const tail = chain.length ? chain[chain.length - 1] : null;
      if (tail?.id && tail.id !== journalEntryId) {
        return {
          ok: false,
          error:
            'This payment line is historical (a later edit exists). Open the latest journal row to cancel.',
        };
      }
    }

    // Multi-member payment chain: void entire chain (no extra reversal JE) — web parity.
    if (paymentId && chainMemberCount > 1) {
      await voidPaymentAndChainJournals(companyId, paymentId);
      await recordMutationBestEffort({
        companyId,
        branchId: branchId ?? original.branch_id,
        entityType: 'payment',
        entityId: paymentId,
        mutationType: 'reversal',
        sourceJournalEntryId: journalEntryId,
        actorUserId: createdBy,
        reason: reason?.trim() || 'Full payment chain reversal — all chain members voided',
      });
      return { ok: true, alreadyExisted: false, reversalId: journalEntryId };
    }

    const lines = (original as { lines?: Array<{ account_id: string; debit?: number; credit?: number; description?: string | null }> })
      .lines;
    if (!Array.isArray(lines) || lines.length === 0) {
      return { ok: false, error: 'Journal entry has no lines to reverse.' };
    }

    const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { ok: false, error: `Unbalanced journal: Dr ${totalDebit} ≠ Cr ${totalCredit}` };
    }

    const entryNo = `JE-REV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const entryDate = localNowDateString();
    const defaultDescription = reason?.trim()
      ? `Reversal: ${reason}`
      : `Reversal of: ${original.description || original.entry_no || 'Journal entry'}`;

    const insertData: Record<string, unknown> = {
      company_id: companyId,
      entry_no: entryNo,
      entry_date: entryDate,
      description: defaultDescription,
      reference_type: 'correction_reversal',
      reference_id: journalEntryId,
      total_debit: totalCredit,
      total_credit: totalDebit,
    };
    const br = branchId && branchId !== 'all' ? branchId : original.branch_id;
    if (br) insertData.branch_id = br;
    if (createdBy) insertData.created_by = createdBy;
    if (paymentId) {
      insertData.payment_id = paymentId;
      insertData.economic_event_id = paymentId;
    }

    const { data: revJe, error: revErr } = await supabase
      .from('journal_entries')
      .insert(insertData)
      .select('id')
      .single();

    if (revErr) {
      const dup =
        revErr.code === '23505' ||
        String(revErr.message || '').toLowerCase().includes('duplicate') ||
        String(revErr.message || '').toLowerCase().includes('unique');
      if (dup) {
        const again = await findActiveCorrectionReversalId(companyId, journalEntryId);
        if (again) return { ok: true, alreadyExisted: true, reversalId: again };
      }
      return { ok: false, error: revErr.message };
    }

    const reversalId = String((revJe as { id: string }).id);
    const reversalLines = lines.map((line) => ({
      journal_entry_id: reversalId,
      account_id: line.account_id,
      debit: Number(line.credit) || 0,
      credit: Number(line.debit) || 0,
      description: line.description ? `Reversal: ${line.description}` : null,
    }));

    const { error: linesErr } = await supabase.from('journal_entry_lines').insert(reversalLines);
    if (linesErr) {
      const nowIso = getCurrentLocalTimestamp();
      await supabase
        .from('journal_entries')
        .update({
          is_void: true,
          void_reason: 'posting_failed_rollback_no_lines',
          voided_at: nowIso,
        })
        .eq('id', reversalId)
        .eq('company_id', companyId);
      return { ok: false, error: linesErr.message };
    }

    // Void linked payment when voidable (web parity).
    if (paymentId) {
      try {
        const { data: prow } = await supabase
          .from('payments')
          .select('id, reference_type, voided_at')
          .eq('id', paymentId)
          .eq('company_id', companyId)
          .maybeSingle();
        const payRt = String((prow as { reference_type?: string } | null)?.reference_type || '').toLowerCase();
        const canVoid =
          prow &&
          !(prow as { voided_at?: string | null }).voided_at &&
          VOIDABLE_PAYMENT_REFERENCE_TYPES.has(payRt);
        if (canVoid) {
          await voidPaymentAndChainJournals(companyId, paymentId);
        }
      } catch (voidErr) {
        console.warn('[transactionCancel] Reversal posted but payment void failed:', voidErr);
      }
    }

    await recordMutationBestEffort({
      companyId,
      branchId: (insertData.branch_id as string | null) ?? null,
      entityType: paymentId ? 'payment' : 'journal',
      entityId: paymentId || journalEntryId,
      mutationType: 'reversal',
      sourceJournalEntryId: journalEntryId,
      adjustmentJournalEntryId: reversalId,
      actorUserId: createdBy,
      reason: reason?.trim() || defaultDescription,
    });

    return { ok: true, alreadyExisted: false, reversalId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Cancel failed.' };
  }
}
