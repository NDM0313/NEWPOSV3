import {
  uploadPaymentAttachments,
  updatePaymentAttachments,
  type AttachmentResult,
} from '../api/paymentAttachments';
import {
  uploadJournalEntryAttachments,
  updateJournalEntryAttachments,
} from '../api/journalAttachments';
import { supabase, isSupabaseConfigured } from './supabase';
import { normalizeAttachments, type NormalizedAttachment } from './normalizeAttachments';
import { dispatchMobileAccountingInvalidated } from './dataInvalidationBus';
import { attachmentUploadWarningMessage } from '../utils/storageUploadErrors';
import {
  loadEffectiveExistingAttachments,
  resolvePolicyReferenceType,
  usesSingleAccountingAttachmentPolicy,
} from './accountingAttachmentPolicy';
import type {
  AttachmentWriteTarget,
  ResolveAttachmentTargetParams,
} from './appendAccountingAttachmentTypes';

export type { AttachmentWriteTarget, ResolveAttachmentTargetParams };

function mergeResults(
  existing: NormalizedAttachment[],
  uploaded: AttachmentResult[],
): AttachmentResult[] {
  const seen = new Set<string>();
  const out: AttachmentResult[] = [];
  const push = (url: string, name: string) => {
    const u = String(url || '').trim();
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push({ url: u, name: name || 'Attachment' });
  };
  for (const a of existing) push(a.url, a.name);
  for (const a of uploaded) push(a.url, a.name);
  return out;
}

function resultsOnly(uploaded: AttachmentResult[], max = Infinity): AttachmentResult[] {
  const out: AttachmentResult[] = [];
  for (const a of uploaded) {
    const u = String(a.url || '').trim();
    if (!u) continue;
    out.push({ url: u, name: a.name || 'Attachment' });
    if (out.length >= max) break;
  }
  return out;
}

function storageRefForPayment(
  referenceType: string | null | undefined,
  referenceId: string | null | undefined,
  paymentId: string,
): string {
  const rt = String(referenceType || '').toLowerCase();
  if ((rt === 'sale' || rt === 'purchase' || rt === 'rental') && referenceId) {
    return String(referenceId);
  }
  return paymentId;
}

