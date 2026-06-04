/**
 * Bespoke form defaults — no service/context imports (safe for eager boot + manualChunks).
 * @see businessSettingsService, SettingsContext
 */

import type { BespokeFormConfig } from '@/app/types/bespoke';

export const DEFAULT_BESPOKE_FORM_CONFIG: BespokeFormConfig = {
  show_measurements: true,
  show_fabric: true,
  show_color_code: true,
  show_image_upload: true,
  show_delivery_date: true,
  /** Stitching charges use SaleForm Extra Expenses, not the modal. */
  show_customization_charges: false,
};

export function normalizeBespokeFormConfig(raw: unknown): BespokeFormConfig {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    show_measurements: o.show_measurements !== false,
    show_fabric: o.show_fabric !== false,
    show_color_code: o.show_color_code !== false,
    show_image_upload: o.show_image_upload !== false,
    show_delivery_date: o.show_delivery_date !== false,
    show_customization_charges: o.show_customization_charges !== false,
  };
}
