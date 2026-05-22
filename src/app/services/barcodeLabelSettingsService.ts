/**
 * Barcode label defaults — shared key with mobile (`mobile_barcode_label`).
 */
import { supabase } from '@/lib/supabase';

const MOBILE_BARCODE_LABEL_KEY = 'mobile_barcode_label';

export type BarcodeLabelLayout = 'thermal' | 'a4';

export interface BarcodeLabelSettings {
  labelLayout: BarcodeLabelLayout;
  showName: boolean;
  showPrice: boolean;
  showBusinessName?: boolean;
  showVariation: boolean;
  showPacking: boolean;
  showCompanyName: boolean;
  showBranchName: boolean;
  defaultQuantity: number;
  a4Columns: number;
  maxLabelsPerSheet: number;
  defaultLabelsFromPurchaseQty: boolean;
}

export const DEFAULT_BARCODE_LABEL: BarcodeLabelSettings = {
  labelLayout: 'thermal',
  showName: true,
  showPrice: true,
  showBusinessName: true,
  showVariation: false,
  showPacking: false,
  showCompanyName: true,
  showBranchName: false,
  defaultQuantity: 1,
  a4Columns: 3,
  maxLabelsPerSheet: 30,
  defaultLabelsFromPurchaseQty: true,
};

function parseBarcodeLabelSettings(raw: Record<string, unknown>): BarcodeLabelSettings {
  const cols = Number(raw.a4Columns);
  const legacyBiz = raw.showBusinessName !== false;
  const showCompany =
    raw.showCompanyName !== undefined ? raw.showCompanyName !== false : legacyBiz;
  return {
    labelLayout: raw.labelLayout === 'a4' ? 'a4' : 'thermal',
    showName: raw.showName !== false,
    showPrice: raw.showPrice !== false,
    showBusinessName: showCompany,
    showVariation: raw.showVariation === true,
    showPacking: raw.showPacking === true,
    showCompanyName: showCompany,
    showBranchName: raw.showBranchName === true,
    defaultQuantity: Math.max(1, Number(raw.defaultQuantity) || 1),
    a4Columns: cols >= 2 && cols <= 4 ? cols : 3,
    maxLabelsPerSheet: Math.max(6, Math.min(60, Number(raw.maxLabelsPerSheet) || 30)),
    defaultLabelsFromPurchaseQty: raw.defaultLabelsFromPurchaseQty !== false,
  };
}

export async function getBarcodeLabelSettings(
  companyId: string | null | undefined,
): Promise<BarcodeLabelSettings> {
  if (!companyId) return DEFAULT_BARCODE_LABEL;
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('company_id', companyId)
    .eq('key', MOBILE_BARCODE_LABEL_KEY)
    .maybeSingle();
  if (error) return DEFAULT_BARCODE_LABEL;
  const raw = (data?.value as Record<string, unknown>) ?? {};
  return parseBarcodeLabelSettings(raw);
}

export async function setBarcodeLabelSettings(
  companyId: string,
  payload: BarcodeLabelSettings,
): Promise<void> {
  const { error } = await supabase.from('settings').upsert(
    {
      company_id: companyId,
      key: MOBILE_BARCODE_LABEL_KEY,
      value: payload,
      category: 'mobile',
      description: 'Barcode label print defaults',
    },
    { onConflict: 'company_id,key' },
  );
  if (error) throw new Error(error.message);
}
