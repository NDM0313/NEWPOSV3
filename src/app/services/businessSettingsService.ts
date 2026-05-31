import { supabase } from '@/lib/supabase';

import {

  DEFAULT_BESPOKE_FORM_CONFIG,

  normalizeBespokeFormConfig,

  type BespokeFormConfig,

  type BusinessSettingsRow,

} from '@/app/types/bespoke';



export interface BusinessSettings {

  enableBespokeOrders: boolean;

  bespokeFormConfig: BespokeFormConfig;

  customGenericProductIds: string[];

}



function rowToSettings(row: BusinessSettingsRow): BusinessSettings {

  const ids = row.custom_generic_product_ids;

  return {

    enableBespokeOrders: !!row.enable_bespoke_orders,

    bespokeFormConfig: normalizeBespokeFormConfig(row.bespoke_form_config),

    customGenericProductIds: Array.isArray(ids) ? ids.map(String) : [],

  };

}



const DEFAULT_ROW_PAYLOAD = {

  enable_bespoke_orders: false,

  bespoke_form_config: DEFAULT_BESPOKE_FORM_CONFIG,

};



const DEFAULT_SETTINGS: BusinessSettings = {

  enableBespokeOrders: false,

  bespokeFormConfig: { ...DEFAULT_BESPOKE_FORM_CONFIG },

  customGenericProductIds: [],

};



const SETTINGS_SELECT =

  'company_id, enable_bespoke_orders, bespoke_form_config, custom_generic_product_ids';



export const BESPOKE_MIGRATION_HINT =
  'Run migrations/20260531120000_bespoke_generic_products.sql on Supabase (see deploy/run-migrations-vps.sh).';

function migrationRequiredError(): Error {
  const err = new Error(`Bespoke customization is not available on this database. ${BESPOKE_MIGRATION_HINT}`);
  (err as Error & { code?: string }).code = 'MIGRATION_REQUIRED';
  return err;
}

/** True when bespoke column/RPC is missing (pre-migration or stale PostgREST cache). */
export function isBespokeSchemaUnavailable(error: { code?: string; message?: string; details?: string } | null): boolean {
  if (!error) return false;
  const msg = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return (
    error.code === '42P01'
    || error.code === 'PGRST204'
    || error.code === 'PGRST205'
    || error.code === 'PGRST202'
    || msg.includes('business_settings')
    || msg.includes('schema cache')
    || msg.includes('could not find the table')
    || msg.includes('could not find the function')
    || msg.includes('custom_generic_product_ids')
    || msg.includes('set_company_customization_enabled')
  );
}



export const businessSettingsService = {

  async getBusinessSettings(companyId: string): Promise<BusinessSettings> {

    const { data, error } = await supabase

      .from('business_settings')

      .select(SETTINGS_SELECT)

      .eq('company_id', companyId)

      .maybeSingle();



    if (error) {

      if (isBespokeSchemaUnavailable(error)) {

        return { ...DEFAULT_SETTINGS };

      }

      throw error;

    }



    if (!data) {

      const { data: inserted, error: insErr } = await supabase

        .from('business_settings')

        .insert({ company_id: companyId, ...DEFAULT_ROW_PAYLOAD })

        .select(SETTINGS_SELECT)

        .single();

      if (insErr) {

        if (isBespokeSchemaUnavailable(insErr)) {

          return { ...DEFAULT_SETTINGS };

        }

        throw insErr;

      }

      return rowToSettings(inserted as BusinessSettingsRow);

    }



    return rowToSettings(data as BusinessSettingsRow);

  },



  async updateBusinessSettings(

    companyId: string,

    partial: Partial<{

      enableBespokeOrders: boolean;

      bespokeFormConfig: Partial<BespokeFormConfig>;

    }>,

  ): Promise<BusinessSettings> {

    const current = await this.getBusinessSettings(companyId);

    const nextConfig = partial.bespokeFormConfig

      ? { ...current.bespokeFormConfig, ...partial.bespokeFormConfig }

      : current.bespokeFormConfig;

    const nextEnable =

      partial.enableBespokeOrders !== undefined

        ? partial.enableBespokeOrders

        : current.enableBespokeOrders;



    if (partial.enableBespokeOrders !== undefined) {

      return this.setCustomizationEnabled(companyId, nextEnable, nextConfig);

    }



    const payload = {

      company_id: companyId,

      enable_bespoke_orders: nextEnable,

      bespoke_form_config: nextConfig,

      updated_at: new Date().toISOString(),

    };



    const { data, error } = await supabase

      .from('business_settings')

      .upsert(payload, { onConflict: 'company_id' })

      .select(SETTINGS_SELECT)

      .single();



    if (error) {

      if (isBespokeSchemaUnavailable(error)) {

        throw migrationRequiredError();

      }

      throw error;

    }

    return rowToSettings(data as BusinessSettingsRow);

  },



  /** Toggle customization + sync generic SKU is_active via RPC. */

  async setCustomizationEnabled(

    companyId: string,

    enabled: boolean,

    bespokeFormConfig?: BespokeFormConfig,

  ): Promise<BusinessSettings> {

    const { data, error } = await supabase.rpc('set_company_customization_enabled', {

      p_company_id: companyId,

      p_enabled: enabled,

    });



    if (error) {

      if (isBespokeSchemaUnavailable(error)) {

        throw migrationRequiredError();

      }

      throw error;

    }



    const result = data as { success?: boolean; error?: string };

    if (result && result.success === false) {

      throw new Error(result.error || 'Failed to update customization setting');

    }



    if (bespokeFormConfig) {

      await supabase

        .from('business_settings')

        .update({ bespoke_form_config: bespokeFormConfig, updated_at: new Date().toISOString() })

        .eq('company_id', companyId);

    }



    return this.getBusinessSettings(companyId);

  },

};


