import { supabase, isSupabaseConfigured } from '../lib/supabase';

/** Receipt visibility toggles (subset of web companies.printing_settings.fields). */
export interface ReceiptFieldToggles {
  showLogo: boolean;
  showCompanyAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showDiscount: boolean;
  showTax: boolean;
  showStudioCost: boolean;
  showNotes: boolean;
}

export const DEFAULT_RECEIPT_FIELDS: ReceiptFieldToggles = {
  showLogo: true,
  showCompanyAddress: true,
  showPhone: true,
  showEmail: false,
  showDiscount: true,
  showTax: true,
  showStudioCost: true,
  showNotes: true,
};

function parseFields(raw: unknown): ReceiptFieldToggles {
  const f = (typeof raw === 'object' && raw !== null ? (raw as { fields?: unknown }).fields : null) as
    | Record<string, unknown>
    | undefined;
  if (!f) return { ...DEFAULT_RECEIPT_FIELDS };
  return {
    showLogo: f.showLogo !== false,
    showCompanyAddress: f.showCompanyAddress !== false,
    showPhone: f.showPhone !== false,
    showEmail: f.showEmail === true,
    showDiscount: f.showDiscount !== false,
    showTax: f.showTax !== false,
    showStudioCost: f.showStudioCost !== false,
    showNotes: f.showNotes !== false,
  };
}

export async function getMergedPrintingSettings(
  companyId: string | null,
): Promise<{ data: { fields: ReceiptFieldToggles }; error: string | null }> {
  if (!isSupabaseConfigured || !companyId) {
    return { data: { fields: { ...DEFAULT_RECEIPT_FIELDS } }, error: null };
  }
  const { data, error } = await supabase
    .from('companies')
    .select('printing_settings')
    .eq('id', companyId)
    .maybeSingle();
  if (error) return { data: { fields: { ...DEFAULT_RECEIPT_FIELDS } }, error: error.message };
  const raw = (data as { printing_settings?: unknown } | null)?.printing_settings;
  return { data: { fields: parseFields(raw) }, error: null };
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