/** Resolve where new files should be stored (payment row preferred when linked). */
export async function resolveAttachmentWriteTarget(
  companyId: string,
  params: ResolveAttachmentTargetParams,
): Promise<AttachmentWriteTarget | null> {
  if (!isSupabaseConfigured || !companyId) return null;
  const paymentId = String(params.paymentId || '').trim();
  if (paymentId) {
    const { data } = await supabase
      .from('payments')
      .select('id, reference_type, reference_id')
      .eq('id', paymentId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (data) {
      const row = data as { reference_type?: string; reference_id?: string };
      return {
        kind: 'payment',
        paymentId,
        storageRefId: storageRefForPayment(
          row.reference_type,
          row.reference_id != null ? String(row.reference_id) : null,
          paymentId,
        ),
        referenceType: row.reference_type ?? params.referenceType,
        referenceId: row.reference_id != null ? String(row.reference_id) : params.referenceId,
      };
    }
  }
  const journalEntryId = String(params.journalEntryId || '').trim();
  if (!journalEntryId) return null;

  const { data: je } = await supabase
    .from('journal_entries')
    .select('id, payment_id, reference_type, reference_id')
    .eq('company_id', companyId)
    .eq('id', journalEntryId)
    .maybeSingle();
  if (!je) return null;

  const jePaymentId =
    (je as { payment_id?: string | null }).payment_id != null &&
    String((je as { payment_id?: string | null }).payment_id).trim() !== ''
      ? String((je as { payment_id?: string | null }).payment_id)
      : null;
  if (jePaymentId) {
    return resolveAttachmentWriteTarget(companyId, {
      paymentId: jePaymentId,
      referenceType: (je as { reference_type?: string }).reference_type ?? params.referenceType,
      referenceId:
        (je as { reference_id?: string | null }).reference_id != null
          ? String((je as { reference_id?: string | null }).reference_id)
          : params.referenceId,
    });
  }

  return {
    kind: 'journal',
    journalEntryId,
    referenceType: (je as { reference_type?: string }).reference_type ?? params.referenceType,
    referenceId:
      (je as { reference_id?: string | null }).reference_id != null
        ? String((je as { reference_id?: string | null }).reference_id)
        : params.referenceId,
  };
}

async function clearLinkedAttachmentRows(
  companyId: string,
  target: AttachmentWriteTarget,
): Promise<void> {
  if (!isSupabaseConfigured) return;

  if (target.kind === 'payment') {
    const { data: jeRows } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('payment_id', target.paymentId);
    const ids = (jeRows || []).map((r) => String((r as { id: string }).id)).filter(Boolean);
    if (ids.length) {
      await supabase.from('journal_entries').update({ attachments: null }).in('id', ids);
    }
    return;
  }

  const { data: je } = await supabase
    .from('journal_entries')
    .select('payment_id')
    .eq('id', target.journalEntryId)
    .eq('company_id', companyId)
    .maybeSingle();
  const paymentId =
    (je as { payment_id?: string | null } | null)?.payment_id != null &&
    String((je as { payment_id?: string | null }).payment_id).trim() !== ''
      ? String((je as { payment_id?: string | null }).payment_id)
      : null;
  if (paymentId) {
    await updatePaymentAttachments(paymentId, []);
  }
}

export interface AppendAccountingAttachmentsResult {
  ok: boolean;
  error: string | null;
  warning: string | null;
  mergedCount: number;
  replaced?: boolean;
}

export interface AppendAccountingAttachmentsOptions {
  branchId?: string | null;
  referenceType?: string | null;
}

/** Upload new files onto the canonical payment or journal row (merge or replace per policy). */
export async function appendAccountingAttachments(
  companyId: string,
  target: AttachmentWriteTarget,
  newFiles: File[],
  options?: AppendAccountingAttachmentsOptions,
): Promise<AppendAccountingAttachmentsResult> {
  if (!newFiles.length) {
    return { ok: false, error: 'No files selected.', warning: null, mergedCount: 0 };
  }

  const refType = await resolvePolicyReferenceType(companyId, target, options?.referenceType);
  const singlePolicy = usesSingleAccountingAttachmentPolicy(refType);
  const filesToUpload = singlePolicy ? newFiles.slice(0, 1) : newFiles;

  const effectiveExisting = singlePolicy
    ? await loadEffectiveExistingAttachments(companyId, target)
    : [];
  const replaceMode = singlePolicy;
  const hadExisting = effectiveExisting.length > 0;

  const existing = replaceMode
    ? []
    : await loadExistingForTarget(companyId, target);

  const buildMerged = (uploaded: AttachmentResult[]) =>
    replaceMode ? resultsOnly(uploaded, 1) : mergeResults(existing, uploaded);

  if (target.kind === 'payment') {
    const { results, failures } = await uploadPaymentAttachments(
      companyId,
      target.storageRefId,
      target.paymentId,
      filesToUpload,
    );
    const merged = buildMerged(results);
    if (!merged.length && !results.length) {
      const failMsg = failures[0]?.userMessage ?? 'Upload failed.';
      return { ok: false, error: failMsg, warning: null, mergedCount: 0 };
    }
    const upd = await updatePaymentAttachments(target.paymentId, merged);
    if (upd.error) {
      return { ok: false, error: upd.error, warning: null, mergedCount: results.length };
    }
    if (replaceMode) {
      await clearLinkedAttachmentRows(companyId, target);
    }
    dispatchMobileAccountingInvalidated({
      companyId,
      branchId: options?.branchId ?? null,
      reason: 'attachments-added',
    });
    const warning = attachmentUploadWarningMessage(results.length, filesToUpload.length, failures);
    return {
      ok: true,
      error: null,
      warning,
      mergedCount: merged.length,
      replaced: replaceMode && hadExisting,
    };
  }

  const { results, failures } = await uploadJournalEntryAttachments(companyId, filesToUpload);
  const merged = buildMerged(results);
  if (!merged.length && !results.length) {
    const failMsg = failures[0]?.userMessage ?? 'Upload failed.';
    return { ok: false, error: failMsg, warning: null, mergedCount: 0 };
  }
  const upd = await updateJournalEntryAttachments(target.journalEntryId, merged);
  if (upd.error) {
    return { ok: false, error: upd.error, warning: null, mergedCount: results.length };
  }
  if (replaceMode) {
    await clearLinkedAttachmentRows(companyId, target);
  }
  dispatchMobileAccountingInvalidated({
    companyId,
    branchId: options?.branchId ?? null,
    reason: 'attachments-added',
  });
  const warning = attachmentUploadWarningMessage(results.length, filesToUpload.length, failures);
  return {
    ok: true,
    error: null,
    warning,
    mergedCount: merged.length,
    replaced: replaceMode && hadExisting,
  };
}

async function loadExistingForTarget(
  companyId: string,
  target: AttachmentWriteTarget,
): Promise<NormalizedAttachment[]> {
  if (target.kind === 'payment') {
    const { data } = await supabase
      .from('payments')
      .select('attachments')
      .eq('id', target.paymentId)
      .eq('company_id', companyId)
      .maybeSingle();
    return normalizeAttachments((data as { attachments?: unknown } | null)?.attachments);
  }
  const { data } = await supabase
    .from('journal_entries')
    .select('attachments')
    .eq('id', target.journalEntryId)
    .eq('company_id', companyId)
    .maybeSingle();
  return normalizeAttachments((data as { attachments?: unknown } | null)?.attachments);
}
