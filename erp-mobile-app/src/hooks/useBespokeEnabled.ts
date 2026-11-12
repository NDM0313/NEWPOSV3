import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface BespokeFormConfig {
  show_measurements: boolean;
  show_fabric: boolean;
  show_color_code: boolean;
  show_image_upload: boolean;
  show_delivery_date: boolean;
  show_customization_charges: boolean;
}

export const DEFAULT_BESPOKE_FORM_CONFIG: BespokeFormConfig = {
  show_measurements: true,
  show_fabric: true,
  show_color_code: true,
  show_image_upload: true,
  show_delivery_date: true,
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

/** Company-level customization toggle + form field flags (business_settings). */
export function useBespokeEnabled(companyId: string | null | undefined): {
  enabled: boolean;
  loading: boolean;
  formConfig: BespokeFormConfig;
} {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formConfig, setFormConfig] = useState<BespokeFormConfig>(DEFAULT_BESPOKE_FORM_CONFIG);

  useEffect(() => {
    if (!companyId) {
      setEnabled(false);
      setFormConfig(DEFAULT_BESPOKE_FORM_CONFIG);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('business_settings')
        .select('enable_bespoke_orders, bespoke_form_config')
        .eq('company_id', companyId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setEnabled(false);
        setFormConfig(DEFAULT_BESPOKE_FORM_CONFIG);
      } else {
        const row = data as {
          enable_bespoke_orders?: boolean;
          bespoke_form_config?: unknown;
        } | null;
        setEnabled(row?.enable_bespoke_orders === true);
        setFormConfig(normalizeBespokeFormConfig(row?.bespoke_form_config));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return { enabled, loading, formConfig };
}
