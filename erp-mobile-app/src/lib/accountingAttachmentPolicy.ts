import { supabase, isSupabaseConfigured } from './supabase';
import { normalizeAttachments, type NormalizedAttachment } from './normalizeAttachments';
import type { AttachmentWriteTarget } from './appendAccountingAttachmentTypes';

const SINGLE_ATTACHMENT_REF_TYPES = new Set([
  'manual_receipt',
  'manual_payment',
  'payment',
  'on_account',
]);

/** Standalone Accounts receive/pay — one attachment; sale/purchase/rental payments stay multi. */
export function usesSingleAccountingAttachmentPolicy(
  referenceType: string | null | undefined,
): boolean {
  const rt = String(referenceType || '').toLowerCase();
  if (rt === 'sale' || rt === 'purchase' || rt === 'rental') return false;
  return SINGLE_ATTACHMENT_REF_TYPES.has(rt);
}

function mergeUniqueAttachments(...lists: NormalizedAttachment[][]): NormalizedAttachment[] {
  const seen = new Set<string>();
  const out: NormalizedAttachment[] = [];
  for (const list of lists) {
    for (const a of list) {
      const u = String(a.url || '').trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push({ url: u, name: a.name || 'Attachment' });
    }
  }
  return out;
}

/** Payment + linked JE attachments (what lists/preview show for RCV rows). */
export async function loadEffectiveExistingAttachments(
  companyId: string,
  target: AttachmentWriteTarget,
): Promise<NormalizedAttachment[]> {
  if (!isSupabaseConfigured || !companyId) return [];

  if (target.kind === 'payment') {
    const { data: pay } = await supabase
      .from('payments')
      .select('attachments')
      .eq('id', target.paymentId)
      .eq('company_id', companyId)
      .maybeSingle();
    const fromPayment = normalizeAttachments((pay as { attachments?: unknown } | null)?.attachments);

    const { data: jeRows } = await supabase
      .from('journal_entries')
      .select('attachments')
      .eq('company_id', companyId)
      .eq('payment_id', target.paymentId);
    const fromJe: NormalizedAttachment[] = [];
    for (const row of jeRows || []) {
      fromJe.push(...normalizeAttachments((row as { attachments?: unknown }).attachments));
    }
    return mergeUniqueAttachments(fromPayment, fromJe);
  }

  const { data: je } = await supabase
    .from('journal_entries')
    .select('attachments, payment_id')
    .eq('id', target.journalEntryId)
    .eq('company_id', companyId)
    .maybeSingle();
  const fromJe = normalizeAttachments((je as { attachments?: unknown } | null)?.attachments);
  const paymentId =
    (je as { payment_id?: string | null } | null)?.payment_id != null &&
    String((je as { payment_id?: string | null }).payment_id).trim() !== ''
      ? String((je as { payment_id?: string | null }).payment_id)
      : null;
  if (!paymentId) return fromJe;

  const { data: pay } = await supabase
    .from('payments')
    .select('attachments')
    .eq('id', paymentId)
    .eq('company_id', companyId)
    .maybeSingle();
  const fromPayment = normalizeAttachments((pay as { attachments?: unknown } | null)?.attachments);
  return mergeUniqueAttachments(fromJe, fromPayment);
}

export async function resolvePolicyReferenceType(
  companyId: string,
  target: AttachmentWriteTarget,
  fallback?: string | null,
): Promise<string> {
  if (target.kind === 'payment') {
    return String(target.referenceType ?? fallback ?? '');
  }
  if (!isSupabaseConfigured) return String(fallback ?? '');
  const { data: je } = await supabase
    .from('journal_entries')
    .select('reference_type, payment_id')
    .eq('id', target.journalEntryId)
    .eq('company_id', companyId)
    .maybeSingle();
  const paymentId =
    (je as { payment_id?: string | null } | null)?.payment_id != null &&
    String((je as { payment_id?: string | null }).payment_id).trim() !== ''
      ? String((je as { payment_id?: string | null }).payment_id)
      : null;
  if (paymentId) {
    const { data: pay } = await supabase
      .from('payments')
      .select('reference_type')
      .eq('id', paymentId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (pay) return String((pay as { reference_type?: string }).reference_type ?? fallback ?? '');
  }
  return String((je as { reference_type?: string } | null)?.reference_type ?? fallback ?? '');
}

export const REPLACE_ATTACHMENT_CONFIRM_MESSAGE =
  'This transaction already has an attachment. The new file will replace it. Continue?';

export const REPLACE_ATTACHMENT_INFO_MESSAGE =
  'This receipt already has an attachment. A new file will replace it.';
