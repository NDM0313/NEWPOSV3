import { supabase } from '@/lib/supabase';
import { documentNumberService } from '@/app/services/documentNumberService';
import type { ErpDocumentType } from '@/app/services/documentNumberService';

// ============================================
// 🎯 SETTINGS SERVICE
// ============================================

export interface SettingRecord {
  id?: string;
  company_id: string;
  key: string;
  value: any; // JSONB
  category?: string;
  description?: string;
  updated_at?: string;
}

export interface ModuleConfig {
  id?: string;
  company_id: string;
  module_name: string;
  is_enabled: boolean;
  // Note: 'config' column doesn't exist in database schema
  updated_at?: string;
}

export interface DocumentSequence {
  id?: string;
  company_id: string;
  branch_id?: string;
  document_type: string;
  prefix: string;
  current_number: number;
  padding?: number;
  updated_at?: string;
}

export const settingsService = {
  // ============================================
  // SETTINGS (Key-Value Store)
  // ============================================

  // Get setting by key
  async getSetting(companyId: string, key: string): Promise<SettingRecord | null> {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('company_id', companyId)
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // Get all settings by category
  async getSettingsByCategory(companyId: string, category: string): Promise<SettingRecord[]> {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('company_id', companyId)
      .eq('category', category)
      .order('key');

    if (error) throw error;
    return data || [];
  },

  // Get all settings for company
  async getAllSettings(companyId: string): Promise<SettingRecord[]> {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('company_id', companyId)
        .order('category, key');

      if (error) {
        // If error is about column not existing, try without ordering
        if (error.code === '42703' || error.code === '42P01') {
          const { data: retryData, error: retryError } = await supabase
            .from('settings')
            .select('*')
            .eq('company_id', companyId);
          
          if (retryError) throw retryError;
          return retryData || [];
        }
        throw error;
      }
      return data || [];
    } catch (error) {
      console.warn('[SETTINGS SERVICE] Error loading settings, returning empty array:', error);
      return [];
    }
  },

  // Set/Update setting
  async setSetting(companyId: string, key: string, value: any, category?: string, description?: string): Promise<SettingRecord> {
    const { data, error } = await supabase
      .from('settings')
      .upsert({
        company_id: companyId,
        key,
        value,
        category,
        description,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'company_id,key',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete setting
  async deleteSetting(companyId: string, key: string): Promise<void> {
    const { error } = await supabase
      .from('settings')
      .delete()
      .eq('company_id', companyId)
      .eq('key', key);

    if (error) throw error;
  },

  // ============================================
  // ENABLE PACKING (Inventory – Boxes/Pieces)
  // Global system setting: OFF = packing hidden everywhere; ON = full packing.
  // ============================================
  async getEnablePacking(companyId: string): Promise<boolean> {
    const record = await this.getSetting(companyId, 'enable_packing');
    return record?.value === true;
  },

  async setEnablePacking(companyId: string, value: boolean): Promise<SettingRecord> {
    return this.setSetting(
      companyId,
      'enable_packing',
      value,
      'inventory',
      'Enable Packing (Boxes/Pieces) – when OFF, packing is hidden system-wide'
    );
  },

  /**
   * Company-level: allow negative stock (inventory_settings.negativeStockAllowed).
   * Single source of truth for validation — always read from DB so all users get same behavior.
   * Normalizes boolean/string so "true" or true both work.
   */
  async getAllowNegativeStock(companyId: string): Promise<boolean> {
    const invRecord = await this.getSetting(companyId, 'inventory_settings');
    if (import.meta.env?.DEV) {
      console.log('[SETTINGS] getAllowNegativeStock:', { companyId, hasRecord: !!invRecord, rawValue: invRecord?.value });
    }
    let invVal = invRecord?.value as { negativeStockAllowed?: boolean | string } | undefined;
    if (typeof invVal === 'string') {
      try {
        invVal = JSON.parse(invVal) as { negativeStockAllowed?: boolean | string };
      } catch {
        invVal = undefined;
      }
    }
    if (invVal != null && 'negativeStockAllowed' in invVal) {
      const v = invVal.negativeStockAllowed;
      if (typeof v === 'boolean') return v;
      if (v === 'true') return true;
      if (String(v).toLowerCase() === 'true') return true;
    }
    const legacy = await this.getSetting(companyId, 'allow_negative_stock');
    const legacyVal = legacy?.value;
    const out = legacyVal === true || legacyVal === 'true' || String(legacyVal).toLowerCase() === 'true';
    // Deterministic default: missing inventory_settings + no legacy = do NOT allow negative stock
    // (avoids unreliable certification when no settings row exists).
    const result = out;
    if (import.meta.env?.DEV)
      console.log('[SETTINGS] getAllowNegativeStock result:', result, '(inventory row:', !!invRecord, ', legacy:', !!legacy, ')');
    return result;
  },

  /**
   * Ensures `inventory_settings` exists with explicit negativeStockAllowed (default false).
   * Call after company creation or from Settings load once.
   */
  async ensureDefaultInventorySettings(companyId: string): Promise<void> {
    const existing = await this.getSetting(companyId, 'inventory_settings');
    if (existing?.value != null) return;
    await this.setSetting(
      companyId,
      'inventory_settings',
      { negativeStockAllowed: false },
      'inventory',
      'Inventory policy (negativeStockAllowed); created by ensureDefaultInventorySettings'
    );
  },

  // ============================================
  // MODULE CONFIG (Module Toggles)
  // ============================================

  // Get module config
  async getModuleConfig(companyId: string, moduleName: string): Promise<ModuleConfig | null> {
    const { data, error } = await supabase
      .from('modules_config')
      .select('*')
      .eq('company_id', companyId)
      .eq('module_name', moduleName)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Get all module configs
  async getAllModuleConfigs(companyId: string): Promise<ModuleConfig[]> {
    const { data, error } = await supabase
      .from('modules_config')
      .select('*')
      .eq('company_id', companyId)
      .order('module_name');

    if (error) throw error;
    return data || [];
  },

  // Set module enabled/disabled
  async setModuleEnabled(companyId: string, moduleName: string, isEnabled: boolean, config?: any): Promise<ModuleConfig> {
    // Database table doesn't have 'config' column, so don't include it
    const { data, error } = await supabase
      .from('modules_config')
      .upsert({
        company_id: companyId,
        module_name: moduleName,
        is_enabled: isEnabled,
        // Note: 'config' column doesn't exist in database, so we don't include it
      }, {
        onConflict: 'company_id,module_name',
      })
      .select()
      .single();

    if (error) {
      // Handle schema cache errors (PGRST204) - column doesn't exist
      if (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes("Could not find the 'config' column")) {
        console.warn('[SETTINGS SERVICE] Schema cache error (config column missing), retrying without config:', error);
        // Retry without config column
        const { data: retryData, error: retryError } = await supabase
          .from('modules_config')
          .upsert({
            company_id: companyId,
            module_name: moduleName,
            is_enabled: isEnabled,
          }, {
            onConflict: 'company_id,module_name',
          })
          .select()
          .single();
        
        if (retryError) {
          console.warn('[SETTINGS SERVICE] Error saving module config:', retryError);
          // Return mock response to prevent UI errors
          return {
            company_id: companyId,
            module_name: moduleName,
            is_enabled: isEnabled,
          } as ModuleConfig;
        }
        return retryData;
      }
      
      // If 403 error (RLS policy), log warning but don't throw
      if (error.code === '42501' || error.code === 'PGRST301' || error.message?.includes('permission') || error.message?.includes('403')) {
        console.warn('[SETTINGS SERVICE] Permission denied for modules_config, RLS policy may be blocking:', error);
        // Return a mock response to prevent UI errors
        return {
          company_id: companyId,
          module_name: moduleName,
          is_enabled: isEnabled,
        } as ModuleConfig;
      }
      throw error;
    }
    return data;
  },

  // ============================================
  // DOCUMENT SEQUENCES (Numbering Rules)
  // ============================================

  // Get document sequence
  async getDocumentSequence(companyId: string, branchId: string | undefined, documentType: string): Promise<DocumentSequence | null> {
    let query = supabase
      .from('document_sequences')
      .select('*')
      .eq('company_id', companyId)
      .eq('document_type', documentType);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    } else {
      query = query.is('branch_id', null);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Get all document sequences
  async getAllDocumentSequences(companyId: string, branchId?: string): Promise<DocumentSequence[]> {
    let query = supabase
      .from('document_sequences')
      .select('*')
      .eq('company_id', companyId)
      .order('document_type');

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Set document sequence
  async setDocumentSequence(
    companyId: string,
    branchId: string | undefined,
    documentType: string,
    prefix: string,
    currentNumber: number,
    padding: number = 4
  ): Promise<DocumentSequence> {
    const { data, error } = await supabase
      .from('document_sequences')
      .upsert({
        company_id: companyId,
        branch_id: branchId || null,
        document_type: documentType,
        prefix,
        current_number: currentNumber,
        padding,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'company_id,branch_id,document_type',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /** ERP Numbering Rules row for UI (from erp_document_sequences, current year, company-level branch). */
  async getErpDocumentSequences(
    companyId: string,
    branchId?: string | null
  ): Promise<{ document_type: string; prefix: string; last_number: number; padding: number; year_reset: boolean; branch_based: boolean }[]> {
    const year = new Date().getFullYear();
    const sentinel = '00000000-0000-0000-0000-000000000000';
    let query = supabase
      .from('erp_document_sequences')
      .select('document_type, prefix, last_number, padding, year_reset, branch_based')
      .eq('company_id', companyId)
      .eq('year', year);
    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    } else {
      query = query.eq('branch_id', sentinel);
    }
    let result: any = await query.order('document_type');
    if (result.error && (result.error.message?.includes('year_reset') || result.error.message?.includes('branch_based'))) {
      result = await supabase
        .from('erp_document_sequences')
        .select('document_type, prefix, last_number, padding')
        .eq('company_id', companyId)
        .eq('year', year)
        .eq('branch_id', sentinel)
        .order('document_type');
    }
    const { data, error } = result;
    if (error) return [];
    return (data || []).map((r: any) => {
      const p = (r.prefix || '').trim().replace(/-$/, '');
      return {
        document_type: r.document_type,
        prefix: p,
        last_number: Number(r.last_number ?? 0),
        padding: Number(r.padding ?? 4),
        year_reset: r.year_reset !== false,
        branch_based: r.branch_based === true,
      };
    });
  },

  /** Update numbering rule in ERP engine (prefix, padding, year_reset, branch_based). last_number optional. */
  async setErpDocumentSequence(
    companyId: string,
    branchId: string | null,
    documentType: string,
    prefix: string,
    lastNumber?: number,
    padding: number = 4,
    yearReset: boolean = true,
    branchBased: boolean = false
  ): Promise<void> {
    const year = new Date().getFullYear();
    const branchUuid = branchId && branchId !== 'all' ? branchId : '00000000-0000-0000-0000-000000000000';
    const prefixClean = (prefix || '').trim().replace(/-$/, '');
    const payload: Record<string, unknown> = {
      company_id: companyId,
      branch_id: branchUuid,
      document_type: documentType.toUpperCase(),
      prefix: prefixClean,
      year,
      last_number: lastNumber != null ? lastNumber : 0,
      padding,
      year_reset: yearReset,
      branch_based: branchBased,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('erp_document_sequences').upsert(payload, {
      onConflict: 'company_id,branch_id,document_type,year',
    });
    if (error) throw error;
  },

  // Increment document sequence and return next number. Tries ERP engine first for supported types.
  async getNextDocumentNumber(
    companyId: string,
    branchId: string | undefined,
    documentType: string
  ): Promise<string> {
    const docType = documentType.toLowerCase();
    const erpDocTypes = new Set(['sale', 'purchase', 'payment', 'expense', 'rental', 'studio', 'journal', 'job', 'pos']);
    if (erpDocTypes.has(docType)) {
      try {
        return await documentNumberService.getNextDocumentNumber(companyId, branchId ?? null, docType as ErpDocumentType);
      } catch (e) {
        // Fallback to legacy document_sequences
      }
    }

    const sequence = await this.getDocumentSequence(companyId, branchId, documentType);
    if (!sequence) {
      throw new Error(`Document sequence not found for ${documentType}`);
    }

    const nextNumber = sequence.current_number + 1;
    const padding = sequence.padding || 4;
    await this.setDocumentSequence(companyId, branchId, documentType, sequence.prefix, nextNumber, padding);
    return `${sequence.prefix}${String(nextNumber).padStart(padding, '0')}`;
  },

  /**
   * Idempotent bootstrap guard for newly created companies.
   * Creates missing-only defaults so onboarding never stays in partial state.
   */
  async ensureCompanyBootstrapDefaults(
    companyId: string,
    options?: {
      modules?: string[];
      defaultTaxRate?: number;
      taxMode?: 'Inclusive' | 'Exclusive';
      costingMethod?: 'FIFO' | 'Weighted Average';
    }
  ): Promise<void> {
    const moduleList = options?.modules && options.modules.length
      ? options.modules
      : ['sales', 'purchases', 'accounting', 'reports'];

    for (const moduleName of moduleList) {
      if (!moduleName) continue;
      await this.setModuleEnabled(companyId, moduleName, true).catch(() => undefined);
    }

    const accounting = await this.getSetting(companyId, 'accounting_settings').catch(() => null);
    if (!accounting?.value) {
      await this.setSetting(
        companyId,
        'accounting_settings',
        {
          taxCalculationMethod: options?.taxMode || 'Inclusive',
          defaultTaxRate: Number.isFinite(Number(options?.defaultTaxRate)) ? Number(options?.defaultTaxRate) : 0,
          manualJournalEnabled: true,
          defaultCurrency: 'PKR',
          multiCurrencyEnabled: false,
        },
        'accounting',
        'Auto-seeded by ensureCompanyBootstrapDefaults'
      ).catch(() => undefined);
    }

    const defaults = await this.getSetting(companyId, 'default_accounts').catch(() => null);
    if (!defaults?.value) {
      await this.setSetting(
        companyId,
        'default_accounts',
        {
          paymentMethods: [
            { id: 'cash', method: 'Cash', enabled: true, defaultAccount: 'Cash' },
            { id: 'bank', method: 'Bank', enabled: true, defaultAccount: 'Bank' },
            { id: 'wallet', method: 'Mobile Wallet', enabled: true, defaultAccount: 'Mobile Wallet' },
          ],
        },
        'accounts',
        'Auto-seeded by ensureCompanyBootstrapDefaults'
      ).catch(() => undefined);
    }

    const inv = await this.getSetting(companyId, 'inventory_settings').catch(() => null);
    if (!inv?.value) {
      await this.setSetting(
        companyId,
        'inventory_settings',
        {
          negativeStockAllowed: false,
          valuationMethod: options?.costingMethod || 'FIFO',
          defaultUnitId: null,
        },
        'inventory',
        'Auto-seeded by ensureCompanyBootstrapDefaults'
      ).catch(() => undefined);
    }

    const numberingDefaults: Array<{ type: string; prefix: string }> = [
      { type: 'sale', prefix: 'SL-' },
      { type: 'purchase', prefix: 'PUR-' },
      { type: 'rental', prefix: 'RNT-' },
      { type: 'expense', prefix: 'EXP-' },
      { type: 'product', prefix: 'PRD-' },
      { type: 'studio', prefix: 'STD-' },
      { type: 'pos', prefix: 'POS-' },
      { type: 'payment', prefix: 'PAY-' },
      { type: 'job', prefix: 'JOB-' },
      { type: 'journal', prefix: 'JV-' },
    ];
    for (const row of numberingDefaults) {
      const existing = await this.getDocumentSequence(companyId, undefined, row.type).catch(() => null);
      if (!existing) {
        await this.setDocumentSequence(companyId, undefined, row.type, row.prefix, 0, 4).catch(() => undefined);
      }
    }

    const { data: categories } = await supabase
      .from('product_categories')
      .select('id')
      .eq('company_id', companyId)
      .limit(1);
    if (!categories || categories.length === 0) {
      const now = new Date().toISOString();
      await supabase.from('product_categories').insert([
        { company_id: companyId, name: 'General', parent_id: null, description: 'Auto default', is_active: true, updated_at: now },
        { company_id: companyId, name: 'Raw Material', parent_id: null, description: 'Auto default', is_active: true, updated_at: now },
        { company_id: companyId, name: 'Finished Goods', parent_id: null, description: 'Auto default', is_active: true, updated_at: now },
        { company_id: companyId, name: 'Services', parent_id: null, description: 'Auto default', is_active: true, updated_at: now },
      ]).catch(() => undefined);
    }
  },
};
