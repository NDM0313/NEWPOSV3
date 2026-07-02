import { supabase } from '@/lib/supabase';
import { documentNumberService } from '@/app/services/documentNumberService';
import type { ErpDocumentType } from '@/app/services/documentNumberService';
import {
  ERP_SEQ_SENTINEL,
  counterRowKey,
  resolveErpCounterBucket,
} from '@/app/lib/erpNumberingCounter';

/** null = unknown; false = column missing on DB (PGRST204). */
let numberingIncludeBranchCodeSupported: boolean | null = null;

function isMissingColumnError(
  error: { code?: string; message?: string } | null | undefined,
  column: string,
): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === 'PGRST204'
    || msg.includes('schema cache')
    || msg.includes(`'${column}'`)
    || msg.includes(column)
  );
}

/** Whether erp_document_sequences.include_branch_code is available (Phase B migration applied). */
export function isNumberingIncludeBranchCodeSupported(): boolean {
  return numberingIncludeBranchCodeSupported !== false;
}

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
  async getDefaultDressDevaluation(companyId: string): Promise<number> {
    const row = await this.getSetting(companyId, 'default_dress_devaluation');
    const raw = row?.value;
    const value = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 5000;
  },

  async setDefaultDressDevaluation(companyId: string, amount: number): Promise<SettingRecord> {
    const normalized = Math.max(0, Math.round(Number(amount) || 0));
    return this.setSetting(
      companyId,
      'default_dress_devaluation',
      normalized,
      'rental',
      'Default dress devaluation amount auto-posted on rental booking'
    );
  },

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

  /** In-memory cache for negative-stock flag (5 min TTL). Cleared on refreshSettings / sign-out. */
  _allowNegativeStockCache: new Map<string, { value: boolean; ts: number }>(),
  clearAllowNegativeStockCache(companyId?: string): void {
    if (companyId) this._allowNegativeStockCache.delete(companyId);
    else this._allowNegativeStockCache.clear();
  },

  /**
   * Company-level: allow negative stock (inventory_settings OR pos_settings OR legacy).
   * Cached 5 minutes per company to avoid 3 setting reads on every sale save.
   */
  async getAllowNegativeStock(companyId: string): Promise<boolean> {
    const cached = this._allowNegativeStockCache.get(companyId);
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached.value;

    const [invRecord, posRecord, legacyRecord] = await Promise.all([
      this.getSetting(companyId, 'inventory_settings'),
      this.getSetting(companyId, 'pos_settings'),
      this.getSetting(companyId, 'allow_negative_stock'),
    ]);

    const parseModuleFlag = (raw: unknown): boolean | null => {
      if (raw == null) return null;
      let val = raw as { negativeStockAllowed?: boolean | string } | string;
      if (typeof val === 'string') {
        try {
          val = JSON.parse(val) as { negativeStockAllowed?: boolean | string };
        } catch {
          return null;
        }
      }
      if (typeof val === 'object' && val !== null && 'negativeStockAllowed' in val) {
        const v = val.negativeStockAllowed;
        if (typeof v === 'boolean') return v;
        if (v === 'true' || String(v).toLowerCase() === 'true') return true;
        return false;
      }
      return null;
    };

    const invFlag = parseModuleFlag(invRecord?.value);
    const posFlag = parseModuleFlag(posRecord?.value);
    const legacyVal = legacyRecord?.value;
    const legacy =
      legacyVal === true || legacyVal === 'true' || String(legacyVal ?? '').toLowerCase() === 'true';

    const result = invFlag === true || posFlag === true || legacy;

    this._allowNegativeStockCache.set(companyId, { value: result, ts: Date.now() });
    if (import.meta.env?.DEV) {
      const { isDebugErpEnabled } = await import('@/app/lib/debugErp');
      if (isDebugErpEnabled()) {
        console.log('[SETTINGS] getAllowNegativeStock:', {
          companyId,
          invFlag,
          posFlag,
          legacy,
          result,
        });
      }
    }
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

    const { data, error } = await query.limit(1).maybeSingle();

    if (error) throw error;
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

  /** ERP Numbering Rules row for UI (metadata from sentinel rule row; last_number from live counter bucket). */
  async getErpDocumentSequences(
    companyId: string,
    branchId?: string | null
  ): Promise<{ document_type: string; prefix: string; last_number: number; padding: number; year_reset: boolean; branch_based: boolean; include_branch_code: boolean }[]> {
    const calendarYear = new Date().getFullYear();
    const previewBranchId = branchId && branchId !== 'all' ? branchId : null;

    let queriedIncludeBranchCode = numberingIncludeBranchCodeSupported !== false;
    let columns = 'document_type, prefix, last_number, padding, year_reset, branch_based, year, branch_id';
    if (queriedIncludeBranchCode) {
      columns += ', include_branch_code';
    }

    const runRulesQuery = (cols: string) =>
      supabase
        .from('erp_document_sequences')
        .select(cols)
        .eq('company_id', companyId)
        .eq('branch_id', ERP_SEQ_SENTINEL)
        .eq('year', calendarYear)
        .order('document_type');

    const counterBranchIds = previewBranchId ? [ERP_SEQ_SENTINEL, previewBranchId] : [ERP_SEQ_SENTINEL];
    const runCountersQuery = (cols: string) =>
      supabase
        .from('erp_document_sequences')
        .select(cols)
        .eq('company_id', companyId)
        .in('branch_id', counterBranchIds)
        .in('year', [0, calendarYear]);

    let rulesResult: any = await runRulesQuery(columns);

    if (rulesResult.error && isMissingColumnError(rulesResult.error, 'include_branch_code')) {
      numberingIncludeBranchCodeSupported = false;
      queriedIncludeBranchCode = false;
      columns = 'document_type, prefix, last_number, padding, year_reset, branch_based, year, branch_id';
      rulesResult = await runRulesQuery(columns);
    } else if (!rulesResult.error && queriedIncludeBranchCode) {
      numberingIncludeBranchCodeSupported = true;
    }

    if (
      rulesResult.error
      && (isMissingColumnError(rulesResult.error, 'year_reset') || isMissingColumnError(rulesResult.error, 'branch_based'))
    ) {
      queriedIncludeBranchCode = false;
      rulesResult = await runRulesQuery('document_type, prefix, last_number, padding, year, branch_id');
    }

    if (rulesResult.error) return [];

    const countersResult = await runCountersQuery('document_type, last_number, year, branch_id');
    const counterByKey = new Map<string, number>();
    for (const row of (countersResult.data || []) as Array<{
      document_type: string;
      last_number?: number;
      year?: number;
      branch_id?: string;
    }>) {
      counterByKey.set(
        counterRowKey(String(row.branch_id ?? ERP_SEQ_SENTINEL), Number(row.year ?? calendarYear), row.document_type),
        Number(row.last_number ?? 0),
      );
    }

    return ((rulesResult.data || []) as any[]).map((r: any) => {
      const p = (r.prefix || '').trim().replace(/-$/, '');
      const yearReset = r.year_reset !== undefined ? r.year_reset !== false : true;
      const branchBased = r.branch_based === true;
      const bucket = resolveErpCounterBucket(yearReset, branchBased, previewBranchId, calendarYear);
      const lastNumber = counterByKey.get(counterRowKey(bucket.branchId, bucket.year, r.document_type)) ?? 0;
      return {
        document_type: r.document_type,
        prefix: p,
        last_number: lastNumber,
        padding: Number(r.padding ?? 4),
        year_reset: yearReset,
        branch_based: branchBased,
        include_branch_code: queriedIncludeBranchCode ? r.include_branch_code === true : false,
      };
    });
  },

  /** Update numbering rule in ERP engine (prefix, padding, year_reset, branch_based, include_branch_code). last_number optional. */
  async setErpDocumentSequence(
    companyId: string,
    branchId: string | null,
    documentType: string,
    prefix: string,
    lastNumber?: number,
    padding: number = 4,
    yearReset: boolean = true,
    branchBased: boolean = false,
    includeBranchCode: boolean = false
  ): Promise<{ includeBranchCodeApplied: boolean }> {
    const calendarYear = new Date().getFullYear();
    const branchUuid = branchId && branchId !== 'all' ? branchId : ERP_SEQ_SENTINEL;
    const prefixClean = (prefix || '').trim().replace(/-$/, '');
    const rulePayload: Record<string, unknown> = {
      company_id: companyId,
      branch_id: ERP_SEQ_SENTINEL,
      document_type: documentType.toUpperCase(),
      prefix: prefixClean,
      year: calendarYear,
      padding,
      year_reset: yearReset,
      branch_based: branchBased,
      updated_at: new Date().toISOString(),
    };
    if (lastNumber != null && branchUuid === ERP_SEQ_SENTINEL) {
      rulePayload.last_number = lastNumber;
    }

    const wantsIncludeBranchCode = includeBranchCode && branchBased;
    let includeBranchCodeApplied = false;

    if (numberingIncludeBranchCodeSupported !== false && wantsIncludeBranchCode) {
      rulePayload.include_branch_code = true;
    }

    let { error } = await supabase.from('erp_document_sequences').upsert(rulePayload, {
      onConflict: 'company_id,branch_id,document_type,year',
    });

    if (error && isMissingColumnError(error, 'include_branch_code')) {
      numberingIncludeBranchCodeSupported = false;
      delete rulePayload.include_branch_code;
      const retry = await supabase.from('erp_document_sequences').upsert(rulePayload, {
        onConflict: 'company_id,branch_id,document_type,year',
      });
      error = retry.error;
    } else if (!error && wantsIncludeBranchCode && numberingIncludeBranchCodeSupported !== false) {
      numberingIncludeBranchCodeSupported = true;
      includeBranchCodeApplied = true;
    }

    if (error) throw error;

    if (lastNumber != null) {
      const bucket = resolveErpCounterBucket(yearReset, branchBased, branchUuid, calendarYear);
      const counterPayload: Record<string, unknown> = {
        company_id: companyId,
        branch_id: bucket.branchId,
        document_type: documentType.toUpperCase(),
        prefix: prefixClean,
        year: bucket.year,
        last_number: lastNumber,
        padding,
        updated_at: new Date().toISOString(),
      };
      const counterUpsert = await supabase.from('erp_document_sequences').upsert(counterPayload, {
        onConflict: 'company_id,branch_id,document_type,year',
      });
      if (counterUpsert.error) throw counterUpsert.error;
    }

    return { includeBranchCodeApplied };
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
      { type: 'customer_receipt', prefix: 'RCV-' },
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
