import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getMobilePrintingSettings, DEFAULT_RECEIPT_FIELDS, type ReceiptFieldToggles } from './mobilePrintingSettings';

export type { ReceiptFieldToggles };
export { DEFAULT_RECEIPT_FIELDS };

export async function getMergedPrintingSettings(
  companyId: string | null,
): Promise<{ data: { fields: ReceiptFieldToggles }; error: string | null }> {
  const { data, error } = await getMobilePrintingSettings(companyId);
  return { data: { fields: data.receiptFields }, error };
}

export async function updateReceiptFieldToggles(
  companyId: string | null,
  partial: Partial<ReceiptFieldToggles>,
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured || !companyId) return { error: null };
  const { data: existing, error: readErr } = await supabase
    .from('companies')
    .select('printing_settings')
    .eq('id', companyId)
    .maybeSingle();
  if (readErr) return { error: readErr.message };

  const prev =
    typeof (existing as { printing_settings?: unknown } | null)?.printing_settings === 'object' &&
    (existing as { printing_settings?: unknown }).printing_settings !== null
      ? ((existing as { printing_settings: Record<string, unknown> }).printing_settings as Record<
          string,
          unknown
        >)
      : {};
  const prevFields = (prev.fields as Record<string, unknown> | undefined) ?? {};
  const nextFields = { ...DEFAULT_RECEIPT_FIELDS, ...prevFields, ...partial };
  const next = { ...prev, fields: nextFields };

  const { error } = await supabase
    .from('companies')
    .update({ printing_settings: next })
    .eq('id', companyId);
  return { error: error?.message ?? null };
}
